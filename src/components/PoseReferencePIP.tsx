import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Sparkles, Image as ImageIcon, GripHorizontal, Move, RefreshCw, Layers } from 'lucide-react';
import type { AIPoseSuggestion } from '../types/camera';

interface PoseReferencePIPProps {
  currentPose: AIPoseSuggestion | null;
  isAnalyzing?: boolean;
  onRegeneratePose?: () => void;
  onOpenGallery?: () => void;
}

export const PoseReferencePIP: React.FC<PoseReferencePIPProps> = ({
  currentPose,
  isAnalyzing = false,
  onRegeneratePose,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(false);
  }, [currentPose?.referenceImageUrl]);

  // Free-floating draggable coordinates
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const defaultY = typeof window !== 'undefined' ? Math.max(75, window.innerHeight - 380) : 220;
    return { x: 12, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    hasMoved: boolean;
  }>({
    startX: 0,
    startY: 0,
    startPosX: 12,
    startPosY: 220,
    hasMoved: false,
  });

  // Global window pointer listeners for smooth dragging on mobile and desktop
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      if (Math.hypot(dx, dy) > 5) {
        dragRef.current.hasMoved = true;
      }

      const cardWidth = 140;
      const cardHeight = 190;
      const minX = 8;
      const maxX = Math.max(8, window.innerWidth - cardWidth - 8);
      const minY = 50;
      const maxY = Math.max(50, window.innerHeight - cardHeight - 20);

      const nextX = Math.max(minX, Math.min(maxX, dragRef.current.startPosX + dx));
      const nextY = Math.max(minY, Math.min(maxY, dragRef.current.startPosY + dy));

      setPos({ x: nextX, y: nextY });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      if (!dragRef.current.hasMoved) {
        if (isMinimized) {
          setIsMinimized(false);
        } else {
          setIsExpanded(true);
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [isDragging, isMinimized]);

  if (!currentPose) return null;

  const hasPhoto = Boolean(currentPose.referenceImageUrl);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      hasMoved: false,
    };
    setIsDragging(true);
  };

  // Minimized floating pill button
  if (isMinimized) {
    return (
      <div
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        className={`fixed z-35 pointer-events-auto select-none touch-none animate-in fade-in zoom-in-95 duration-200 cursor-grab ${
          isDragging ? 'cursor-grabbing scale-105 shadow-xl ring-2 ring-emerald-400' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/90 hover:bg-black text-white text-xs font-medium border border-emerald-400/80 shadow-2xl backdrop-blur-md active:scale-95 transition-all">
          <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold">{currentPose.title.split(' ')[0]} Ref</span>
          <Move className="w-3 h-3 text-emerald-300 opacity-60 ml-0.5" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 1. Fully Draggable Picture-in-Picture Floating Reference Card */}
      <div
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        className={`fixed z-35 pointer-events-auto select-none touch-none transition-shadow duration-150 cursor-grab ${
          isDragging
            ? 'cursor-grabbing scale-105 shadow-[0_15px_40px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400'
            : 'hover:scale-102 shadow-2xl'
        }`}
      >
        <div className="relative group w-32 xs:w-36 h-44 xs:h-48 rounded-2xl bg-black/90 border-2 border-emerald-400/80 overflow-hidden backdrop-blur-md flex flex-col">
          {/* Top Drag Pill Handle */}
          <div className="absolute top-1 left-1 z-20 flex items-center gap-1 bg-black/75 px-1.5 py-0.5 rounded-full text-[9px] text-emerald-300 font-mono pointer-events-none shadow-sm border border-emerald-400/20">
            <GripHorizontal className="w-3 h-3 text-emerald-400" />
            <span className="font-bold">POSE REF</span>
          </div>

          {/* AI Analyzing / Generating Loading Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mb-1" />
              <span className="text-[10px] font-bold text-white">Synthesizing...</span>
              <span className="text-[8px] text-gray-400">Analyzing objects</span>
            </div>
          )}

          {/* Reference Image or Fallback */}
          {hasPhoto ? (
            <>
              {!imageLoaded && !isAnalyzing && (
                <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center">
                  <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin mb-1" />
                  <span className="text-[9px] font-medium text-gray-300">Loading Photo...</span>
                </div>
              )}
              <img
                src={currentPose.referenceImageUrl}
                alt={currentPose.title}
                draggable={false}
                onLoad={() => setImageLoaded(true)}
                className={`w-full h-full object-cover pointer-events-none select-none transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-emerald-950/70 via-black to-zinc-950 pointer-events-none select-none">
              <Sparkles className="w-6 h-6 text-emerald-400 mb-1 animate-pulse" />
              <span className="text-[11px] font-bold text-white leading-tight line-clamp-2">
                {currentPose.title}
              </span>
              <span className="text-[9px] text-emerald-300/80 mt-1 uppercase tracking-wider font-mono">
                {currentPose.vibe}
              </span>
            </div>
          )}

          {/* Top Right Action Buttons (Enlarge, Regenerate, Minimize) */}
          <div className="absolute top-1 right-1 z-20 flex items-center gap-1">
            {onRegeneratePose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRegeneratePose();
                }}
                disabled={isAnalyzing}
                className="p-1 rounded-full bg-black/75 hover:bg-black text-white/80 hover:text-white transition-colors border border-white/10 active:scale-95"
                title="Generate another pose idea for this scene"
              >
                <RefreshCw className={`w-3 h-3 text-emerald-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="p-1 rounded-full bg-black/75 hover:bg-black text-white/80 hover:text-white transition-colors border border-white/10 active:scale-95"
              title="Enlarge reference photo"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(true);
              }}
              className="p-1 rounded-full bg-black/75 hover:bg-black text-white/80 hover:text-white transition-colors border border-white/10 active:scale-95"
              title="Minimize reference card"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Bottom Title & Object Badge Banner */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-1.5 pt-4 pointer-events-none select-none">
            <span className="text-[10px] font-bold text-emerald-300 block truncate">
              {currentPose.title}
            </span>
            {currentPose.sceneObjects && currentPose.sceneObjects.length > 0 && (
              <span className="text-[8px] text-gray-300 truncate block">
                🎯 {currentPose.sceneObjects.slice(0, 2).join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Expanded Full-Size Lightbox Modal */}
      {isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-sm w-full bg-[#121218] border border-emerald-400/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-xs font-bold text-white">{currentPose.title}</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  {currentPose.vibe}
                </span>
                {currentPose.generationEngine === 'gemini_vision' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    Gemini Vision
                  </span>
                )}
                {currentPose.generationEngine === 'free_ai' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Free AI
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI Generated Photo */}
            <div className="max-h-[60vh] bg-black flex items-center justify-center overflow-hidden">
              {hasPhoto ? (
                <img
                  src={currentPose.referenceImageUrl}
                  alt={currentPose.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="p-8 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-sm font-semibold text-white">{currentPose.title}</p>
                </div>
              )}
            </div>

            {/* Scene Objects Used Tags */}
            {currentPose.sceneObjects && currentPose.sceneObjects.length > 0 && (
              <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Objects:
                </span>
                {currentPose.sceneObjects.map((obj, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] text-gray-200 whitespace-nowrap"
                  >
                    {obj}
                  </span>
                ))}
              </div>
            )}

            {/* Direction Cue Footer */}
            <div className="p-4 bg-white/5 space-y-1.5 border-t border-white/10">
              <div className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                <span>💡 Pose Guidance</span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">{currentPose.directionTip}</p>
            </div>

            {/* Action Bar */}
            {onRegeneratePose && (
              <div className="p-3 bg-black/60 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => {
                    onRegeneratePose();
                    setIsExpanded(false);
                  }}
                  disabled={isAnalyzing}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-emerald-500/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>Generate Another Pose</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
