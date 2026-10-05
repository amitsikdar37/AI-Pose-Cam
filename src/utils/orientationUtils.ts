import type { JointName, Point2D, PoseLandmarks, OrientationAngle } from '../types/camera';

/**
 * Rotates normalized 2D pose landmarks to match device rotation.
 * In a phone rotated 90° CCW (Landscape Left, as in taking wide photos):
 * - Head points towards the right edge of the screen (1 - y)
 * - Feet point towards the left edge of the screen
 * - Handles both front-facing mirrored and rear camera viewports seamlessly.
 */
export function getRotatedLandmarks(
  landmarks: PoseLandmarks | null | undefined,
  angle: OrientationAngle,
  isMirrored = false
): PoseLandmarks {
  if (!landmarks) return {};
  if (angle === 0) return { ...landmarks };

  const rotated: PoseLandmarks = {};

  for (const [key, pt] of Object.entries(landmarks) as [JointName, Point2D][]) {
    if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
    let rx = pt.x;
    let ry = pt.y;

    if (angle === 90) {
      // Landscape Left (Phone rotated 90° CCW):
      // In physical gravity, head is at the right edge of the display
      if (isMirrored) {
        rx = pt.y;
        ry = pt.x;
      } else {
        rx = 1 - pt.y;
        ry = pt.x;
      }
    } else if (angle === 270) {
      // Landscape Right (Phone rotated 90° CW):
      // In physical gravity, head is at the left edge of the display
      if (isMirrored) {
        rx = 1 - pt.y;
        ry = 1 - pt.x;
      } else {
        rx = pt.y;
        ry = 1 - pt.x;
      }
    } else if (angle === 180) {
      // Inverted Portrait
      rx = 1 - pt.x;
      ry = 1 - pt.y;
    }

    rotated[key] = {
      ...pt,
      x: rx,
      y: ry,
    };
  }

  return rotated;
}
