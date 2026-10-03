import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Sparkles, Image as ImageIcon, GripHorizontal, Move } from 'lucide-react';
import type { PosePreset } from '../types/camera';

interface PoseReferencePIPProps {
  currentPose: PosePreset | null;
  onOpenGallery?: () => void;
}

export const PoseReferencePIP: React.FC<PoseReferencePIPProps> = ({ currentPose }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Free-floating draggable coordinates (defaults to upper-middle left so it never covers bottom carousel)
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const defaultY = typeof window !== 'undefined' ? Math.max(75, window.innerHeight - 380) : 260;
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
    startPosY: 260,
    hasMoved: false,
  });

  // Global window pointer listeners while dragging for 100% fluid mobile & desktop tracking
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;

      if (Math.hypot(dx, dy) > 5) {
        dragRef.current.hasMoved = true;
      }

      const cardWidth = 112;
      const cardHeight = 148;
      const minX = 8;
      const maxX = Math.max(8, window.innerWidth - cardWidth - 8);
      const minY = 50; // below status bar
      const maxY = Math.max(50, window.innerHeight - cardHeight - 20); // above bottom edge

      const nextX = Math.max(minX, Math.min(maxX, dragRef.current.startPosX + dx));
      const nextY = Math.max(minY, Math.min(maxY, dragRef.current.startPosY + dy));

      setPos({ x: nextX, y: nextY });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      // If pointer was released without significant movement (<= 5px), treat as tap
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

  const hasPhoto = Boolean(currentPose.referenceImage);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Prevent drag if tapping a button (Maximize or Close)
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

  // If minimized by the user, show a movable floating pill button to restore
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
          isDragging ? 'cursor-grabbing scale-105 shadow-xl ring-2 ring-amber-400' : ''
        }`}
      >
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/90 hover:bg-black text-white text-xs font-medium border border-amber-400/80 shadow-2xl backdrop-blur-md active:scale-95 transition-all">
          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-semibold">{currentPose.title.split(' ')[0]} Ref</span>
          <Move className="w-3 h-3 text-amber-300 opacity-60 ml-0.5" />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 1. Fully Draggable Picture-in-Picture Floating Card */}
      <div
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        className={`fixed z-35 pointer-events-auto select-none touch-none transition-shadow duration-150 cursor-grab ${
          isDragging
            ? 'cursor-grabbing scale-105 shadow-[0_15px_40px_rgba(245,158,11,0.5)] ring-2 ring-amber-400'
            : 'hover:scale-102 shadow-2xl'
        }`}
      >
        <div className="relative group w-24 xs:w-28 h-32 xs:h-36 rounded-2xl bg-black/90 border-2 border-amber-400/80 overflow-hidden backdrop-blur-md flex flex-col">
          {/* Top Drag Pill Handle */}
          <div className="absolute top-1 left-1 z-20 flex items-center gap-1 bg-black/75 px-1.5 py-0.5 rounded-full text-[9px] text-amber-300 font-mono pointer-events-none shadow-sm border border-amber-400/20">
            <GripHorizontal className="w-3 h-3 text-amber-400" />
            <span className="font-bold">DRAG</span>
          </div>

          {/* Reference Image or AI Card */}
          {hasPhoto ? (
            <img
              src={currentPose.referenceImage}
              alt={currentPose.title}
              draggable={false}
              className="w-full h-full object-cover pointer-events-none select-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-amber-950/70 via-black to-zinc-950 pointer-events-none select-none">
              <Sparkles className="w-5 h-5 text-amber-400 mb-1 animate-pulse" />
              <span className="text-[10px] font-bold text-white leading-tight line-clamp-2">
                {currentPose.title}
              </span>
              <span className="text-[9px] text-amber-300/80 mt-1 uppercase tracking-wider font-mono">
                {currentPose.category}
              </span>
            </div>
          )}

          {/* Top Right Action Buttons (Enlarge / Minimize) */}
          <div className="absolute top-1 right-1 z-20 flex items-center gap-1">
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

          {/* Bottom Title Banner */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-1.5 pt-3 pointer-events-none select-none">
            <span className="text-[9px] font-bold text-amber-300 block truncate">
              {currentPose.title}
            </span>
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
            className="relative max-w-sm w-full bg-[#121218] border border-amber-400/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="text-xs font-bold text-white">{currentPose.title}</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {currentPose.category}
                </span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Photo / Visual */}
            <div className="max-h-[60vh] bg-black flex items-center justify-center overflow-hidden">
              {hasPhoto ? (
                <img
                  src={currentPose.referenceImage}
                  alt={currentPose.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="p-8 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-amber-400 mx-auto" />
                  <p className="text-sm font-semibold text-white">{currentPose.title}</p>
                  <p className="text-xs text-gray-400">{currentPose.reasoning}</p>
                </div>
              )}
            </div>

            {/* Direction Cue Footer */}
            <div className="p-4 bg-white/5 space-y-1">
              <div className="text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                <span>💡 Director Advice</span>
              </div>
              <p className="text-xs text-gray-200 leading-relaxed">{currentPose.directionTip}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
