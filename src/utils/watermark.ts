/**
 * Utility to generate a high-end photography watermark banner burned directly into the output photo.
 * Contains the actual megapixel of the camera used, camera sensor mode, resolution, and pose title.
 */
export async function createStampedPhoto(
  originalBlob: Blob,
  megapixelsFormatted: string,
  width: number,
  height: number,
  cameraUsed: string,
  poseTitle: string
): Promise<{ stampedBlob: Blob; stampedUrl: string }> {
  const bannerHeight = Math.max(90, Math.round(height * 0.07));
  const totalWidth = width;
  const totalHeight = height + bannerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { stampedBlob: originalBlob, stampedUrl: URL.createObjectURL(originalBlob) };
  }

  // 1. Draw the high-resolution photo from originalBlob
  try {
    const bitmap = await createImageBitmap(originalBlob);
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ('close' in bitmap && typeof (bitmap as any).close === 'function') {
      bitmap.close();
    }
  } catch {
    await new Promise<void>((resolve) => {
      const img = new Image();
      const tempUrl = URL.createObjectURL(originalBlob);
      img.onload = () => {
        URL.revokeObjectURL(tempUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        resolve();
      };
      img.src = tempUrl;
    });
  }

  // 2. Draw modern luxury camera watermark banner
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, height, totalWidth, bannerHeight);

  // Top subtle border line
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(0, height, totalWidth, Math.max(1, Math.round(bannerHeight * 0.015)));

  // 3. Proportional typography sizing
  const paddingX = Math.round(totalWidth * 0.035);
  const titleFontSize = Math.max(14, Math.round(bannerHeight * 0.28));
  const subFontSize = Math.max(10, Math.round(bannerHeight * 0.18));
  const badgeFontSize = Math.max(16, Math.round(bannerHeight * 0.35));

  const centerY = height + bannerHeight / 2;

  // --- Left Section: Brand & Camera Used ---
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = `bold ${titleFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('AI POSE CAM', paddingX, centerY - Math.round(bannerHeight * 0.04));

  ctx.textBaseline = 'top';
  ctx.font = `500 ${subFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#9ca3af';
  ctx.fillText(
    `${cameraUsed.toUpperCase()} • ${width} × ${height}`,
    paddingX,
    centerY + Math.round(bannerHeight * 0.04)
  );

  // --- Right Section: Megapixel Badge & Pose Info ---
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = `900 ${badgeFontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  ctx.fillStyle = '#10b981'; // Emerald Green
  ctx.fillText(
    `📸 ${megapixelsFormatted}`,
    totalWidth - paddingX,
    centerY - Math.round(bannerHeight * 0.04)
  );

  ctx.textBaseline = 'top';
  ctx.font = `500 ${subFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#d1d5db';
  const formattedDate = new Date().toISOString().split('T')[0];
  ctx.fillText(
    `AI DIRECTOR • ${poseTitle.toUpperCase()} • ${formattedDate}`,
    totalWidth - paddingX,
    centerY + Math.round(bannerHeight * 0.04)
  );

  // 4. Export high quality JPEG blob
  return new Promise<{ stampedBlob: Blob; stampedUrl: string }>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({
            stampedBlob: blob,
            stampedUrl: URL.createObjectURL(blob),
          });
        } else {
          resolve({ stampedBlob: originalBlob, stampedUrl: URL.createObjectURL(originalBlob) });
        }
      },
      'image/jpeg',
      0.95
    );
  });
}
