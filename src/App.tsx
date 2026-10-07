import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { AlertCircle, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import type {
  CameraSensorInfo,
  CapturedPhoto,
  AIPoseSuggestion,
  ResolutionMode,
} from './types/camera';

import { WELCOME_POSE } from './data/defaultPoses';
import { cameraService } from './services/cameraService';
import { aiVisionService } from './services/aiVisionService';
import { playShutterSound, triggerHaptic, playCountdownBeep } from './utils/audioHaptics';
import { createStampedPhoto } from './utils/watermark';
import { CameraHUD } from './components/CameraHUD';
import { PhotoPreviewModal } from './components/PhotoPreviewModal';
import { SettingsModal } from './components/SettingsModal';
import { PoseReferencePIP } from './components/PoseReferencePIP';

export const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Camera & Sensor State
  const [sensorInfo, setSensorInfo] = useState<CameraSensorInfo | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchActive, setTorchActive] = useState(false);
  const [shutterFlashing, setShutterFlashing] = useState(false);
  const [tapFocusCoord, setTapFocusCoord] = useState<{ x: number; y: number } | null>(null);

  // Dynamic AI Director & Pose Generation State
  const [currentPose, setCurrentPose] = useState<AIPoseSuggestion>(WELCOME_POSE);
  const [poseHistory, setPoseHistory] = useState<string[]>([]);
  const varietyCounterRef = useRef<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ type: 'success' | 'warn'; text: string } | null>(null);

  // Settings & Modals State
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [viewfinderMode, setViewfinderMode] = useState<'wide' | 'cover'>('wide');

  // Smartphone Shutter & Timer Modes
  const [timerDuration, setTimerDuration] = useState<0 | 3 | 5 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownReason, setCountdownReason] = useState<string | null>(null);
  const [tapToCapture, setTapToCapture] = useState<boolean>(true);
  const countdownIntervalRef = useRef<number | null>(null);

  // Captured Photos History
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const lastPhoto = capturedPhotos[0] || null;

  // 1. Initialize Camera
  const initApp = useCallback(async () => {
    if (!videoRef.current) return;
    setCameraLoading(true);
    setCameraError(null);

    try {
      const info = await cameraService.startCamera(videoRef.current, 'environment');
      setSensorInfo(info);
      setCameraLoading(false);
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

  // 2. Perform Scene Analysis & Text-to-Image Pose Generation
  const handlePerformAnalysis = useCallback(async () => {
    if (!videoRef.current || isAnalyzing) return;

    if (!aiVisionService.hasApiKey()) {
      setShowSettings(true);
      setAiNotice({
        type: 'warn',
        text: '🔑 Please enter your Google Gemini API key in Settings so the AI can inspect your camera view.',
      });
      setTimeout(() => setAiNotice(null), 6000);
      return;
    }

    setIsAnalyzing(true);
    setAiNotice(null);
    triggerHaptic('medium');

    try {
      varietyCounterRef.current += 1;
      const history = [...poseHistory];
      if (currentPose?.title && !history.includes(currentPose.title)) {
        history.push(currentPose.title);
      }

      // Capture frame for multimodal LLM inspection
      const frame = cameraService.captureAnalysisFrame(videoRef.current);
      const isFront = sensorInfo?.facingMode === 'user' || cameraService.getFacingMode() === 'user';

      const newPose = await aiVisionService.analyzeSceneAndGeneratePose(
        frame.base64,
        frame.mimeType,
        {
          facingMode: isFront ? 'user' : 'environment',
          previousTitles: history,
        }
      );

      setCurrentPose(newPose);
      setPoseHistory((prev) => [newPose.title, ...prev.filter((t) => t !== newPose.title).slice(0, 15)]);
      triggerHaptic('heavy');

      const objectsMentioned =
        newPose.sceneObjects.length > 0
          ? ` (found: ${newPose.sceneObjects.slice(0, 3).join(', ')})`
          : '';

      setAiNotice({
        type: 'success',
        text: `✨ Analyzed scene: "${newPose.title}"${objectsMentioned}!`,
      });

      // Confetti burst for creative inspiration
      try {
        confetti({
          particleCount: 28,
          spread: 60,
          origin: { y: 0.15 },
          colors: ['#10b981', '#34d399', '#f59e0b'],
        });
      } catch {}

      setTimeout(() => {
        setAiNotice(null);
      }, 5000);
    } catch (e: any) {
      console.error('Scene analysis failed:', e);
      setAiNotice({
        type: 'warn',
        text: e?.message || 'Could not analyze scene with Gemini Vision. Please check Settings.',
      });
      setTimeout(() => setAiNotice(null), 6000);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isAnalyzing, sensorInfo?.facingMode, currentPose?.title, poseHistory]);

  const [isCapturingState, setIsCapturingState] = useState(false);
  const isCapturingRef = useRef(false);

  // 3. Capture Full Sensor / High-Resolution Photo with Actual Megapixels Stamp
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || isCapturingRef.current) return;
    isCapturingRef.current = true;
    setIsCapturingState(true);

    // Visual shutter flash, haptics & mechanical shutter audio
    setShutterFlashing(true);
    playShutterSound();
    triggerHaptic('heavy');
    setTimeout(() => setShutterFlashing(false), 250);

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
        timestamp: Date.now(),
        isFullSensor: result.isFullSensor,
        poseTitle: currentPose?.title || 'Custom Pose',
        fileSizeBytes: result.blob.size,
      };

      setCapturedPhotos((prev) => [newPhoto, ...prev.slice(0, 19)]);
    } catch (err: any) {
      console.error('Capture failed:', err);
      setAiNotice({
        type: 'warn',
        text: `Capture warning: ${err?.message || 'Photo saved with standard resolution.'}`,
      });
      setTimeout(() => setAiNotice(null), 3500);
    } finally {
      isCapturingRef.current = false;
      setIsCapturingState(false);
    }
  }, [currentPose?.title]);

  // 4. Countdown Timer Shutter Trigger
  const cancelCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    setCountdownReason(null);
  }, []);

  const triggerShutter = useCallback(
    (delaySeconds?: number, reason?: string) => {
      cancelCountdown();
      const delay = typeof delaySeconds === 'number' ? delaySeconds : timerDuration;

      if (delay === 0) {
        handleCapture();
        return;
      }

      setCountdown(delay);
      setCountdownReason(reason || `${delay}s Timer`);
      playCountdownBeep(false);

      let current = delay;
      countdownIntervalRef.current = window.setInterval(() => {
        current -= 1;
        if (current > 0) {
          setCountdown(current);
          playCountdownBeep(current === 1);
        } else {
          cancelCountdown();
          handleCapture();
        }
      }, 1000);
    },
    [timerDuration, handleCapture, cancelCountdown]
  );



  // 7. Hardware Keys: Volume Up/Down, Spacebar, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const key = e.key;
      const code = e.code;

      if (
        key === 'AudioVolumeUp' ||
        key === 'AudioVolumeDown' ||
        key === 'VolumeUp' ||
        key === 'VolumeDown' ||
        key === ' ' ||
        code === 'Space' ||
        key === 'Enter' ||
        code === 'Enter'
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerShutter();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [triggerShutter]);

  // 8. Camera Controls: Front / Back Camera Switch
  const handleSwitchCamera = async () => {
    if (!videoRef.current || cameraSwitching) return;
    setCameraSwitching(true);
    triggerHaptic('medium');

    try {
      const info = await cameraService.switchCamera(videoRef.current);
      setSensorInfo(info);
      setTorchActive(false);
      setAiNotice({
        type: 'success',
        text: `Switched to ${info.facingMode === 'user' ? 'Front Selfie Lens' : 'Rear Main Lens'} (${info.maxMegapixels} MP Native)`,
      });
      setTimeout(() => setAiNotice(null), 2500);
    } catch (e: any) {
      console.error('Camera switch failed:', e);
      setAiNotice({
        type: 'warn',
        text: `Camera switch note: ${e?.message || 'Could not access lens'}`,
      });
      setTimeout(() => setAiNotice(null), 3000);
    } finally {
      setCameraSwitching(false);
    }
  };

  const handleToggleTorch = async () => {
    const state = await cameraService.toggleTorch();
    setTorchActive(state);
    triggerHaptic('light');
  };

  const handleToggleResolutionMode = async () => {
    if (!sensorInfo) return;
    triggerHaptic('light');
    const isFront = sensorInfo.facingMode === 'user';
    const cameraName = isFront ? 'Front Selfie Lens' : 'Rear Main Lens';
    setAiNotice({
      type: 'success',
      text: `📸 ${cameraName}: ${sensorInfo.maxMegapixels} MP Native (${sensorInfo.maxWidth}×${sensorInfo.maxHeight})`,
    });
    setTimeout(() => setAiNotice(null), 3000);
  };

  const handleSetResolutionMode = async (mode: ResolutionMode) => {
    const updated = await cameraService.setResolutionMode(mode);
    setSensorInfo(updated);
    triggerHaptic('light');
    setAiNotice({
      type: 'success',
      text: mode === 'max'
        ? `📸 Resolution set to Native Maximum (${updated.maxMegapixels} MP)`
        : '📸 Resolution set to Standard 12 MP',
    });
    setTimeout(() => setAiNotice(null), 2500);
  };

  const handleSetZoom = async (zoomLevel: number) => {
    await cameraService.setZoom(zoomLevel);
    triggerHaptic('light');
    const updated = await cameraService.getSensorInfo();
    setSensorInfo(updated);
  };

  // 9. Viewfinder Touch Tap-to-Focus & Tap-to-Snap
  const handleViewfinderTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, [data-interactive="true"]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    setTapFocusCoord({ x, y });
    triggerHaptic('light');
    setTimeout(() => setTapFocusCoord(null), 1200);

    if (tapToCapture && !isCapturingRef.current) {
      triggerShutter();
    }
  };

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black overflow-hidden select-none font-sans flex flex-col justify-between">
      {/* 1. Live Optical Video Stream Viewfinder */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-crosshair"
        onClick={handleViewfinderTap}
      >
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full transition-all duration-300 ${
            viewfinderMode === 'wide' ? 'object-contain' : 'object-cover'
          } ${sensorInfo?.facingMode === 'user' ? '-scale-x-100' : ''}`}
        />

        {/* 2. Visual Shutter Flash Effect */}
        {shutterFlashing && (
          <div className="absolute inset-0 z-40 bg-white pointer-events-none animate-in fade-in duration-75" />
        )}

        {/* 3. Tap Focus Reticle Indicator */}
        {tapFocusCoord && (
          <div
            className="absolute z-35 pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-in zoom-in-75 duration-150"
            style={{
              left: `${tapFocusCoord.x * 100}%`,
              top: `${tapFocusCoord.y * 100}%`,
            }}
          >
            <div className="w-16 h-16 border-2 border-amber-400 rounded-lg shadow-lg flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
            </div>
          </div>
        )}

        {/* 4. Rule-of-Thirds Composition Grid */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 z-25 opacity-35">
            <div className="border-r border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-r border-b border-white/60" />
            <div className="border-b border-white/60" />
            <div className="border-r border-white/60" />
            <div className="border-r border-white/60" />
            <div />
          </div>
        )}
      </div>

      {/* 5. AI Director Dynamic Feedback Toast Banner */}
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
            <button
              onClick={() => setAiNotice(null)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 6. Camera Loading & Error Banners */}
      {cameraLoading && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
          <h3 className="text-base font-semibold text-white">Starting Optical Sensor...</h3>
          <p className="text-xs text-gray-400 max-w-xs">
            Connecting to full-sensor camera and initializing AI Director.
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

      {/* 7. Clean Mobile Camera HUD Controls */}
      <CameraHUD
        currentPose={currentPose}
        sensorInfo={sensorInfo}
        torchActive={torchActive}
        onToggleTorch={handleToggleTorch}
        onSwitchCamera={handleSwitchCamera}
        onCapture={() => triggerShutter()}
        onAnalyzeScene={handlePerformAnalysis}
        isAnalyzing={isAnalyzing}
        onOpenSettings={() => setShowSettings(true)}
        onOpenGallery={() => setShowPreview(true)}
        lastPhoto={lastPhoto}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        cameraSwitching={cameraSwitching}
        isCapturing={isCapturingState}
        onToggleResolutionMode={handleToggleResolutionMode}
        viewfinderMode={viewfinderMode}
        onToggleViewfinderMode={() => setViewfinderMode((prev) => (prev === 'wide' ? 'cover' : 'wide'))}
        onSetZoom={handleSetZoom}
        timerDuration={timerDuration}
        onCycleTimer={() => {
          setTimerDuration((prev) => (prev === 0 ? 3 : prev === 3 ? 5 : 0));
          triggerHaptic('light');
        }}
        tapToCapture={tapToCapture}
        onToggleTapToCapture={() => {
          setTapToCapture((prev) => !prev);
          triggerHaptic('light');
        }}
        countdown={countdown}
        countdownReason={countdownReason}
        onCancelCountdown={cancelCountdown}
      />

      {/* 8. Floating Draggable Picture-In-Picture Reference Card */}
      <PoseReferencePIP
        currentPose={currentPose}
        isAnalyzing={isAnalyzing}
        onRegeneratePose={handlePerformAnalysis}
        onOpenGallery={() => setShowPreview(true)}
      />

      {/* 9. Full Resolution Photo Review Modal */}
      {showPreview && (
        <PhotoPreviewModal
          photo={lastPhoto}
          onClose={() => setShowPreview(false)}
          currentPose={currentPose}
        />
      )}

      {/* 10. Settings Modal */}
      {showSettings && (
        <SettingsModal
          sensorInfo={sensorInfo}
          onClose={() => setShowSettings(false)}
          onSetResolutionMode={handleSetResolutionMode}
        />
      )}
    </div>
  );
};

export default App;
