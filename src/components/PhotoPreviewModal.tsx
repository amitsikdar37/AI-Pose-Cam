import React, { useState } from 'react';
import {
  X,
  Download,
  Share2,
  Camera,
  FlipHorizontal,
} from 'lucide-react';
import type { CapturedPhoto, AIPoseSuggestion } from '../types/camera';

interface PhotoPreviewModalProps {
  photo: CapturedPhoto | null;
  onClose: () => void;
  currentPose?: AIPoseSuggestion | null;
}

export const PhotoPreviewModal: React.FC<PhotoPreviewModalProps> = ({
  photo,
  onClose,
}) => {
  const [useStamped, setUseStamped] = useState(true);
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
          text: `Captured with ${photo.cameraUsed} (${photo.width}x${photo.height}). Pose: ${photo.poseTitle}`,
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
              {photo.width} × {photo.height} ({formattedFileSize})
            </span>
          </div>
        </div>

        {/* View Controls & Close */}
        <div className="flex items-center gap-2">
          {/* Flip Horizontal Preview (Helpful for front selfies) */}
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isFlipped
                ? 'bg-amber-500 text-black font-semibold'
                : 'glass-pill text-white/80 hover:text-white'
            }`}
            title="Mirror horizontally"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{isFlipped ? 'Flipped' : 'Flip'}</span>
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
        </div>
      </div>

      {/* 3. Bottom Metadata & Action Bar */}
      <div className="p-4 glass-panel border-t border-white/10 flex flex-col gap-3 safe-area-inset">
        {/* Info Grid showing exact camera and sensor specs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
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
            <div className="text-gray-400 text-[10px] uppercase tracking-wider">Pose Reference</div>
            <div className="font-semibold text-amber-300 truncate">
              {photo.poseTitle}
            </div>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Watermark toggle */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setUseStamped(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                useStamped
                  ? 'bg-emerald-500 text-black font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🏷️ With Specs Stamp
            </button>
            <button
              onClick={() => setUseStamped(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                !useStamped
                  ? 'bg-white/20 text-white font-semibold shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Pure Photo
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="px-4 py-2.5 rounded-xl glass-pill text-white hover:bg-white/10 active:scale-95 transition-all text-xs font-semibold flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>

            <button
              onClick={() => handleDownload()}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Save HD Photo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
