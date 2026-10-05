import type { JointName, Point2D, PoseLandmarks, OrientationAngle } from '../types/camera';

/**
 * Rotates normalized 2D pose landmarks rigidly around center (0.5, 0.5) to match device rotation.
 * In a phone rotated 90° (Landscape Left):
 * - Head (y < 0.5) points towards the right edge of the screen
 * - Feet (y > 0.5) point towards the left edge of the screen
 * Strictly preserves positive handedness and anatomical limb geometry with zero reflection.
 */
export function getRotatedLandmarks(
  landmarks: PoseLandmarks | null | undefined,
  angle: OrientationAngle,
  _isMirrored = false
): PoseLandmarks {
  if (!landmarks) return {};
  if (angle === 0) return { ...landmarks };

  const rotated: PoseLandmarks = {};

  for (const [key, pt] of Object.entries(landmarks) as [JointName, Point2D][]) {
    if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') continue;
    let rx = pt.x;
    let ry = pt.y;

    if (angle === 90) {
      // 90° Clockwise rigid rotation: (x, y) -> (1 - y, x)
      rx = 1 - pt.y;
      ry = pt.x;
    } else if (angle === 270) {
      // 270° Clockwise (90° CCW) rigid rotation: (x, y) -> (y, 1 - x)
      rx = pt.y;
      ry = 1 - pt.x;
    } else if (angle === 180) {
      // 180° Inverted: (x, y) -> (1 - x, 1 - y)
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
