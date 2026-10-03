import React, { useState } from 'react';
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { PosePreset } from '../types/camera';
import { DEFAULT_POSES } from '../data/defaultPoses';

interface PostureBarProps {
  currentPose: PosePreset | null;
  onSelectPose: (pose: PosePreset) => void;
  onAnalyzeScene: () => void;
  isAnalyzing: boolean;
}

const CATEGORIES = ['All', 'Downtown', 'Selfie', 'Casual', 'Stylish', 'Editorial', 'Dynamic'] as const;

export const PostureBar: React.FC<PostureBarProps> = ({
  currentPose,
  onSelectPose,
  onAnalyzeScene,
  isAnalyzing,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCollapsed, setIsCollapsed] = useState(true);


  const filteredPoses =
    selectedCategory === 'All'
      ? DEFAULT_POSES
      : DEFAULT_POSES.filter((p) => p.category === selectedCategory);

  return (
    <div className="w-full flex flex-col pointer-events-auto transition-all duration-300">
      {/* Collapse / Expand Toggle Tab */}
      <div className="flex justify-center -mb-1 z-10">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="px-3 py-0.5 rounded-t-xl bg-black/75 hover:bg-black text-gray-300 hover:text-white text-[10px] font-medium border-t border-x border-white/10 backdrop-blur-md flex items-center gap-1 active:scale-95 transition-all shadow-md"
        >
          <span>Posture Catalog</span>
          {isCollapsed ? <ChevronUp className="w-3 h-3 text-amber-400" /> : <ChevronDown className="w-3 h-3 text-amber-400" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="bg-gradient-to-t from-black/95 via-black/85 to-black/70 backdrop-blur-lg border-t border-white/10 pt-2 pb-2.5 px-2 flex flex-col gap-2 shadow-2xl">
          {/* 1. Category Filter Tabs */}
          <div className="flex items-center gap-1.5 px-1 overflow-x-auto scrollbar-none select-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-400 text-black font-bold shadow-md shadow-amber-400/20 scale-105'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 2. Horizontal Scrollable Pose Card Carousel */}
          <div className="flex items-center gap-2.5 overflow-x-auto px-1 py-1 scrollbar-none select-none">
            {/* AI Vision Director Card */}
            <button
              onClick={onAnalyzeScene}
              disabled={isAnalyzing}
              className="flex-shrink-0 w-20 h-24 rounded-2xl bg-gradient-to-br from-emerald-950/80 via-black to-slate-900 border-2 border-emerald-500/50 hover:border-emerald-400 shadow-lg flex flex-col items-center justify-center p-2 text-center group active:scale-95 transition-all relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {isAnalyzing ? (
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mb-1.5" />
              ) : (
                <Sparkles className="w-6 h-6 text-emerald-400 mb-1.5 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-[10px] font-bold text-emerald-300 leading-tight">
                {isAnalyzing ? 'Analyzing...' : 'AI Scene'}
              </span>
              <span className="text-[8px] text-gray-400 uppercase tracking-wider mt-0.5">
                Bespoke
              </span>
            </button>

            {/* Curated Posture Cards */}
            {filteredPoses.map((pose) => {
              const isSelected = currentPose?.id === pose.id;

              return (
                <button
                  key={pose.id}
                  onClick={() => onSelectPose(pose)}
                  className={`flex-shrink-0 w-20 h-24 rounded-2xl overflow-hidden relative group active:scale-95 transition-all flex flex-col border-2 shadow-lg ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105 shadow-amber-400/20'
                      : 'border-white/15 hover:border-white/40 opacity-80 hover:opacity-100'
                  }`}
                >
                  {/* Thumbnail Photo */}
                  {pose.referenceImage ? (
                    <img
                      src={pose.referenceImage}
                      alt={pose.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 to-black flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-amber-400" />
                    </div>
                  )}

                  {/* Gradient Overlay & Title */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-1.5 text-left">
                    <span className="text-[9px] font-bold text-white leading-tight truncate">
                      {pose.title}
                    </span>
                    <span className="text-[8px] text-amber-300 uppercase tracking-wider font-mono truncate">
                      {pose.category}
                    </span>
                  </div>

                  {/* Active Selection Glow Dot */}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
