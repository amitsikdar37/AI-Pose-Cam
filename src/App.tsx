import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { AlertCircle, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import type {
  AlignmentResult,
  CameraSensorInfo,
  CapturedPhoto,
  PoseLandmarks,
  PosePreset,
} from './types/camera';
import { DEFAULT_POSES } from './data/defaultPoses';
import { cameraService } from './services/cameraService';
import { poseDetectionService } from './services/poseDetectionService';
import { aiVisionService } from './services/aiVisionService';
import { playShutterSound, playAlignedChime, triggerHaptic } from './utils/audioHaptics';
import { createStampedPhoto } from './utils/watermark';
import { SkeletalOverlay } from './components/SkeletalOverlay';
import { CameraHUD } from './components/CameraHUD';
import { PhotoPreviewModal } from './components/PhotoPreviewModal';
import { PoseSelectorModal } from './components/PoseSelectorModal';
import { SettingsModal } from './components/SettingsModal';

export const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const autoCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialAnalysisDoneRef = useRef(false);

  // Camera & Sensor State
  const [sensorInfo, setSensorInfo] = useState<CameraSensorInfo | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchActive, setTorchActive] = useState(false);
  const [shutterFlashing, setShutterFlashing] = useState(false);
  const [tapFocusCoord, setTapFocusCoord] = useState<{ x: number; y: number } | null>(null);

  // Pose & AI Director State
  const [currentPose, setCurrentPose] = useState<PosePreset>(DEFAULT_POSES[0]);
  const [liveLandmarks, setLiveLandmarks] = useState<PoseLandmarks | null>(null);
  const [alignment, setAlignment] = useState<AlignmentResult>({
    score: 0,
    isAligned: false,
    jointErrors: {},
    primaryFeedback: 'Initializing AI Director...',
    alignedJointsCount: 0,
    totalJointsCount: 0,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ type: 'success' | 'warn'; text: string } | null>(null);

  // Settings & Modals State
  const [showPoseSelector, setShowPoseSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [autoCapture, setAutoCapture] = useState(false);
  const [alignmentSensitivity, setAlignmentSensitivity] = useState(78);
  const [guideOpacity, setGuideOpacity] = useState(0.85);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);

  // Captured Photos History
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const lastPhoto = capturedPhotos[0] || null;

  // Track alignment chime trigger (to not spam audio while holding pose)
  const hasChimedRef = useRef(false);

  // 1. Initialize Camera and Pose Detection
  const initApp = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraLoading(true);
    setCameraError(null);

    try {
      const info = await cameraService.startCamera(videoRef.current, 'environment');
      setSensorInfo(info);
      setCameraLoading(false);

      // Initialize MediaPipe PoseLandmarker in the background
      poseDetectionService.initialize().catch((err) => {
        console.warn('Pose model background init error:', err);
      });
    } catch (err: any) {
      console.error('Camera startup error:', err);
      setCameraError(err?.message || 'Could not access camera. Please allow camera permissions.');
      setCameraLoading(false);
    }
  }, []);

  useEffect(() => {
    initApp();
    return () => {
      cameraService.stopCamera();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [initApp]);

  // 2. Perform Scene Analysis using Gemini Vision
  const handlePerformAnalysis = useCallback(async () => {
    if (!videoRef.current || isAnalyzing) return;
    setIsAnalyzing(true);
    setAiNotice(null);
    triggerHaptic('light');

    try {
      // Capture single normal-quality frame for LLM analysis
      const frame = cameraService.captureAnalysisFrame(videoRef.current);
      const result = await aiVisionService.analyzeSceneAndRecommendPose(
        frame.base64,
        frame.mimeType
      );

      setCurrentPose(result.preset);

      if (result.isAIGenerated) {
        triggerHaptic('double');
        setAiNotice({
          type: 'success',
          text: `✨ Bespoke AI Pose: "${result.preset.title}" generated for this scene!`,
        });
      } else {
        setAiNotice({
          type: 'warn',
          text: result.errorNotice || 'Switched pose preset.',
        });
      }

      // Auto dismiss notice after 4.5s
      setTimeout(() => {
        setAiNotice(null);
      }, 4500);
    } catch (e: any) {
      console.error('Scene analysis failed:', e);
      setAiNotice({
        type: 'warn',
        text: `Error: ${e?.message || 'Could not analyze scene'}. Using studio pose.`,
      });
      setTimeout(() => setAiNotice(null), 4500);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing]);

  // Video loaded event handler: triggers initial frame analysis
  const handleVideoPlaying = () => {
    if (!initialAnalysisDoneRef.current) {
      initialAnalysisDoneRef.current = true;
      setTimeout(() => {
        handlePerformAnalysis();
      }, 1200);
    }
  };

  // 3. Pose Detection & Alignment Loop
  useEffect(() => {
    let lastTime = 0;

    const processFrame = (now: number) => {
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        // Run pose detection at ~25-30 FPS for smooth performance
        if (now - lastTime >= 33) {
          lastTime = now;
          const detected = poseDetectionService.detectPose(video, now);
          setLiveLandmarks(detected);

          const alignResult = poseDetectionService.calculateAlignment(
            detected,
            currentPose ? currentPose.landmarks : null,
            alignmentSensitivity
          );

          setAlignment(alignResult);

          // Alignment Chime and Haptic Feedback
          if (alignResult.isAligned) {
            if (!hasChimedRef.current) {
              hasChimedRef.current = true;
              playAlignedChime();
            }
          } else {
            hasChimedRef.current = false;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(processFrame);
    };

    animationFrameRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentPose, alignmentSensitivity]);

  // 4. Capture Full Sensor / High-Resolution Photo with Actual Megapixels Stamp
  const handleCapture = useCallback(async () => {
    if (!videoRef.current) return;

    // Visual shutter flash & mechanical shutter audio
    setShutterFlashing(true);
    playShutterSound();
    setTimeout(() => setShutterFlashing(false), 300);

    try {
      const result = await cameraService.captureFullQualityPhoto(videoRef.current);
      const url = URL.createObjectURL(result.blob);

      // Create photo containing the actual megapixel of the camera used
      const { stampedBlob, stampedUrl } = await createStampedPhoto(
        result.blob,
        result.megapixelsFormatted,
        result.width,
        result.height,
        result.cameraUsed,
        alignment.score,
        currentPose?.title || 'AI Director Pose'
      );

      const newPhoto: CapturedPhoto = {
        id: `photo_${Date.now()}`,
        url,
        blob: result.blob,
        stampedUrl,
        stampedBlob,
        width: result.width,
        height: result.height,
        megapixels: result.megapixels,
        megapixelsFormatted: result.megapixelsFormatted,
        cameraUsed: result.cameraUsed,
        facingMode: result.facingMode,
        alignmentScore: alignment.score,
        timestamp: Date.now(),
        isFullSensor: result.isFullSensor,
        poseTitle: currentPose?.title || 'AI Director Photo',
        fileSizeBytes: result.blob.size,
      };

      setCapturedPhotos((prev) => [newPhoto, ...prev]);

      // Celebrate with confetti if alignment was on point!
      if (alignment.isAligned) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#00ff88', '#38bdf8', '#ffffff'],
        });
      }

      // Automatically show preview
      setShowPreview(true);
    } catch (err) {
      console.error('Photo capture error:', err);
    }
  }, [alignment, currentPose]);

  // 5. Auto-Capture Trigger when Aligned
  useEffect(() => {
    if (!autoCapture) {
      if (autoCaptureTimerRef.current) {
        clearTimeout(autoCaptureTimerRef.current);
        autoCaptureTimerRef.current = null;
      }
      setAutoCaptureCountdown(null);
      return;
    }

    if (alignment.isAligned && !autoCaptureCountdown && !showPreview) {
      setAutoCaptureCountdown(1);
      const timer = setTimeout(() => {
        handleCapture();
        setAutoCaptureCountdown(null);
      }, 1100);
      return () => clearTimeout(timer);
    }
  }, [alignment.isAligned, autoCapture, autoCaptureCountdown, handleCapture, showPreview]);

  // 6. Camera Controls: Front / Back Camera Switch
  const handleSwitchCamera = async () => {
    if (!videoRef.current || cameraSwitching) return;
    setCameraSwitching(true);
    triggerHaptic('medium');

    try {
      const info = await cameraService.switchCamera(videoRef.current);
      setSensorInfo(info);
    } catch (e) {
      console.error('Camera switch failed:', e);
    } finally {
      setCameraSwitching(false);
    }
  };

  const handleToggleTorch = async () => {
    const state = await cameraService.toggleTorch();
    setTorchActive(state);
    triggerHaptic('light');
  };

  // Touch to focus handler
  const handleTouchFocus = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setTapFocusCoord({ x, y });
    triggerHaptic('light');
    setTimeout(() => setTapFocusCoord(null), 1200);
  };

  return (
    <div className="relative w-full h-[100dvh] bg-black overflow-hidden select-none touch-none flex flex-col justify-center items-center">
      {/* 1. Fullscreen Video Stream Viewfinder */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onClick={handleTouchFocus}
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          onPlaying={handleVideoPlaying}
          className={`w-full h-full object-cover transition-transform duration-300 ${
            sensorInfo?.facingMode === 'user' ? 'scale-x-[-1]' : ''
          }`}
        />

        {/* 2. AI Skeletal Overlay (Target & Live Detection Wireframe) */}
        <SkeletalOverlay
          targetLandmarks={currentPose?.landmarks || null}
          liveLandmarks={liveLandmarks}
          alignment={alignment}
          isMirrored={sensorInfo?.facingMode === 'user'}
          opacity={guideOpacity}
        />

        {/* 3. Touch Focus Ring */}
        {tapFocusCoord && (
          <div
            className="absolute pointer-events-none z-30 w-16 h-16 border-2 border-emerald-400 rounded-lg animate-ping flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: tapFocusCoord.x, top: tapFocusCoord.y }}
          >
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
          </div>
        )}

        {/* 4. White Shutter Flash Effect */}
        {shutterFlashing && (
          <div className="absolute inset-0 bg-white z-40 animate-shutter pointer-events-none" />
        )}
      </div>

      {/* 5. AI Vision Feedback Notification Toast (Top pinned, non-intrusive) */}
      {aiNotice && (
        <div className="absolute top-16 left-4 right-4 z-40 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-3 duration-300">
          <div
            className={`px-3.5 py-2 rounded-2xl glass-panel shadow-2xl flex items-center gap-2 border text-xs max-w-md pointer-events-auto ${
              aiNotice.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
                : 'bg-amber-950/90 border-amber-500/60 text-amber-200'
            }`}
          >
            {aiNotice.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            )}
            <span className="leading-snug flex-1">{aiNotice.text}</span>
            {aiNotice.type === 'warn' && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 text-white font-semibold text-[11px] transition-all"
                >
                  Settings ⚙️
                </button>
                <button
                  onClick={handlePerformAnalysis}
                  className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-[11px] transition-all"
                >
                  Retry
                </button>
              </div>
            )}
            <button
              onClick={() => setAiNotice(null)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 6. Camera Loading / Permission Error Banner */}
      {cameraLoading && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          <h3 className="text-base font-semibold text-white">Starting Optical Sensor...</h3>
          <p className="text-xs text-gray-400 max-w-xs">
            Configuring ultra-high-resolution RAW camera capabilities and AI Director.
          </p>
        </div>
      )}

      {cameraError && (
        <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h3 className="text-lg font-semibold text-white">Camera Access Required</h3>
          <p className="text-xs text-gray-300 max-w-sm">{cameraError}</p>
          <button
            onClick={initApp}
            className="px-5 py-2.5 rounded-full bg-emerald-500 text-black font-semibold text-sm active:scale-95 transition-transform flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Camera</span>
          </button>
        </div>
      )}

      {/* 7. Mobile Camera HUD Controls with Front/Back Switcher */}
      <CameraHUD
        currentPose={currentPose}
        alignment={alignment}
        sensorInfo={sensorInfo}
        torchActive={torchActive}
        onToggleTorch={handleToggleTorch}
        onSwitchCamera={handleSwitchCamera}
        onCapture={handleCapture}
        onAnalyzeScene={handlePerformAnalysis}
        isAnalyzing={isAnalyzing}
        onOpenPoseSelector={() => setShowPoseSelector(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenGallery={() => setShowPreview(true)}
        lastPhoto={lastPhoto}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        autoCaptureCountdown={autoCaptureCountdown}
        cameraSwitching={cameraSwitching}
      />

      {/* 8. Full Resolution Photo Review Modal with Actual Megapixel Verification */}
      {showPreview && (
        <PhotoPreviewModal
          photo={lastPhoto}
          onClose={() => setShowPreview(false)}
          currentPose={currentPose}
        />
      )}

      {/* 9. AI Pose Presets & Scene Analysis Modal */}
      {showPoseSelector && (
        <PoseSelectorModal
          currentPose={currentPose}
          onSelectPose={(pose) => setCurrentPose(pose)}
          onAnalyzeScene={handlePerformAnalysis}
          isAnalyzing={isAnalyzing}
          onClose={() => setShowPoseSelector(false)}
        />
      )}

      {/* 10. Settings Modal */}
      {showSettings && (
        <SettingsModal
          sensorInfo={sensorInfo}
          autoCapture={autoCapture}
          onToggleAutoCapture={setAutoCapture}
          alignmentSensitivity={alignmentSensitivity}
          onSetSensitivity={setAlignmentSensitivity}
          guideOpacity={guideOpacity}
          onSetGuideOpacity={setGuideOpacity}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default App;
