import React, { useState, useRef } from 'react';
import {
  Camera,
  RotateCcw,
  Zap,
  ZapOff,
  Settings,
  Grid,
  RefreshCw,
  Sparkles,
  Maximize2,
  Minimize2,
  Timer,
  Mic,
  MicOff,
  MousePointerClick,
  Hand,
} from 'lucide-react';
import type { CameraSensorInfo, CapturedPhoto, AIPoseSuggestion, OrientationAngle } from '../types/camera';

interface CameraHUDProps {
  currentPose: AIPoseSuggestion | null;
  sensorInfo: CameraSensorInfo | null;
  torchActive: boolean;
  onToggleTorch: () => void;
  onSwitchCamera: () => void;
  onCapture: () => void;
  onAnalyzeScene: () => void;
  isAnalyzing: boolean;
  onOpenSettings: () => void;
  onOpenGallery: () => void;
  lastPhoto: CapturedPhoto | null;
  showGrid: boolean;
  onToggleGrid: () => void;
  cameraSwitching: boolean;
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
  countdown?: number | null;
  countdownReason?: string | null;
  onCancelCountdown?: () => void;
  orientationAngle?: OrientationAngle;
  onCycleOrientation?: () => void;
}

export const CameraHUD: React.FC<CameraHUDProps> = ({
  currentPose,
  sensorInfo,
  torchActive,
  onToggleTorch,
  onSwitchCamera,
  onCapture,
  onAnalyzeScene,
  isAnalyzing,
  onOpenSettings,
  onOpenGallery,
  lastPhoto,
  showGrid,
  onToggleGrid,
  cameraSwitching,
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
  countdown = null,
  countdownReason = null,
  onCancelCountdown,
}) => {
  const [spinFlip, setSpinFlip] = useState(false);
  const isFront = sensorInfo?.facingMode === 'user';
  const lastShutterTapRef = useRef<number>(0);

  const handleFlipClick = () => {
    setSpinFlip(true);
    onSwitchCamera();
    setTimeout(() => setSpinFlip(false), 500);
  };

  const handleShutterTrigger = (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const now = Date.now();
    if (now - lastShutterTapRef.current < 450) {
      return;
    }
    lastShutterTapRef.current = now;
    onCapture();
  };

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between select-none">
      {/* 1. Top Bar: Sensor Badge, AI Director Trigger, Camera Tools */}
      <div className="pt-2 px-3 flex flex-col gap-2 pointer-events-auto">
        <div className="flex items-center justify-between">
          {/* Left: Sensor MP Badge & Lens Flip */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleResolutionMode}
              className="px-2.5 py-1 rounded-full glass-pill text-[11px] font-mono font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1 hover:border-emerald-400/60 active:scale-95 transition-all shadow-md cursor-pointer"
              title="Camera Sensor Mode"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{sensorInfo ? `${sensorInfo.maxMegapixels} MP` : 'RAW SENSOR'}</span>
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

          {/* Center: Prominent AI Pose Director Button */}
          <button
            onClick={onAnalyzeScene}
            disabled={isAnalyzing}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer ${
              isAnalyzing
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:from-emerald-400 hover:to-teal-300 shadow-emerald-500/25'
            }`}
            title="Analyze scene and generate bespoke pose reference image"
          >
            {isAnalyzing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isAnalyzing ? 'Analyzing Scene...' : '✨ Pose Me'}</span>
          </button>

          {/* Right: Quick Action Buttons (Flash, Grid, Aspect, Settings) */}
          <div className="flex items-center gap-1">
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
              title="Toggle Rule-of-Thirds Grid"
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              onClick={onToggleViewfinderMode}
              className="p-1.5 rounded-full glass-pill text-white/80 hover:text-white transition-colors"
              title="Toggle Viewfinder Framing"
            >
              {viewfinderMode === 'wide' ? (
                <Minimize2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-gray-400" />
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-full glass-pill text-white/80 hover:text-white transition-colors"
              title="Settings (API Key & Resolution)"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Shutter Modes Bar (Self-Timer, Tap-to-Snap, Palm, Voice Shutter) */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {/* Self-Timer */}
          <button
            onClick={onCycleTimer}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 glass-pill transition-all active:scale-95 whitespace-nowrap cursor-pointer ${
              timerDuration > 0
                ? 'bg-amber-500/25 text-amber-300 border-amber-400/60'
                : 'text-gray-400 hover:text-white border-white/10'
            }`}
            title="Self-Timer: Tap to cycle Off, 3s, 5s delay"
          >
            <Timer className="w-3.5 h-3.5" />
            <span>{timerDuration > 0 ? `${timerDuration}s` : 'Timer'}</span>
          </button>

          {/* Tap-to-Snap */}
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

          {/* Palm Gesture Shutter */}
          {onTogglePalmCapture && (
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
          )}

          {/* Voice Shutter */}
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
        </div>

        {/* Camera Switching Indicator */}
        {cameraSwitching && (
          <div className="flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-3 py-1 rounded-full bg-emerald-500/90 text-black font-semibold text-xs flex items-center gap-1.5 shadow-xl">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Switching Camera...</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Side Thumb Shutter Button (For easy one-handed selfie grip) */}
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-auto z-20">
        <button
          onClick={handleShutterTrigger}
          disabled={isCapturing}
          className="w-13 h-13 rounded-full bg-black/70 border-2 border-white/80 backdrop-blur-md flex items-center justify-center active:scale-90 transition-all shadow-2xl p-1.5 group"
          title="Quick Shutter"
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isCapturing ? 'bg-emerald-500' : 'bg-white group-active:bg-emerald-400'
            }`}
          >
            <Camera className="w-5 h-5 text-black" />
          </div>
        </button>
      </div>

      {/* Full-Screen Selfie Countdown Overlay */}
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

      {/* 2. Bottom Controls Section: Zoom + Direction Tip + Shutter Bar */}
      <div className="flex flex-col gap-1.5 pointer-events-auto">
        {/* Dynamic Pose Coaching Pill from Current Suggestion */}
        {currentPose && (
          <div className="flex flex-col items-center pointer-events-none px-3">
            <div className="pointer-events-auto px-4 py-1.5 rounded-full bg-black/85 border border-emerald-400/40 text-emerald-200 shadow-xl flex items-center gap-2 max-w-[94%]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-[11px] font-semibold truncate">
                {currentPose.title}: <span className="text-gray-300 font-normal">{currentPose.directionTip}</span>
              </span>
            </div>
          </div>
        )}

        {/* Optical / Digital Zoom Selector (.6x Ultra-Wide, 1.0x Standard, 2.0x Telephoto) */}
        <div className="flex items-center justify-center gap-2 py-0.5 pointer-events-auto">
          {[0.6, 1.0, 2.0].map((z) => (
            <button
              key={z}
              onClick={() => onSetZoom?.(z)}
              className={`px-3 py-0.5 rounded-full text-[11px] font-mono font-bold glass-pill transition-all active:scale-95 ${
                (sensorInfo?.zoomCurrent || 1.0) === z || (z === 1.0 && !sensorInfo?.zoomCurrent)
                  ? 'bg-emerald-400 text-black border-emerald-300 shadow-md shadow-emerald-400/20 scale-105'
                  : 'text-gray-300 hover:text-white border-white/10'
              }`}
              title={`Switch camera zoom to ${z}x`}
            >
              {z === 0.6 ? '.6x WIDE' : `${z}x`}
            </button>
          ))}
        </div>

        {/* Main Shutter & Hardware Controls Row */}
        <div className="bg-black/95 px-6 py-3 flex items-center justify-around border-t border-white/10">
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

          {/* Shutter Button */}
          <div className="relative flex flex-col items-center justify-center">
            <button
              type="button"
              onTouchStart={handleShutterTrigger}
              onPointerDown={(e) => {
                if (e.pointerType !== 'touch') {
                  handleShutterTrigger(e);
                }
              }}
              onClick={handleShutterTrigger}
              className={`w-18 h-18 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90 shadow-2xl relative z-10 cursor-pointer touch-manipulation select-none ${
                isCapturing
                  ? 'bg-emerald-400 text-black scale-95 ring-4 ring-emerald-300'
                  : 'bg-white text-gray-900 border-4 border-emerald-400/80 hover:bg-gray-100 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
              }`}
              title="Capture Photo (Volume Up 🔊 / Spacebar)"
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center pointer-events-none">
                <Camera
                  className={`w-7 h-7 transition-colors ${
                    isCapturing ? 'animate-spin text-black' : 'text-gray-900 stroke-[2.2]'
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
              className="w-12 h-12 rounded-full glass-pill border border-white/20 flex items-center justify-center text-white/90 active:scale-90 transition-transform shadow-md"
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
