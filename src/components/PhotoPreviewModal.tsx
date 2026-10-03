import React, { useState } from 'react';
import {
  X,
  Download,
  Share2,
  CheckCircle2,
  Layers,
  Sparkles,
  Camera,
  Check,
  HardDrive,
  FlipHorizontal,
} from 'lucide-react';
import type { CapturedPhoto, PosePreset } from '../types/camera';
import { SkeletalOverlay } from './SkeletalOverlay';

interface PhotoPreviewModalProps {
  photo: CapturedPhoto | null;
  onClose: () => void;
  currentPose: PosePreset | null;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  photo,
  onClose,
  currentPose,
}) => {
  const [useStamped, setUseStamped] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<1 | 2>(1);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!photo) return null;

  const currentDisplayUrl = useStamped && photo.stampedUrl ? photo.stampedUrl : photo.url;
  const currentBlob = useStamped && photo.stampedBlob ? photo.stampedBlob : photo.blob;

  const flipBlobHorizontally = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(blob);
          return;
        }
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.95);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };
      img.src = url;
    });
  };

  const handleDownload = async (stampedOption = useStamped) => {
    const isStamped = stampedOption && photo.stampedUrl;
    let targetBlob = isStamped ? photo.stampedBlob : photo.blob;

    if (isFlipped && targetBlob) {
      targetBlob = await flipBlobHorizontally(targetBlob);
    }

    const downloadUrl = targetBlob ? URL.createObjectURL(targetBlob) : (isStamped ? photo.stampedUrl : photo.url);
    const a = document.createElement('a');
    a.href = downloadUrl;

    const mpLabel = photo.megapixelsFormatted.replace(/\s+/g, '');
    const cameraLabel = photo.facingMode === 'user' ? 'FrontCam' : 'BackCam';
    const stampSuffix = isStamped ? '_Stamped' : '_Raw';
    const flipSuffix = isFlipped ? '_Flipped' : '';

    a.download = `AIPoseCam_${cameraLabel}_${mpLabel}_${photo.width}x${photo.height}${stampSuffix}${flipSuffix}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    if (targetBlob && isFlipped) {
      URL.revokeObjectURL(downloadUrl);
    }
  };

  const handleShare = async () => {
    let targetBlob = currentBlob;
    if (isFlipped && targetBlob) {
      targetBlob = await flipBlobHorizontally(targetBlob);
    }

    if (navigator.share && targetBlob) {
      try {
        const file = new File(
          [targetBlob],
          `AIPoseCam_${photo.megapixelsFormatted.replace(' ', '')}.jpg`,
          { type: 'image/jpeg' }
        );
        await navigator.share({
          title: `Photo by AI Pose Cam — ${photo.megapixelsFormatted}`,
          text: `Captured with ${photo.cameraUsed} (${photo.width}x${photo.height}). AI Match: ${photo.alignmentScore}%!`,
          files: [file],
        });
      } catch (err) {
        console.log('Share dismissed or unsupported:', err);
      }
    } else {
      handleDownload();
    }
  };


  const formattedFileSize =
    photo.fileSizeBytes > 1024 * 1024
      ? `${(photo.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(photo.fileSizeBytes / 1024)} KB`;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
      {/* 1. Top Header */}
      <div className="flex items-center justify-between p-4 z-10 glass-panel border-b border-white/10 safe-area-inset">
        {/* Actual Megapixels and Camera Used Pill */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-mono font-black tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{photo.megapixelsFormatted}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-xs font-semibold text-gray-300">
            <Camera className="w-3.5 h-3.5 text-gray-400" />
            <span>{photo.cameraUsed}</span>
            <span className="text-gray-500">•</span>
            <span className="font-mono text-gray-400">
              {photo.width} × {photo.height}
            </span>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {/* Watermark Stamp Toggle */}
          <button
            onClick={() => setUseStamped(!useStamped)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              useStamped
                ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                : 'glass-pill text-white/80 hover:text-white'
            }`}
            title="Toggle burned-in Megapixels & Camera watermark on photo"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{useStamped ? 'MP Stamp: ON' : 'MP Stamp: OFF'}</span>
          </button>

          {/* Flip Photo Horizontal Toggle */}
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isFlipped
                ? 'bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20'
                : 'glass-pill text-white/80 hover:text-white'
            }`}
            title="Flip / Mirror photo horizontally"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{isFlipped ? 'Flipped' : 'Flip'}</span>
          </button>

          {/* AI Guide Wireframe Overlay */}
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              showOverlay
                ? 'bg-sky-500 text-black font-semibold'
                : 'glass-pill text-white/80 hover:text-white'
            }`}
            title="Toggle AI Pose Skeleton Overlay"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Guide</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-full glass-pill text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 2. Main Image Display */}
      <div className="relative flex-1 flex items-center justify-center p-2 overflow-auto touch-pan-x touch-pan-y">
        <div
          className={`relative max-w-full max-h-full transition-transform duration-200 ${
            zoomLevel === 2 ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
          }`}
          onClick={() => setZoomLevel(zoomLevel === 1 ? 2 : 1)}
        >
          <img
            src={currentDisplayUrl}
            alt="High-resolution capture"
            className={`max-h-[68vh] w-auto object-contain rounded-xl shadow-2xl border border-white/10 transition-transform duration-200 ${
              isFlipped ? '-scale-x-100' : ''
            }`}
          />


          {/* AI Skeleton Overlay on captured image */}
          {showOverlay && currentPose && (
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
              <SkeletalOverlay
                targetLandmarks={currentPose.landmarks}
                liveLandmarks={null}
                alignment={{
                  score: photo.alignmentScore,
                  isAligned: photo.alignmentScore >= 80,
                  jointErrors: {},
                  primaryFeedback: 'Target Pose Overlay',
                  alignedJointsCount: 0,
                  totalJointsCount: 0,
                }}
                opacity={0.85}
              />
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Metadata & Action Bar */}
      <div className="p-4 glass-panel border-t border-white/10 flex flex-col gap-3 safe-area-inset">
        {/* Info Grid showing exact camera and sensor specs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="glass-pill p-2 rounded-xl">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider">Actual Megapixels</div>
            <div className="font-extrabold text-emerald-400 text-sm font-mono">
              {photo.megapixelsFormatted}
            </div>
          </div>

          <div className="glass-pill p-2 rounded-xl">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider">Camera Used</div>
            <div className="font-semibold text-white truncate px-1">
              {photo.cameraUsed}
            </div>
          </div>

          <div className="glass-pill p-2 rounded-xl">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider">Resolution</div>
            <div className="font-semibold text-gray-200 font-mono">
              {photo.width} × {photo.height}
            </div>
          </div>

          <div className="glass-pill p-2 rounded-xl">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider">File Size</div>
            <div className="font-semibold text-gray-200 font-mono flex items-center justify-center gap-1">
              <HardDrive className="w-3 h-3 text-gray-400" />
              <span>{formattedFileSize}</span>
            </div>
          </div>

          <div className="glass-pill p-2 rounded-xl col-span-2 sm:col-span-1">
            <div className="text-gray-400 text-[10px] uppercase tracking-wider">AI Alignment</div>
            <div className="font-semibold text-emerald-400 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{photo.alignmentScore}% Match</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Primary Download Button */}
          <button
            onClick={() => handleDownload(useStamped)}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 transition-all text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>
              {useStamped
                ? `Download Photo (${photo.megapixelsFormatted} Stamp)`
                : `Download Clean Raw Photo (${photo.megapixelsFormatted})`}
            </span>
          </button>

          {/* Alternate Download Button */}
          <button
            onClick={() => handleDownload(!useStamped)}
            className="hidden sm:flex py-3 px-3.5 rounded-xl glass-pill hover:bg-white/10 active:scale-98 transition-all text-white/90 text-xs font-semibold items-center gap-1.5"
            title={useStamped ? 'Download Raw Unstamped Photo' : 'Download Photo with MP Watermark'}
          >
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{useStamped ? 'Download Raw' : 'Download Stamped'}</span>
          </button>

          {'share' in navigator && (
            <button
              onClick={handleShare}
              className="py-3 px-4 rounded-xl glass-pill hover:bg-white/10 active:scale-98 transition-all text-white font-semibold text-sm flex items-center justify-center gap-2"
              title="Share photo"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
