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
  Timer,
  MousePointerClick,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { CameraSensorInfo, CapturedPhoto, AIPoseSuggestion } from '../types/camera';

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
  countdown?: number | null;
  countdownReason?: string | null;
  onCancelCountdown?: () => void;
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
  countdown = null,
  countdownReason = null,
  onCancelCountdown,
}) => {
  const [spinFlip, setSpinFlip] = useState(false);
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
    if (now - lastShutterTapRef.current < 400) {
      return;
    }
    lastShutterTapRef.current = now;
    onCapture();
  };

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between select-none overflow-hidden">
      {/* 1. Sleek Stock Camera Top Bar */}
      <div className="pt-[max(env(safe-area-inset-top,10px),10px)] px-3 sm:px-5 pb-3 w-full flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/85 via-black/45 to-transparent">
        {/* Left Cluster: Flash, Timer & Sensor MP */}
        <div className="flex items-center gap-1.5">
          {sensorInfo?.torchAvailable && (
            <button
              onClick={onToggleTorch}
              className={`w-9 h-9 rounded-full glass-pill flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                torchActive ? 'text-amber-400 bg-amber-500/20 border-amber-400/50' : 'text-white/80 hover:text-white'
              }`}
              title="Toggle Torch"
            >
              {torchActive ? <Zap className="w-4 h-4 fill-amber-400" /> : <ZapOff className="w-4 h-4" />}
            </button>
          )}

          {/* Self-Timer Cycle (Off, 3s, 5s) */}
          <button
            onClick={onCycleTimer}
            className={`h-9 px-2.5 rounded-full glass-pill flex items-center gap-1 text-[11px] font-bold active:scale-95 transition-all cursor-pointer ${
              timerDuration > 0
                ? 'text-amber-300 bg-amber-500/25 border-amber-400/60'
                : 'text-white/80 hover:text-white'
            }`}
            title="Cycle Timer (Off, 3s, 5s)"
          >
            <Timer className="w-3.5 h-3.5" />
            {timerDuration > 0 && <span>{timerDuration}s</span>}
          </button>

          {/* Camera Sensor Resolution Badge */}
          <button
            onClick={onToggleResolutionMode}
            className="h-9 px-2.5 rounded-full glass-pill text-[11px] font-mono font-bold text-emerald-300 border border-emerald-500/30 flex items-center gap-1 hover:border-emerald-400/60 active:scale-95 transition-all cursor-pointer"
            title="Camera Sensor Mode (Tap to cycle)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{sensorInfo ? `${sensorInfo.maxMegapixels}M` : 'RAW'}</span>
          </button>
        </div>

        {/* Center: Signature AI Pose Director Button */}
        <button
          onClick={onAnalyzeScene}
          disabled={isAnalyzing}
          className={`h-9 px-3.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer backdrop-blur-md ${
            isAnalyzing
              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-400/50 shadow-emerald-900/30'
              : 'bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:brightness-110 shadow-emerald-500/25'
          }`}
          title="Analyze scene and generate pose reference photo"
        >
          {isAnalyzing ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>{isAnalyzing ? 'Analyzing...' : 'Pose Me'}</span>
        </button>

        {/* Right Cluster: Touch-to-Snap, Grid & Settings */}
        <div className="flex items-center gap-1.5">
          {/* Touch-to-Snap Toggle */}
          <button
            onClick={onToggleTapToCapture}
            className={`w-9 h-9 rounded-full glass-pill flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              tapToCapture
                ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50'
                : 'text-white/60 hover:text-white'
            }`}
            title={tapToCapture ? 'Touch Snap: ON (Tap viewfinder to snap)' : 'Touch Snap: OFF (Tap to focus only)'}
          >
            <MousePointerClick className="w-4 h-4" />
          </button>

          {/* Composition Grid Toggle */}
          <button
            onClick={onToggleGrid}
            className={`w-9 h-9 rounded-full glass-pill flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              showGrid ? 'text-emerald-400 bg-emerald-500/20 border-emerald-500/50' : 'text-white/60 hover:text-white'
            }`}
            title="Toggle Rule-of-Thirds Grid"
          >
            <Grid className="w-4 h-4" />
          </button>

          {/* Viewfinder Framing Toggle (Fit vs Fill) */}
          {onToggleViewfinderMode && (
            <button
              onClick={onToggleViewfinderMode}
              className="w-9 h-9 rounded-full glass-pill flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95 cursor-pointer"
              title="Toggle Viewfinder Framing (Wide / Fill)"
            >
              {viewfinderMode === 'wide' ? (
                <Minimize2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-white/70" />
              )}
            </button>
          )}

          {/* Settings Cog */}
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 rounded-full glass-pill flex items-center justify-center text-white/70 hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Settings (API Key & Resolution)"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Camera Switching Indicator */}
      {cameraSwitching && (
        <div className="flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-3.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-white font-semibold text-xs flex items-center gap-1.5 shadow-xl">
            <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
            <span>Switching Lens...</span>
          </div>
        </div>
      )}

      {/* Full-Screen Selfie / Self-Timer Countdown Overlay */}
      {typeof countdown === 'number' && countdown > 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-40 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          {countdownReason && (
            <div className="mb-4 px-4 py-1.5 rounded-full bg-emerald-400 text-black font-extrabold text-xs sm:text-sm tracking-wide shadow-2xl animate-bounce">
              {countdownReason}
            </div>
          )}
          <div className="text-9xl font-black text-white drop-shadow-[0_0_40px_rgba(16,185,129,0.95)] animate-ping">
            {countdown}
          </div>
          {onCancelCountdown && (
            <div className="mt-8">
              <button
                onClick={onCancelCountdown}
                className="px-5 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-md active:scale-95 transition-all border border-white/20 shadow-lg cursor-pointer"
              >
                Cancel ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Stock Camera Bottom Deck: Pose Pill + Zoom + Shutter Row */}
      <div className="flex flex-col gap-2.5 pointer-events-auto w-full pb-[max(env(safe-area-inset-bottom,20px),20px)] bg-gradient-to-t from-black via-black/85 to-transparent pt-4">
        {/* Dynamic Pose Coaching Pill */}
        {currentPose && (
          <div className="flex flex-col items-center pointer-events-none px-4">
            <div className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-emerald-500/35 text-emerald-100 shadow-xl flex items-center gap-2 max-w-[94%]">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-[11px] font-medium truncate">
                <strong className="text-emerald-300 font-semibold">{currentPose.title}:</strong>{' '}
                <span className="text-gray-200">{currentPose.directionTip}</span>
              </span>
            </div>
          </div>
        )}

        {/* Stock Smartphone Zoom Dial (.6x, 1x, 2x) */}
        <div className="flex items-center justify-center gap-1.5 py-0.5 pointer-events-auto">
          <div className="flex items-center bg-black/60 backdrop-blur-md rounded-full p-0.5 border border-white/10 shadow-lg">
            {[0.6, 1.0, 2.0].map((z) => {
              const isActive = (sensorInfo?.zoomCurrent || 1.0) === z || (z === 1.0 && !sensorInfo?.zoomCurrent);
              return (
                <button
                  key={z}
                  onClick={() => onSetZoom?.(z)}
                  className={`w-9 h-7 rounded-full text-[11px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/25 scale-105'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  title={`Switch camera zoom to ${z}x`}
                >
                  {z === 0.6 ? '.6' : `${z}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Stock Shutter Row: Gallery | Stock Shutter | Camera Flip */}
        <div className="w-full px-8 pt-1 flex items-center justify-between max-w-sm mx-auto">
          {/* Gallery Button */}
          <div className="w-14 flex items-center justify-start">
            {lastPhoto ? (
              <button
                onClick={onOpenGallery}
                className="w-[50px] h-[50px] rounded-full overflow-hidden border-2 border-white/70 shadow-lg active:scale-90 transition-transform relative group cursor-pointer"
                title="View Gallery"
              >
                <img src={lastPhoto.url} alt="Last capture" className="w-full h-full object-cover" />
              </button>
            ) : (
              <div className="w-[50px] h-[50px] rounded-full border border-white/20 bg-white/10 backdrop-blur-md flex items-center justify-center opacity-60">
                <Camera className="w-5 h-5 text-gray-300" />
              </div>
            )}
          </div>

          {/* Dual-Ring Stock Camera Shutter Button */}
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onTouchStart={handleShutterTrigger}
              onPointerDown={(e) => {
                if (e.pointerType !== 'touch') {
                  handleShutterTrigger(e);
                }
              }}
              onClick={handleShutterTrigger}
              disabled={isCapturing}
              className={`w-[74px] h-[74px] rounded-full flex items-center justify-center transition-all duration-100 active:scale-90 shadow-2xl relative z-10 cursor-pointer touch-manipulation select-none p-[3px] ${
                isCapturing
                  ? 'border-[3.5px] border-emerald-400 ring-2 ring-emerald-400/50'
                  : 'border-[3.5px] border-white'
              }`}
              title="Capture Photo"
            >
              <div
                className={`w-full h-full rounded-full transition-all duration-100 ${
                  isCapturing
                    ? 'bg-emerald-400 scale-90'
                    : 'bg-white active:bg-gray-200 active:scale-95 shadow-[0_0_15px_rgba(255,255,255,0.35)]'
                }`}
              />
            </button>
          </div>

          {/* Camera Lens Flip Button */}
          <div className="w-14 flex items-center justify-end">
            <button
              onClick={handleFlipClick}
              disabled={cameraSwitching}
              className="w-[50px] h-[50px] rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-90 transition-all shadow-lg hover:bg-white/20 cursor-pointer"
              title="Flip Camera (Front / Rear)"
            >
              <RotateCcw
                className={`w-5 h-5 text-white transition-transform duration-500 ${
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
