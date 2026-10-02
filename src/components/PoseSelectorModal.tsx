import React, { useState } from 'react';
import { X, Sparkles, Check, RefreshCw } from 'lucide-react';
import type { PosePreset } from '../types/camera';
import { DEFAULT_POSES } from '../data/defaultPoses';

interface PoseSelectorModalProps {
  currentPose: PosePreset | null;
  onSelectPose: (pose: PosePreset) => void;
  onAnalyzeScene: () => void;
  isAnalyzing: boolean;
  onClose: () => void;
}

const CATEGORIES = ['All', 'Streetwear', 'Editorial', 'Portrait', 'Dynamic', 'Seated'] as const;

export const PoseSelectorModal: React.FC<PoseSelectorModalProps> = ({
  currentPose,
  onSelectPose,
  onAnalyzeScene,
  isAnalyzing,
  onClose,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const filteredPoses =
    selectedCategory === 'All'
      ? DEFAULT_POSES
      : DEFAULT_POSES.filter((p) => p.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col justify-end sm:justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#121218] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-lg mx-auto max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">AI Director & Pose Guides</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Auto-Director Action Banner */}
        <div className="p-4 bg-gradient-to-r from-emerald-950/60 to-slate-900/60 border-b border-emerald-500/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-emerald-300">
                Live Scene & Context Analysis
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                AI inspects lighting, background textures, and model framing to generate a custom pose wireframe.
              </div>
            </div>
            <button
              onClick={() => {
                onAnalyzeScene();
                onClose();
              }}
              disabled={isAnalyzing}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs flex items-center gap-1.5 flex-shrink-0 active:scale-95 transition-all shadow-md shadow-emerald-500/20"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Analyze Now</span>
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-white/5 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-black font-semibold'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Poses List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredPoses.map((pose) => {
            const isSelected = currentPose?.id === pose.id;

            return (
              <div
                key={pose.id}
                onClick={() => {
                  onSelectPose(pose);
                  onClose();
                }}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-emerald-950/30 border-emerald-500/80 shadow-lg shadow-emerald-500/10'
                    : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{pose.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 font-mono">
                        {pose.category}
                      </span>
                    </div>
                    <div className="text-xs text-emerald-400 font-medium">{pose.vibe}</div>
                    <div className="text-xs text-gray-300 italic pt-1">
                      "{pose.directionTip}"
                    </div>
                  </div>

                  <div className="flex-shrink-0 mt-1">
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-black">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
