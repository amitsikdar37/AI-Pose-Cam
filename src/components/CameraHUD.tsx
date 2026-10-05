import React, { useState, useRef } from 'react';
import {
  Camera,
  RotateCcw,
  Zap,
  ZapOff,
  Settings,
  Grid,
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  User,
  Maximize2,
  Minimize2,
  Timer,
  Hand,
  Mic,
  MicOff,
  MousePointerClick,
} from 'lucide-react';
import type { AlignmentResult, CameraSensorInfo, CapturedPhoto, PosePreset, OrientationAngle } from '../types/camera';
import { PostureBar } from './PostureBar';

interface CameraHUDProps {
  currentPose: PosePreset | null;
  onSelectPose: (pose: PosePreset) => void;
  alignment: AlignmentResult;
  sensorInfo: CameraSensorInfo | null;
  torchActive: boolean;
  onToggleTorch: () => void;
  onSwitchCamera: () => void;
  onCapture: () => void;
  onAnalyzeScene: () => void;
  isAnalyzing: boolean;
  onOpenPoseSelector: () => void;
  onOpenSettings: () => void;
  onOpenGallery: () => void;
  lastPhoto: CapturedPhoto | null;
  showGrid: boolean;
  onToggleGrid: () => void;
  cameraSwitching: boolean;
  guideMode: 'silhouette' | 'hybrid' | 'skeletal';
  onToggleGuideMode: () => void;
  isCapturing?: boolean;
  onToggleResolutionMode?: () => void;
  viewfinderMode?: 'wide' | 'cover';
  onToggleViewfinderMode?: () => void;
  onSetZoom?: (level: number) => void;
  timerDuration?: 0 | 3 | 5 | 10;
  onCycleTimer?: () => void;
  tapToCapture?: boolean;
  onToggleTapToCapture?: () => void;
  palmCapture?: boolean;
  onTogglePalmCapture?: () => void;
  voiceCapture?: boolean;
  onToggleVoiceCapture?: () => void;
  autoCapture?: boolean;
  onToggleAutoCapture?: () => void;
  countdown?: number | null;
  countdownReason?: string | null;
  onCancelCountdown?: () => void;
  orientationAngle?: OrientationAngle;
  onCycleOrientation?: () => void;
}


