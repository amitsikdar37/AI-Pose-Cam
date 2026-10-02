import React, { useState } from 'react';
import {
  Camera,
  RotateCcw,
  Zap,
  ZapOff,
  Settings,
  Sparkles,
  Grid,
  CheckCircle2,
  RefreshCw,
  Sliders,
  FlipHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AlignmentResult, CameraSensorInfo, CapturedPhoto, PosePreset } from '../types/camera';

interface CameraHUDProps {
  currentPose: PosePreset | null;
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
  autoCaptureCountdown: number | null;
  cameraSwitching: boolean;
}

export const CameraHUD: React.FC<CameraHUDProps> = ({
  currentPose,
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
  autoCaptureCountdown,
  cameraSwitching,
}) => {
  const isAligned = alignment.isAligned;
  const score = alignment.score;
  const isFront = sensorInfo?.facingMode === 'user';

  const [spinFlip, setSpinFlip] = useState(false);
  const [showFullTips, setShowFullTips] = useState(false);

  const handleFlipClick = () => {
    setSpinFlip(true);
    onSwitchCamera();
    setTimeout(() => setSpinFlip(false), 500);
  };

  return (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-20 p-3 sm:p-4 select-none safe-area-inset">
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

      {/* 2. Top Area: Status Bar + Pinned Pose Title (Kept at the very top, NEVER blocking center view) */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        {/* Top Status Row */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Sensor resolution & Active Camera badge */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full glass-pill text-xs font-mono tracking-wider text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-bold">
                {sensorInfo?.maxMegapixels ? `${sensorInfo.maxMegapixels} MP` : 'RAW'}
              </span>
              <span className="text-[10px] text-gray-300 font-sans hidden sm:inline">
                {isFront ? 'FRONT' : 'BACK'}
              </span>
            </div>

            {/* Quick Lens Switch pill */}
            <button
              onClick={handleFlipClick}
              disabled={cameraSwitching}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full glass-pill text-[11px] font-semibold text-gray-300 hover:text-white transition-all border border-white/10 active:scale-95"
              title="Tap to toggle Front/Back Camera"
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-pill text-xs font-bold transition-all duration-300 ${
              isAligned
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400 glow-green scale-105'
                : score >= 65
                ? 'bg-amber-500/20 text-amber-300 border-amber-400'
                : 'bg-black/60 text-sky-300 border-white/10'
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

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1">
            {sensorInfo?.torchAvailable && (
              <button
                onClick={onToggleTorch}
                className={`p-2 rounded-full glass-pill transition-colors ${
                  torchActive ? 'text-amber-400 bg-amber-500/20' : 'text-white/80 hover:text-white'
                }`}
                title="Toggle Flash / Torch"
              >
                {torchActive ? <Zap className="w-4 h-4 fill-amber-400" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={onToggleGrid}
              className={`p-2 rounded-full glass-pill transition-colors ${
                showGrid ? 'text-emerald-400 bg-emerald-500/20' : 'text-white/80 hover:text-white'
              }`}
              title="Toggle Grid (Rule of Thirds)"
            >
              <Grid className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenSettings}
              className="p-2 rounded-full glass-pill text-white/80 hover:text-white transition-colors"
              title="Settings & Gemini Key"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pinned Pose Title Banner (Right below top status row, completely clear of face/torso) */}
        {currentPose && (
          <div className="flex items-center justify-center">
            <button
              onClick={onOpenPoseSelector}
              className="px-3 py-1 rounded-full glass-pill flex items-center gap-1.5 shadow-md border border-white/15 hover:border-emerald-500/40 transition-all text-xs active:scale-95"
              title="Tap to change pose preset"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="font-semibold text-white truncate max-w-[180px] xs:max-w-[240px]">
                {currentPose.title}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-emerald-300 bg-emerald-950/70 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                {currentPose.category}
              </span>
            </button>
          </div>
        )}

        {/* Camera Switching Toast */}
        {cameraSwitching && (
          <div className="flex justify-center animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-3 py-1 rounded-full bg-emerald-500/90 text-black font-semibold text-xs flex items-center gap-1.5 shadow-xl">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Switching to {isFront ? 'Front' : 'Back'} Camera...</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. Center Screen is 100% CLEAR for uninhibited subject framing and skeletal alignment! */}
      {/* Auto capture countdown overlay (non-intrusive) */}
      {autoCaptureCountdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className="text-8xl font-black text-emerald-400 drop-shadow-[0_0_35px_rgba(16,185,129,0.95)] animate-ping">
            {autoCaptureCountdown}
          </div>
        </div>
      )}

      {/* 4. Bottom Controls Section: Instructions + Action Bar + Shutter */}
      <div className="flex flex-col gap-2.5 pointer-events-auto">
        {/* Dynamic Pose Coaching Pill (Positioned right above bottom toolbar, completely out of the face area!) */}
        <div className="flex flex-col items-center pointer-events-none">
          <div
            onClick={() => setShowFullTips(!showFullTips)}
            className={`pointer-events-auto cursor-pointer px-3.5 py-1.5 rounded-2xl glass-panel max-w-[94%] transition-all duration-300 shadow-xl flex flex-col gap-0.5 ${
              isAligned
                ? 'border-emerald-500/80 bg-emerald-950/85 text-emerald-200 glow-green'
                : 'border-white/15 bg-black/80 text-gray-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-wide">
                  {isAligned ? '✨ ' : '👉 '}{alignment.primaryFeedback}
                </span>
              </div>
              {currentPose?.directionTip && !isAligned && (
                <div className="text-gray-400 hover:text-white p-0.5">
                  {showFullTips ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronUp className="w-3.5 h-3.5" />
                  )}
                </div>
              )}
            </div>

            {/* Expandable / Compact Tip Text */}
            {currentPose?.directionTip && !isAligned && (
              <div
                className={`text-[11px] text-gray-300 transition-all duration-200 ${
                  showFullTips ? 'line-clamp-none pt-0.5' : 'line-clamp-1 max-w-[280px] xs:max-w-[340px]'
                }`}
              >
                💡 {currentPose.directionTip}
              </div>
            )}
          </div>
        </div>

        {/* Quick Toolbar: Analyze Scene & Choose Pose */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onAnalyzeScene}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full glass-panel text-xs font-medium text-emerald-300 hover:text-emerald-200 hover:bg-emerald-900/30 transition-all border border-emerald-500/40 shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Analyzing Scene...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>AI Analyze Scene</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenPoseSelector}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full glass-panel text-xs font-medium text-white/90 hover:text-white hover:bg-white/10 transition-all border border-white/20 shadow-lg active:scale-95"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>Pose Guide</span>
          </button>
        </div>

        {/* Main Shutter Row */}
        <div className="flex items-center justify-around px-2 sm:px-4 pb-1">
          {/* 1. Left: Gallery Thumbnail */}
          <div className="w-16 h-16 flex items-center justify-center">
            {lastPhoto ? (
              <button
                onClick={onOpenGallery}
                className="w-13 h-13 rounded-2xl overflow-hidden border-2 border-emerald-400/80 shadow-md active:scale-90 transition-transform relative group"
                title="View Captured Photo"
              >
                <img
                  src={lastPhoto.url}
                  alt="Last capture"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent" />
                <span className="absolute bottom-0.5 right-1 text-[8px] font-mono font-bold bg-black/75 text-emerald-300 px-1 rounded">
                  {lastPhoto.megapixelsFormatted}
                </span>
              </button>
            ) : (
              <div className="w-12 h-12 rounded-2xl border border-white/20 glass-pill flex items-center justify-center opacity-40">
                <Camera className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </div>

          {/* 2. Center: Ergonomic Shutter Button */}
          <div className="relative flex items-center justify-center">
            {/* Outer alignment pulsating ring */}
            <div
              className={`absolute w-22 h-22 rounded-full border-2 transition-all duration-500 ${
                isAligned
                  ? 'border-emerald-400 animate-pulse scale-105 glow-green'
                  : 'border-white/30'
              }`}
            />

            {/* Inner Shutter trigger */}
            <button
              onClick={onCapture}
              className={`w-18 h-18 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-2xl ${
                isAligned
                  ? 'bg-gradient-to-tr from-emerald-500 to-green-300 text-black border-4 border-white glow-green animate-pulse'
                  : 'bg-white text-gray-900 border-4 border-black/40 hover:bg-gray-100'
              }`}
              title="Capture Full Sensor Photo"
            >
              <div
                className={`w-15 h-15 rounded-full flex items-center justify-center transition-colors ${
                  isAligned ? 'bg-emerald-400' : 'bg-transparent'
                }`}
              >
                <Camera
                  className={`w-7 h-7 transition-colors ${
                    isAligned ? 'text-black stroke-[2.5]' : 'text-gray-900'
                  }`}
                />
              </div>
            </button>
          </div>

          {/* 3. Right: Prominent Front / Back Camera Switch Button */}
          <div className="w-16 h-16 flex items-center justify-center">
            <button
              onClick={handleFlipClick}
              disabled={cameraSwitching}
              className="flex flex-col items-center justify-center w-13 h-13 rounded-2xl glass-panel hover:bg-white/10 active:scale-90 transition-all border border-white/20 shadow-xl group"
              title={`Switch Camera (Currently: ${isFront ? 'Front' : 'Back'})`}
            >
              <div className="relative flex items-center justify-center">
                <RotateCcw
                  className={`w-5 h-5 text-emerald-400 transition-transform duration-500 ${
                    spinFlip || cameraSwitching ? 'rotate-180' : 'group-hover:rotate-45'
                  }`}
                />
                <FlipHorizontal className="w-2.5 h-2.5 text-white absolute -bottom-1 -right-1 opacity-70" />
              </div>
              <span className="text-[9px] font-bold text-gray-200 uppercase tracking-wider mt-0.5">
                {isFront ? 'Front' : 'Back'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
