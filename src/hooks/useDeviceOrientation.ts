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
  const manualTimeoutRef = useRef<number | null>(null);
  const lastDetectedRef = useRef<OrientationAngle>(0);

  // Auto-detect orientation from screen.orientation and accelerometer sensors
  useEffect(() => {
    let debounceTimer: number | null = null;

    const updateAngle = (newAngle: OrientationAngle) => {
      if (newAngle === lastDetectedRef.current) return;
      lastDetectedRef.current = newAngle;

      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (!isManual) {
          setAngle(newAngle);
        }
      }, 120);
    };

    // 1. Screen Orientation API (Primary standard)
    const handleScreenOrientationChange = () => {
      if (window.screen?.orientation) {
        const rawAngle = window.screen.orientation.angle;
        if (rawAngle === 90 || rawAngle === 270 || rawAngle === 180 || rawAngle === 0) {
          updateAngle(rawAngle as OrientationAngle);
          return;
        }
      }
      if (typeof window.orientation === 'number') {
        const legacyAngle = (window.orientation + 360) % 360;
        if (legacyAngle === 90 || legacyAngle === 270 || legacyAngle === 180 || legacyAngle === 0) {
          updateAngle(legacyAngle as OrientationAngle);
          return;
        }
      }
      // Viewport dimension fallback
      if (window.innerWidth > window.innerHeight) {
        updateAngle(90);
      } else {
        updateAngle(0);
      }
    };

    // 2. Physical Accelerometer / Gyroscope (Crucial when Android system auto-rotate is locked)
    const handleDeviceMotion = (event: DeviceOrientationEvent) => {
      // If screen is already detected as landscape via Screen Orientation API, honor that
      if (window.screen?.orientation && window.screen.orientation.angle !== 0) {
        const scrAngle = window.screen.orientation.angle;
        if (scrAngle === 90 || scrAngle === 270 || scrAngle === 180) {
          updateAngle(scrAngle as OrientationAngle);
          return;
        }
      }

      const { beta, gamma } = event;
      if (beta === null || gamma === null) return;

      // When phone is resting flat on table (e.g. beta < 20 and gamma < 20), keep current orientation
      if (Math.abs(beta) < 20 && Math.abs(gamma) < 20) return;

      // Landscape Left (rotated 90° counter-clockwise, top of phone to the left)
      if (gamma < -32) {
        updateAngle(90);
      }
      // Landscape Right (rotated 90° clockwise, top of phone to the right)
      else if (gamma > 32) {
        updateAngle(270);
      }
      // Upright portrait
      else if (Math.abs(gamma) <= 22) {
        if (beta < -45) {
          updateAngle(180); // Inverted portrait
        } else if (beta > -20) {
          updateAngle(0); // Normal portrait
        }
      }
    };

    // Initial check
    handleScreenOrientationChange();

    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleScreenOrientationChange);
    }
    window.addEventListener('orientationchange', handleScreenOrientationChange);
    window.addEventListener('resize', handleScreenOrientationChange);
    window.addEventListener('deviceorientation', handleDeviceMotion, { passive: true });

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleScreenOrientationChange);
      }
      window.removeEventListener('orientationchange', handleScreenOrientationChange);
      window.removeEventListener('resize', handleScreenOrientationChange);
      window.removeEventListener('deviceorientation', handleDeviceMotion);
    };
  }, [isManual]);

  const cycleOrientation = useCallback(() => {
    setIsManual(true);
    // Cycle: 0 -> 90 -> 270 -> 0
    setAngle((prev) => {
      if (prev === 0) return 90;
      if (prev === 90) return 270;
      return 0;
    });

    // Auto-resume auto-sensing after 15 seconds of inactivity
    if (manualTimeoutRef.current) window.clearTimeout(manualTimeoutRef.current);
    manualTimeoutRef.current = window.setTimeout(() => {
      setIsManual(false);
    }, 15000);
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