export const CameraHUD: React.FC<CameraHUDProps> = ({
  currentPose,
  onSelectPose,
  alignment,
  sensorInfo,
  torchActive,
  onToggleTorch,
  onSwitchCamera,
  onCapture,
  onAnalyzeScene,
  isAnalyzing,
  onOpenPoseSelector,
  onOpenSettings,
  onOpenGallery,
  lastPhoto,
  showGrid,
  onToggleGrid,
  cameraSwitching,
  guideMode,
  onToggleGuideMode,
  isCapturing = false,
  onToggleResolutionMode,
  viewfinderMode = 'wide',
  onToggleViewfinderMode,
  onSetZoom,
  timerDuration = 0,
  onCycleTimer,
  tapToCapture = true,
  onToggleTapToCapture,
  palmCapture = true,
  onTogglePalmCapture,
  voiceCapture = false,
  onToggleVoiceCapture,
  autoCapture = false,
  onToggleAutoCapture,
  countdown = null,
  countdownReason = null,
  onCancelCountdown,
  orientationAngle = 0,
  onCycleOrientation,
}) => {


  const isAligned = alignment.isAligned;
  const score = alignment.score;
  const isFront = sensorInfo?.facingMode === 'user';

  const [spinFlip, setSpinFlip] = useState(false);
  const [showFullTips, setShowFullTips] = useState(false);
  const lastCaptureTimeRef = useRef(0);

  const handleShutterTrigger = (e: React.SyntheticEvent) => {
    // If it's a touch event, prevent default to eliminate 300ms mobile click delay & ghost touches
    if ('touches' in e || 'changedTouches' in e) {
      e.preventDefault();
    }
    e.stopPropagation();

    const now = Date.now();
    if (now - lastCaptureTimeRef.current < 400) return; // Debounce rapid taps
    lastCaptureTimeRef.current = now;

    onCapture();
  };

  const handleFlipClick = () => {
    setSpinFlip(true);
    onSwitchCamera();
    setTimeout(() => setSpinFlip(false), 500);
  };

  return (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-20 select-none safe-area-inset">
      {/* 1. Rule of Thirds Grid (Optional) */}
      {showGrid && (
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="w-full h-full grid grid-cols-3 grid-rows-3 border border-white/20">
            <div className="border-r border-b border-white/30"></div>
            <div className="border-r border-b border-white/30"></div>
            <div className="border-b border-white/30"></div>
            <div className="border-r border-b border-white/30"></div>
            <div className="border-r border-b border-white/30"></div>
            <div className="border-b border-white/30"></div>
            <div className="border-r border-b border-white/30"></div>
            <div className="border-r border-b border-white/30"></div>
            <div></div>
          </div>
        </div>
      )}

      {/* 2. Top Header Bar (Resolution, Alignment Pill, Guide Mode Toggle, Settings) */}
      <div className="p-3 sm:p-4 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Resolution Badge & Flip Camera */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleResolutionMode}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full glass-pill text-xs font-mono tracking-wider text-emerald-400 border border-emerald-500/30 hover:border-emerald-400/60 active:scale-95 transition-all cursor-pointer"
              title="Tap to toggle sensor resolution mode: 32 MP Full Sensor / 4 MP Binned / Auto"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold">
                {sensorInfo?.maxMegapixels ? `${sensorInfo.maxMegapixels} MP` : '32 MP'}
              </span>
              <span className="text-[10px] text-gray-300 font-sans hidden sm:inline">
                {isFront ? 'FRONT' : 'BACK'}
              </span>
              {sensorInfo?.resolutionMode === '32mp' && (
                <span className="text-[9px] px-1 rounded bg-emerald-500/25 text-emerald-300 font-sans font-bold">
                  HD
                </span>
              )}
            </button>


            <button
              onClick={handleFlipClick}
              disabled={cameraSwitching}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full glass-pill text-[11px] font-semibold text-gray-300 hover:text-white transition-all border border-white/10 active:scale-95"
              title="Flip Camera (Front / Back)"
            >
              <RotateCcw
                className={`w-3.5 h-3.5 text-emerald-400 transition-transform duration-500 ${
                  spinFlip || cameraSwitching ? 'rotate-180' : ''
                }`}
              />
              <span className="uppercase text-[10px]">{isFront ? 'Selfie' : 'Rear'}</span>
            </button>
          </div>

          {/* Dynamic Alignment Score Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full glass-pill text-xs font-bold transition-all duration-300 ${
              isAligned
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 glow-green scale-105'
                : score >= 65
                ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                : 'bg-black/60 text-amber-200 border-white/10'
            }`}
          >
            {isAligned ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
            ) : (
              <div
                className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin"
                style={{ animationDuration: '3s' }}
              />
            )}
            <span>{score}% ALIGNED</span>
          </div>

          {/* Action Buttons: Guide Style Toggle, Grid, Flash, Settings */}
          <div className="flex items-center gap-1">
            {/* Guide Mode Toggle: Silhouette (Yellow outline) vs Skeletal */}
            <button
              onClick={onToggleGuideMode}
              className={`px-2 py-1 rounded-full glass-pill text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                guideMode === 'silhouette'
                  ? 'text-amber-300 border-amber-400/40 bg-amber-500/10'
                  : 'text-sky-300 border-sky-400/40 bg-sky-500/10'
              }`}
              title="Toggle Silhouette / Skeletal Guide"
            >
              <User className="w-3 h-3" />
              <span className="capitalize">{guideMode}</span>
            </button>

            {sensorInfo?.torchAvailable && (
              <button
                onClick={onToggleTorch}
                className={`p-1.5 rounded-full glass-pill transition-colors ${
                  torchActive ? 'text-amber-400 bg-amber-500/20' : 'text-white/80 hover:text-white'
                }`}
                title="Toggle Torch"
              >
                {torchActive ? <Zap className="w-4 h-4 fill-amber-400" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onToggleGrid}
              className={`p-1.5 rounded-full glass-pill transition-colors ${
                showGrid ? 'text-emerald-400 bg-emerald-500/20' : 'text-white/80 hover:text-white'
              }`}
              title="Toggle Grid"
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenPoseSelector}
              className="p-1.5 rounded-full glass-pill text-white/80 hover:text-white transition-colors"
              title="Full Pose Library"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Viewfinder Framing Toggle (Wide 4:3 Uncropped vs Full Screen) */}
            <button
              onClick={onToggleViewfinderMode}
              className={`px-2 py-1 rounded-full glass-pill text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                viewfinderMode === 'wide'
                  ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                  : 'text-gray-300 hover:text-white'
              }`}
              title="Toggle Viewfinder Framing: Wide (Uncropped 4:3) / Full Screen"
            >
              {viewfinderMode === 'wide' ? (
                <Minimize2 className="w-3 h-3 text-emerald-400" />
              ) : (
                <Maximize2 className="w-3 h-3 text-gray-400" />
              )}
              <span className="capitalize">{viewfinderMode === 'wide' ? 'Wide' : 'Full'}</span>
            </button>

            {/* Device Orientation Indicator & Manual Rotation Toggle */}
            <button
              onClick={onCycleOrientation}
              className={`px-2 py-1 rounded-full glass-pill text-[10px] font-semibold flex items-center gap-1 transition-all ${
                orientationAngle !== 0
                  ? 'text-emerald-300 border-emerald-400/50 bg-emerald-500/20'
                  : 'text-gray-300 hover:text-white'
              }`}
              title="Device Orientation (Auto-detects on rotation or tap to change)"
            >
              <RotateCcw className={`w-3 h-3 transition-transform duration-300 ${
                orientationAngle === 90 ? '-rotate-90' : orientationAngle === 270 ? 'rotate-90' : orientationAngle === 180 ? 'rotate-180' : ''
              }`} />
              <span>{orientationAngle === 0 ? 'Portrait' : orientationAngle === 90 ? 'Landscape L' : orientationAngle === 270 ? 'Landscape R' : '180°'}</span>
            </button>

            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-full glass-pill text-white/80 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Selfie Shutter Mode Pills (Timer, Tap to Snap, Palm, Voice, Auto) */}
        <div className="flex items-center justify-between sm:justify-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {/* 1. Timer: Off / 3s / 5s */}
          <button
            onClick={onCycleTimer}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 glass-pill transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              timerDuration > 0
                ? 'bg-amber-400 text-black border-amber-300 font-bold shadow-md shadow-amber-400/20'
                : 'text-gray-300 hover:text-white border-white/10'
            }`}
            title="Self-Timer: Tap to cycle Off, 3s, 5s delay"
          >
            <Timer className="w-3.5 h-3.5" />
            <span>{timerDuration > 0 ? `${timerDuration}s` : 'Timer'}</span>
          </button>

          {/* 2. Tap Anywhere on Screen to Snap */}
          <button
            onClick={onToggleTapToCapture}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 glass-pill transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              tapToCapture
                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/60'
                : 'text-gray-400 hover:text-white border-white/10'
            }`}
            title="Tap Anywhere on Screen to Snap Photo"
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span>{tapToCapture ? 'Tap: Snap' : 'Tap: Focus'}</span>
          </button>

          {/* 3. Palm Gesture Shutter */}
          <button
            onClick={onTogglePalmCapture}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 glass-pill transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              palmCapture
                ? 'bg-sky-500/25 text-sky-300 border-sky-400/60'
                : 'text-gray-400 hover:text-white border-white/10'
            }`}
            title="Raise open palm to camera to trigger 3s selfie countdown"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>{palmCapture ? 'Palm: ON' : 'Palm'}</span>
          </button>

          {/* 4. Voice Shutter (Say 'Cheese' / 'Smile') */}
          <button
            onClick={onToggleVoiceCapture}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 glass-pill transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              voiceCapture
                ? 'bg-rose-500 text-white border-rose-400 font-bold shadow-md shadow-rose-500/30 animate-pulse'
                : 'text-gray-400 hover:text-white border-white/10'
            }`}
            title="Voice Shutter: Say 'Cheese', 'Smile', or 'Click' to snap hands-free"
          >
            {voiceCapture ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span>{voiceCapture ? '🎙️ "Cheese"' : 'Voice'}</span>
          </button>

          {/* 5. Auto Snap on Pose Match */}
          <button
            onClick={onToggleAutoCapture}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 glass-pill transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              autoCapture
                ? 'bg-emerald-400 text-black border-emerald-300 font-bold shadow-md shadow-emerald-400/20'
                : 'text-gray-400 hover:text-white border-white/10'
            }`}
            title="Automatically snap when body matches target pose"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{autoCapture ? 'Auto Snap' : 'Auto'}</span>
          </button>
        </div>

        {/* Camera Switching Toast */}
        {cameraSwitching && (
          <div className="flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-3 py-1 rounded-full bg-emerald-500/90 text-black font-semibold text-xs flex items-center gap-1.5 shadow-xl">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Switching Camera...</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Side Thumb Shutter Button (Perfect for one-handed selfie grip) */}
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-auto z-20">
        <button
          onClick={handleShutterTrigger}
          disabled={isCapturing}
          className="w-13 h-13 rounded-full bg-black/70 border-2 border-white/80 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all shadow-2xl p-1.5 group"
          title="Quick Selfie Shutter (Natural thumb position)"
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isCapturing
                ? 'bg-emerald-500'
                : isAligned
                ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)]'
                : 'bg-white group-active:bg-amber-400'
            }`}
          >
            <Camera className="w-5 h-5 text-black" />
          </div>
        </button>
      </div>

      {/* Full-Screen Selfie Countdown Overlay (Only visible when active timer/countdown is running) */}
      {typeof countdown === 'number' && countdown > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-30 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
          {countdownReason && (
            <div className="mb-4 px-4 py-1.5 rounded-full bg-emerald-400 text-black font-extrabold text-xs sm:text-sm tracking-wide shadow-2xl animate-bounce">
              {countdownReason}
            </div>
          )}
          <div className="text-9xl font-black text-emerald-400 drop-shadow-[0_0_45px_rgba(16,185,129,0.95)] animate-ping">
            {countdown}
          </div>
          {onCancelCountdown && (
            <div className="mt-8">
              <button
                onClick={onCancelCountdown}
                className="px-5 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md active:scale-95 transition-all border border-white/20 shadow-lg"
              >
                Cancel ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. Bottom Controls Section: Feedback + Posture Carousel + Shutter Bar */}
      <div className="flex flex-col gap-1 pointer-events-auto">
        {/* Dynamic Pose Coaching Pill */}
        <div className="flex flex-col items-center pointer-events-none px-3">
          <div
            onClick={() => setShowFullTips(!showFullTips)}
            className={`pointer-events-auto cursor-pointer px-3 py-1 rounded-full glass-panel max-w-[94%] transition-all duration-300 shadow-xl flex items-center gap-2 ${
              isAligned
                ? 'border-emerald-500/80 bg-emerald-950/90 text-emerald-200 glow-green'
                : 'border-amber-400/40 bg-black/85 text-amber-200'
            }`}
          >
            <span className="text-[11px] font-bold tracking-wide">
              {isAligned ? '✨ ' : '👉 '}{alignment.primaryFeedback}
            </span>
            {currentPose?.directionTip && !isAligned && (
              <div className="text-gray-400 hover:text-white p-0.5">
                {showFullTips ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </div>
            )}
          </div>
          {currentPose?.directionTip && showFullTips && !isAligned && (
            <div className="pointer-events-auto mt-1 px-3 py-1.5 rounded-xl bg-black/90 border border-white/10 text-[11px] text-gray-200 max-w-xs text-center shadow-lg animate-in fade-in duration-150">
              💡 {currentPose.directionTip}
            </div>
          )}
        </div>

        {/* Hardware Zoom / Wide Angle Selector (.6x Ultra-Wide, 1.0x Standard, 2.0x Telephoto) */}
        <div className="flex items-center justify-center gap-2 py-0.5 pointer-events-auto">
          {[0.6, 1.0, 2.0].map((z) => (
            <button
              key={z}
              onClick={() => onSetZoom?.(z)}
              className={`px-3 py-0.5 rounded-full text-[11px] font-mono font-bold glass-pill transition-all active:scale-95 ${
                (sensorInfo?.zoomCurrent || 1.0) === z || (z === 1.0 && !sensorInfo?.zoomCurrent)
                  ? 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/20 scale-105'
                  : 'text-gray-300 hover:text-white border-white/10'
              }`}
              title={`Switch camera zoom to ${z}x`}
            >
              {z === 0.6 ? '.6x WIDE' : `${z}x`}
            </button>
          ))}
        </div>

        {/* 5. Horizontal Posture Catalog Carousel (Exact Match to User Reference Screenshots!) */}
        <PostureBar
          currentPose={currentPose}
          onSelectPose={onSelectPose}
          onAnalyzeScene={onAnalyzeScene}
          isAnalyzing={isAnalyzing}
        />


        {/* 6. Main Shutter & Hardware Controls Row */}
        <div className="bg-black/90 px-4 py-2 flex items-center justify-around border-t border-white/5">
          {/* Gallery Button */}
          <div className="w-14 h-14 flex items-center justify-center">
            {lastPhoto ? (
              <button
                onClick={onOpenGallery}
                className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-emerald-400/80 shadow-md active:scale-90 transition-transform relative group"
                title="View Gallery"
              >
                <img src={lastPhoto.url} alt="Last capture" className="w-full h-full object-cover" />
                <span className="absolute bottom-0.5 right-0.5 text-[7px] font-mono font-bold bg-black/80 text-emerald-300 px-0.5 rounded">
                  {lastPhoto.megapixelsFormatted}
                </span>
              </button>
            ) : (
              <div className="w-11 h-11 rounded-2xl border border-white/20 glass-pill flex items-center justify-center opacity-40">
                <Camera className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>

          {/* Shutter Button with Pulsing Gold/Green Alignment Ring */}
          <div className="relative flex flex-col items-center justify-center">
            {/* Outer pulsating ring */}
            <div
              className={`absolute w-20 h-20 rounded-full border-2 transition-all duration-300 pointer-events-none select-none ${
                isAligned
                  ? 'border-emerald-400 animate-pulse scale-110 glow-green'
                  : 'border-amber-400/50'
              }`}
            />

            {/* Inner Shutter button */}
            <button
              type="button"
              onTouchStart={handleShutterTrigger}
              onPointerDown={(e) => {
                if (e.pointerType !== 'touch') {
                  handleShutterTrigger(e);
                }
              }}
              onClick={handleShutterTrigger}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-2xl relative z-10 cursor-pointer touch-manipulation select-none ${
                isCapturing
                  ? 'bg-emerald-400 text-black scale-95 ring-4 ring-emerald-300'
                  : isAligned
                  ? 'bg-gradient-to-tr from-emerald-500 to-green-300 text-black border-4 border-white glow-green'
                  : 'bg-white text-gray-900 border-4 border-amber-400/60 hover:bg-gray-100'
              }`}
              title="Capture Photo (Volume Up 🔊 / Spacebar)"
            >
              <div
                className={`w-13 h-13 rounded-full flex items-center justify-center pointer-events-none transition-colors ${
                  isAligned ? 'bg-emerald-400' : 'bg-transparent'
                }`}
              >
                <Camera
                  className={`w-6 h-6 transition-colors ${
                    isCapturing
                      ? 'animate-spin text-black'
                      : isAligned
                      ? 'text-black stroke-[2.5]'
                      : 'text-gray-900'
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Flip Camera Button */}
          <div className="w-14 h-14 flex items-center justify-center">
            <button
              onClick={handleFlipClick}
              disabled={cameraSwitching}
              className="w-11 h-11 rounded-full glass-pill border border-white/20 flex items-center justify-center text-white/90 active:scale-90 transition-transform shadow-md"
              title="Switch Camera Lens"
            >
              <RotateCcw
                className={`w-5 h-5 text-emerald-400 transition-transform duration-500 ${
                  spinFlip || cameraSwitching ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
