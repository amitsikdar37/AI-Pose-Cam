import { useState, useEffect, useRef, useCallback } from 'react';

export type OrientationAngle = 0 | 90 | 180 | 270;

export interface DeviceOrientationState {
  angle: OrientationAngle;
  isLandscape: boolean;
  isManual: boolean;
  cycleOrientation: () => void;
  setOrientation: (angle: OrientationAngle) => void;
  resetToAuto: () => void;
}

export function useDeviceOrientation(): DeviceOrientationState {
  const [angle, setAngle] = useState<OrientationAngle>(0);
  const [isManual, setIsManual] = useState(false);
  const lastDetectedRef = useRef<OrientationAngle>(0);

  // Auto-detect orientation from standard Screen Orientation API and viewport resize events ONLY.
  // We strictly avoid noisy raw accelerometer (deviceorientation gamma/beta) listeners
  // which falsely trigger landscape rotation when holding the phone upright for selfies!
  useEffect(() => {
    let debounceTimer: number | null = null;

    const updateAngle = (newAngle: OrientationAngle) => {
      lastDetectedRef.current = newAngle;

      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (!isManual) {
          setAngle(newAngle);
        }
      }, 100);
    };

    const handleScreenOrientationChange = () => {
      // 1. Standard Screen Orientation API
      if (window.screen?.orientation) {
        const rawAngle = window.screen.orientation.angle;
        if (rawAngle === 90 || rawAngle === 270 || rawAngle === 180 || rawAngle === 0) {
          updateAngle(rawAngle as OrientationAngle);
          return;
        }
      }

      // 2. Legacy window.orientation (iOS Safari)
      if (typeof window.orientation === 'number') {
        const legacyAngle = (window.orientation + 360) % 360;
        if (legacyAngle === 90 || legacyAngle === 270 || legacyAngle === 180 || legacyAngle === 0) {
          updateAngle(legacyAngle as OrientationAngle);
          return;
        }
      }

      // 3. Viewport dimensions fallback
      if (window.innerWidth > window.innerHeight) {
        updateAngle(90);
      } else {
        updateAngle(0);
      }
    };

    // Initial orientation check
    handleScreenOrientationChange();

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleScreenOrientationChange);
    }
    window.addEventListener('orientationchange', handleScreenOrientationChange);
    window.addEventListener('resize', handleScreenOrientationChange);

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleScreenOrientationChange);
      }
      window.removeEventListener('orientationchange', handleScreenOrientationChange);
      window.removeEventListener('resize', handleScreenOrientationChange);
    };
  }, [isManual]);

  const cycleOrientation = useCallback(() => {
    setIsManual(true);
    // Cycle explicitly: Portrait (0°) -> Landscape Left (90°) -> Landscape Right (270°) -> Portrait (0°)
    setAngle((prev) => {
      if (prev === 0) return 90;
      if (prev === 90) return 270;
      return 0;
    });
  }, []);

  const setOrientation = useCallback((newAngle: OrientationAngle) => {
    setIsManual(true);
    setAngle(newAngle);
  }, []);

  const resetToAuto = useCallback(() => {
    setIsManual(false);
    setAngle(lastDetectedRef.current);
  }, []);

  return {
    angle,
    isLandscape: angle === 90 || angle === 270,
    isManual,
    cycleOrientation,
    setOrientation,
    resetToAuto,
  };
}
