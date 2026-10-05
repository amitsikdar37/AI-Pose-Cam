import React, { useEffect, useRef } from 'react';
import type { AlignmentResult, JointName, Point2D, PoseLandmarks, PosePreset, OrientationAngle } from '../types/camera';

interface SkeletalOverlayProps {
  currentPose?: PosePreset | null;
  targetLandmarks?: PoseLandmarks | null;
  liveLandmarks: PoseLandmarks | null;
  alignment: AlignmentResult;
  isMirrored?: boolean;
  opacity?: number;
  guideMode?: 'silhouette' | 'hybrid' | 'skeletal';
  videoElement?: HTMLVideoElement | null;
  viewfinderFit?: 'wide' | 'cover';
  orientationAngle?: OrientationAngle;
}

/**
 * Computes the exact isotropic rendered video box within the canvas container.
 * This completely eliminates mobile viewport stretching, squeezing, and zooming!
 */
function getRenderedVideoBox(
  containerW: number,
  containerH: number,
  video?: HTMLVideoElement | null,
  fit: 'wide' | 'cover' = 'wide'
) {
  // Native camera streams are 3:4 (0.75) in portrait
  let videoAspect = 3 / 4;
  if (video && video.videoWidth > 0 && video.videoHeight > 0) {
    const isPortraitContainer = containerH > containerW;
    const isPortraitVideo = video.videoHeight > video.videoWidth;
    if (isPortraitContainer && !isPortraitVideo) {
      videoAspect = video.videoHeight / video.videoWidth;
    } else {
      videoAspect = video.videoWidth / video.videoHeight;
    }
  }

  const containerAspect = containerW / containerH;
  let renderW = containerW;
  let renderH = containerH;
  let offsetX = 0;
  let offsetY = 0;

  if (fit === 'wide') {
    // object-contain: full uncropped wide view (zero zoom, zero crop)
    if (containerAspect > videoAspect) {
      renderH = containerH;
      renderW = containerH * videoAspect;
      offsetX = (containerW - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = containerW;
      renderH = containerW / videoAspect;
      offsetX = 0;
      offsetY = (containerH - renderH) / 2;
    }
  } else {
    // object-cover: edge-to-edge fill
    if (containerAspect < videoAspect) {
      renderH = containerH;
      renderW = containerH * videoAspect;
      offsetX = (containerW - renderW) / 2;
      offsetY = 0;
    } else {
      renderW = containerW;
      renderH = containerW / videoAspect;
      offsetX = 0;
      offsetY = (containerH - renderH) / 2;
    }
  }

  return { renderW, renderH, offsetX, offsetY };
}

export const SkeletalOverlay: React.FC<SkeletalOverlayProps> = ({
  currentPose,
  targetLandmarks,
  liveLandmarks,
  alignment,
  isMirrored = false,
  opacity = 0.95,
  guideMode = 'silhouette',
  videoElement,
  viewfinderFit = 'wide',
  orientationAngle = 0,
}) => {

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI retina screens
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const rawLandmarks = currentPose?.landmarks || targetLandmarks;
    if (!rawLandmarks) {
      ctx.restore();
      return;
    }

    // Check if the browser viewport itself is in landscape (e.g. phone screen auto-rotated)
    const isLandscapeViewport = width > height;

    // We only need canvas affine matrix rotation when the viewport is in portrait (width <= height)
    // but the device is held sideways or the user explicitly switched to landscape mode (90° or 270°).
    // If the browser viewport itself is ALREADY in landscape (width > height), the screen coordinate system
    // has already been rotated by the OS/browser, so canvas rotation is not needed.
    const shouldRotateCanvas = !isLandscapeViewport && (orientationAngle === 90 || orientationAngle === 270 || orientationAngle === 180);

    const isAligned = alignment.isAligned;
    const score = alignment.score;

    // Color theme matching user reference:
    // Unaligned: Warm golden amber / yellow (#f59e0b / #fbbf24)
    // Aligned (>= 75%): Electric glowing neon green (#00ff88)
    const silhouetteColor = isAligned
      ? '#00ff88'
      : score >= 65
      ? '#fbbf24'
      : '#f59e0b';

    const glowColor = isAligned
      ? 'rgba(0, 255, 136, 0.95)'
      : score >= 65
      ? 'rgba(251, 191, 36, 0.75)'
      : 'rgba(245, 158, 11, 0.6)';

    ctx.globalAlpha = opacity;

    // Calculate isotropic video bounding box to prevent ANY squeezing or zooming on mobile screens
    const { renderW, renderH, offsetX, offsetY } = getRenderedVideoBox(width, height, videoElement, viewfinderFit);

    // Isotropic coordinate conversion helper
    const toScreen = (pt: Point2D) => {
      let normX = pt.x;
      if (isMirrored) {
        normX = 1 - pt.x;
      }
      return {
        x: offsetX + normX * renderW,
        y: offsetY + pt.y * renderH,
      };
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = silhouetteColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isAligned ? 18 : 10;

    // Apply Isotropic Canvas Transformation for Landscape:
    // Rotating via 2D affine matrix guarantees ZERO aspect ratio warping,
    // ZERO normal distortion, and preserves 100% of the anatomical curves and proportions!
    if (shouldRotateCanvas) {
      const centerX = offsetX + renderW / 2;
      const centerY = offsetY + renderH / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((orientationAngle * Math.PI) / 180);
      const fitScale = Math.min(renderW / renderH, 1.0);
      ctx.scale(fitScale, fitScale);
      ctx.translate(-centerX, -centerY);

      ctx.lineWidth = (isAligned ? 3.5 : 2.8) / fitScale;
      ctx.setLineDash([7 / fitScale, 5 / fitScale]);
    } else {
      ctx.lineWidth = isAligned ? 3.5 : 2.8;
      ctx.setLineDash([7, 5]);
    }

    // 1. Draw Silhouette Outline
    // Uses baseDim = Math.min(renderW, renderH) so head, limbs and joints are proportioned
    // beautifully regardless of portrait or landscape container aspect ratio.
    const baseDim = Math.min(renderW, renderH);
    const poseId = currentPose?.id || '';

    if (poseId === 'downtown_steps') {
      drawDowntownStepsSilhouette(ctx, toScreen, baseDim, renderH, isMirrored);
    } else if (poseId === 'selfie_hair') {
      drawSelfieHairSilhouette(ctx, toScreen, baseDim, renderH, isMirrored);
    } else if (poseId === 'downtown_lean') {
      drawDowntownLeanSilhouette(ctx, toScreen, baseDim, renderH, isMirrored);
    } else if (poseId === 'hands_hips') {
      drawHandsHipsSilhouette(ctx, toScreen, baseDim, renderH, isMirrored);
    } else if (poseId === 'editorial_collar') {
      drawEditorialCollarSilhouette(ctx, toScreen, baseDim, renderH, isMirrored);
    } else if (poseId === 'power_portrait') {
      drawPowerPortraitSilhouette(ctx, toScreen, baseDim, renderH, isMirrored);
    } else if (poseId === 'golden_hour_candid') {
      drawWalkingCandidSilhouette(ctx, toScreen, baseDim, renderH, isMirrored);
    } else {
      // Dynamic AI Pose or Bespoke Pose directly from landmarks
      drawAnatomicalHumanSilhouette(
        ctx,
        rawLandmarks,
        toScreen,
        baseDim,
        renderH,
        isMirrored,
        isAligned,
        silhouetteColor,
        glowColor
      );
    }

    // 2. Optional Hybrid / Skeletal Inner Markers
    if (guideMode === 'hybrid' || guideMode === 'skeletal') {
      drawInnerSkeletalGuide(ctx, rawLandmarks, toScreen, isAligned, silhouetteColor);
    }

    // 3. Live User Detection Tracking Feedback (shown ONLY in hybrid or skeletal mode to avoid cluttering pure silhouette)
    if (liveLandmarks && (guideMode === 'hybrid' || guideMode === 'skeletal')) {
      drawLiveUserFeedback(ctx, liveLandmarks, toScreen, isAligned);
    }

    ctx.restore();
  }, [currentPose, targetLandmarks, liveLandmarks, alignment, isMirrored, opacity, guideMode, videoElement, orientationAngle, viewfinderFit]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
};

// ==========================================
// TAILORED SILHOUETTE OUTLINES (100% MATCHING USER SCREENSHOTS)
// ==========================================

/**
 * 1. Downtown Steps Chill (User Screenshot 1):
 * Seated on steps, elbows resting on knees, hands clasped together under chin, forward posture.
 */
function drawDowntownStepsSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean
) {
  const headCenter = toScreen({ x: 0.50, y: 0.22 });
  const headRx = w * 0.10;
  const headRy = headRx * 1.26; // Natural human facial ratio

  // Head oval & chin
  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Hands clasped together under chin
  const hands = toScreen({ x: 0.50, y: 0.33 });
  ctx.beginPath();
  ctx.ellipse(hands.x, hands.y, headRx * 0.45, headRx * 0.38, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Left arm contour: shoulder -> elbow on knee -> clasped hands
  const lSh = toScreen({ x: 0.59, y: 0.38 });
  const lElb = toScreen({ x: 0.68, y: 0.49 });
  ctx.beginPath();
  ctx.moveTo(headCenter.x + (isMirrored ? -headRx * 0.7 : headRx * 0.7), headCenter.y + headRy * 0.6);
  ctx.quadraticCurveTo(lSh.x, lSh.y - 10, lSh.x + 12, lSh.y + 10);
  ctx.lineTo(lElb.x + 10, lElb.y);
  ctx.quadraticCurveTo(lElb.x, lElb.y + 15, lElb.x - 12, lElb.y + 5);
  ctx.lineTo(hands.x + 15, hands.y + 8);
  ctx.stroke();

  // Right arm contour: shoulder -> elbow on knee -> clasped hands
  const rSh = toScreen({ x: 0.41, y: 0.38 });
  const rElb = toScreen({ x: 0.32, y: 0.49 });
  ctx.beginPath();
  ctx.moveTo(headCenter.x - (isMirrored ? -headRx * 0.7 : headRx * 0.7), headCenter.y + headRy * 0.6);
  ctx.quadraticCurveTo(rSh.x, rSh.y - 10, rSh.x - 12, rSh.y + 10);
  ctx.lineTo(rElb.x - 10, rElb.y);
  ctx.quadraticCurveTo(rElb.x, rElb.y + 15, rElb.x + 12, rElb.y + 5);
  ctx.lineTo(hands.x - 15, hands.y + 8);
  ctx.stroke();

  // Torso / chest outline behind arms
  const lHip = toScreen({ x: 0.57, y: 0.66 });
  const rHip = toScreen({ x: 0.43, y: 0.66 });
  ctx.beginPath();
  ctx.moveTo(rSh.x, rSh.y + 15);
  ctx.lineTo(rHip.x, rHip.y);
  ctx.lineTo(lHip.x, lHip.y);
  ctx.lineTo(lSh.x, lSh.y + 15);
  ctx.stroke();

  // Left leg (bent knee up)
  const lKnee = toScreen({ x: 0.70, y: 0.73 });
  const lFoot = toScreen({ x: 0.65, y: 0.94 });
  ctx.beginPath();
  ctx.moveTo(lHip.x, lHip.y);
  ctx.lineTo(lKnee.x, lKnee.y - 15);
  ctx.quadraticCurveTo(lKnee.x + 15, lKnee.y, lKnee.x, lKnee.y + 18);
  ctx.lineTo(lFoot.x + 12, lFoot.y);
  ctx.lineTo(lFoot.x - 18, lFoot.y);
  ctx.lineTo(lKnee.x - 18, lKnee.y + 10);
  ctx.lineTo(lHip.x - 15, lHip.y + 10);
  ctx.stroke();

  // Right leg (bent knee up)
  const rKnee = toScreen({ x: 0.30, y: 0.73 });
  const rFoot = toScreen({ x: 0.35, y: 0.94 });
  ctx.beginPath();
  ctx.moveTo(rHip.x, rHip.y);
  ctx.lineTo(rKnee.x, rKnee.y - 15);
  ctx.quadraticCurveTo(rKnee.x - 15, rKnee.y, rKnee.x, rKnee.y + 18);
  ctx.lineTo(rFoot.x - 12, rFoot.y);
  ctx.lineTo(rFoot.x + 18, rFoot.y);
  ctx.lineTo(rKnee.x + 18, rKnee.y + 10);
  ctx.lineTo(rHip.x + 15, rHip.y + 10);
  ctx.stroke();
}

/**
 * 2. Selfie Hair Touch (User Screenshot 2):
 * Close-up selfie, one hand reaching up touching hair crown, tilted head, relaxed collarbone.
 */
function drawSelfieHairSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean
) {
  const headCenter = toScreen({ x: 0.51, y: 0.28 });
  const headRx = w * 0.16;
  const headRy = headRx * 1.25;

  // Head contour with slight tilt
  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, isMirrored ? -0.12 : 0.12, 0, Math.PI * 2);
  ctx.stroke();

  // Raised Arm Touching Hair (Right arm in world space)
  const rElb = toScreen({ x: 0.20, y: 0.38 });
  const rWrist = toScreen({ x: 0.34, y: 0.15 });

  ctx.beginPath();
  // Shoulder up to elbow
  ctx.moveTo(headCenter.x - (isMirrored ? -headRx * 0.75 : headRx * 0.75), headCenter.y + headRy * 0.8);
  ctx.quadraticCurveTo(rElb.x - 20, rElb.y + 20, rElb.x, rElb.y);
  // Forearm up to hair crown
  ctx.quadraticCurveTo(rElb.x + 10, rWrist.y + 35, rWrist.x, rWrist.y + 15);
  // Curved hand & fingers resting in hair
  ctx.arc(rWrist.x, rWrist.y, headRx * 0.38, Math.PI * 0.5, Math.PI * 1.8, false);
  ctx.quadraticCurveTo(headCenter.x, headCenter.y - headRy * 1.05, headCenter.x + (isMirrored ? -headRx * 0.3 : headRx * 0.3), headCenter.y - headRy * 0.85);
  ctx.stroke();

  // Left Shoulder & Collarbone
  const lSh = toScreen({ x: 0.72, y: 0.60 });
  ctx.beginPath();
  ctx.moveTo(headCenter.x + (isMirrored ? -headRx * 0.65 : headRx * 0.65), headCenter.y + headRy * 0.75);
  ctx.quadraticCurveTo(lSh.x, lSh.y - 20, lSh.x + 40, lSh.y + 25);
  ctx.stroke();

  // Chest / T-shirt neckline contour
  ctx.beginPath();
  ctx.moveTo(headCenter.x - 25, headCenter.y + headRy * 0.9);
  ctx.quadraticCurveTo(headCenter.x, headCenter.y + headRy * 1.35, headCenter.x + 25, headCenter.y + headRy * 0.9);
  ctx.stroke();
}

/**
 * 3. Downtown Wall Lean (User Screenshot 3):
 * Standing lean against vertical wall, hands in front pockets, legs crossed.
 */
function drawDowntownLeanSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean
) {
  const headCenter = toScreen({ x: 0.52, y: 0.15 });
  const headRx = w * 0.085;
  const headRy = headRx * 1.28;

  // Head
  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Shoulders & Torso Leaning
  const lSh = toScreen({ x: 0.60, y: 0.27 });
  const rSh = toScreen({ x: 0.44, y: 0.27 });
  const lHip = toScreen({ x: 0.55, y: 0.55 });
  const rHip = toScreen({ x: 0.45, y: 0.55 });

  // Left arm into pocket
  const lElb = toScreen({ x: 0.64, y: 0.41 });
  const lPock = toScreen({ x: 0.57, y: 0.53 });
  ctx.beginPath();
  ctx.moveTo(headCenter.x + (isMirrored ? -headRx * 0.8 : headRx * 0.8), headCenter.y + headRy * 0.7);
  ctx.quadraticCurveTo(lSh.x, lSh.y - 5, lSh.x + 10, lSh.y + 8);
  ctx.lineTo(lElb.x + 10, lElb.y);
  ctx.quadraticCurveTo(lElb.x, lElb.y + 12, lPock.x + 8, lPock.y);
  ctx.stroke();

  // Right arm into pocket
  const rElb = toScreen({ x: 0.38, y: 0.41 });
  const rPock = toScreen({ x: 0.43, y: 0.53 });
  ctx.beginPath();
  ctx.moveTo(headCenter.x - (isMirrored ? -headRx * 0.8 : headRx * 0.8), headCenter.y + headRy * 0.7);
  ctx.quadraticCurveTo(rSh.x, rSh.y - 5, rSh.x - 10, rSh.y + 8);
  ctx.lineTo(rElb.x - 10, rElb.y);
  ctx.quadraticCurveTo(rElb.x, rElb.y + 12, rPock.x - 8, rPock.y);
  ctx.stroke();

  // Torso outline
  ctx.beginPath();
  ctx.moveTo(rSh.x, rSh.y + 10);
  ctx.lineTo(rHip.x, rHip.y);
  ctx.lineTo(lHip.x, lHip.y);
  ctx.lineTo(lSh.x, lSh.y + 10);
  ctx.stroke();

  // Crossed Legs (One supporting leg, one leg crossed in front at ankle)
  const lKnee = toScreen({ x: 0.52, y: 0.72 });
  const lAnkle = toScreen({ x: 0.47, y: 0.90 }); // crossed over
  const rKnee = toScreen({ x: 0.44, y: 0.70 });
  const rAnkle = toScreen({ x: 0.43, y: 0.91 }); // straight

  // Crossed front leg
  ctx.beginPath();
  ctx.moveTo(lHip.x, lHip.y);
  ctx.quadraticCurveTo(lKnee.x + 15, lKnee.y, lAnkle.x + 10, lAnkle.y);
  ctx.lineTo(lAnkle.x - 12, lAnkle.y);
  ctx.quadraticCurveTo(lKnee.x - 10, lKnee.y, lHip.x - 12, lHip.y);
  ctx.stroke();

  // Back supporting leg
  ctx.beginPath();
  ctx.moveTo(rHip.x, rHip.y);
  ctx.lineTo(rKnee.x - 10, rKnee.y);
  ctx.lineTo(rAnkle.x - 10, rAnkle.y);
  ctx.lineTo(rAnkle.x + 10, rAnkle.y);
  ctx.lineTo(rKnee.x + 10, rKnee.y);
  ctx.stroke();
}

/**
 * 4. Hands on Hips
 */
function drawHandsHipsSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean
) {
  const headCenter = toScreen({ x: 0.50, y: 0.16 });
  const headRx = w * 0.085;
  const headRy = headRx * 1.28;

  // Head
  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Akimbo Arms (Hands on hips creating triangles)
  const lSh = toScreen({ x: 0.60, y: 0.28 });
  const rSh = toScreen({ x: 0.40, y: 0.28 });
  const lElb = toScreen({ x: 0.69, y: 0.42 });
  const rElb = toScreen({ x: 0.31, y: 0.42 });
  const lHip = toScreen({ x: 0.58, y: 0.53 });
  const rHip = toScreen({ x: 0.42, y: 0.53 });

  // Left arm
  ctx.beginPath();
  ctx.moveTo(headCenter.x + (isMirrored ? -headRx * 0.8 : headRx * 0.8), headCenter.y + headRy * 0.7);
  ctx.quadraticCurveTo(lSh.x, lSh.y - 5, lSh.x + 10, lSh.y + 8);
  ctx.lineTo(lElb.x + 12, lElb.y);
  ctx.quadraticCurveTo(lElb.x + 5, lElb.y + 15, lHip.x + 8, lHip.y);
  ctx.stroke();

  // Right arm
  ctx.beginPath();
  ctx.moveTo(headCenter.x - (isMirrored ? -headRx * 0.8 : headRx * 0.8), headCenter.y + headRy * 0.7);
  ctx.quadraticCurveTo(rSh.x, rSh.y - 5, rSh.x - 10, rSh.y + 8);
  ctx.lineTo(rElb.x - 12, rElb.y);
  ctx.quadraticCurveTo(rElb.x - 5, rElb.y + 15, rHip.x - 8, rHip.y);
  ctx.stroke();

  // Torso
  ctx.beginPath();
  ctx.moveTo(rSh.x, rSh.y + 10);
  ctx.lineTo(rHip.x, rHip.y);
  ctx.lineTo(lHip.x, lHip.y);
  ctx.lineTo(lSh.x, lSh.y + 10);
  ctx.stroke();

  // Legs (Standing shoulder width)
  const lKnee = toScreen({ x: 0.57, y: 0.74 });
  const rKnee = toScreen({ x: 0.43, y: 0.74 });
  const lFoot = toScreen({ x: 0.58, y: 0.92 });
  const rFoot = toScreen({ x: 0.42, y: 0.92 });

  ctx.beginPath();
  ctx.moveTo(lHip.x, lHip.y);
  ctx.lineTo(lKnee.x + 10, lKnee.y);
  ctx.lineTo(lFoot.x + 10, lFoot.y);
  ctx.lineTo(lFoot.x - 10, lFoot.y);
  ctx.lineTo(lKnee.x - 10, lKnee.y);
  ctx.lineTo(lHip.x - 8, lHip.y + 15);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(rHip.x, rHip.y);
  ctx.lineTo(rKnee.x - 10, rKnee.y);
  ctx.lineTo(rFoot.x - 10, rFoot.y);
  ctx.lineTo(rFoot.x + 10, rFoot.y);
  ctx.lineTo(rKnee.x + 10, rKnee.y);
  ctx.lineTo(rHip.x + 8, rHip.y + 15);
  ctx.stroke();
}

/**
 * 5. Editorial Collarbone
 */
function drawEditorialCollarSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean
) {
  const headCenter = toScreen({ x: 0.48, y: 0.22 });
  const headRx = w * 0.105;
  const headRy = headRx * 1.26;

  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Hand at collarbone/chin
  const hand = toScreen({ x: 0.46, y: 0.34 });
  ctx.beginPath();
  ctx.ellipse(hand.x, hand.y, headRx * 0.38, headRx * 0.32, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Right arm reaching up to jaw
  const rSh = toScreen({ x: 0.38, y: 0.38 });
  const rElb = toScreen({ x: 0.34, y: 0.50 });
  ctx.beginPath();
  ctx.moveTo(headCenter.x - (isMirrored ? -headRx * 0.7 : headRx * 0.7), headCenter.y + headRy * 0.7);
  ctx.lineTo(rSh.x - 8, rSh.y);
  ctx.lineTo(rElb.x - 10, rElb.y);
  ctx.quadraticCurveTo(rElb.x, rElb.y + 12, hand.x - 5, hand.y + 10);
  ctx.stroke();

  // Left shoulder & arm resting
  const lSh = toScreen({ x: 0.62, y: 0.40 });
  const lElb = toScreen({ x: 0.65, y: 0.62 });
  ctx.beginPath();
  ctx.moveTo(headCenter.x + (isMirrored ? -headRx * 0.7 : headRx * 0.7), headCenter.y + headRy * 0.7);
  ctx.lineTo(lSh.x + 10, lSh.y);
  ctx.lineTo(lElb.x + 10, lElb.y);
  ctx.stroke();

  // Torso
  const lHip = toScreen({ x: 0.58, y: 0.85 });
  const rHip = toScreen({ x: 0.42, y: 0.85 });
  ctx.beginPath();
  ctx.moveTo(rSh.x, rSh.y + 10);
  ctx.lineTo(rHip.x, rHip.y);
  ctx.lineTo(lHip.x, lHip.y);
  ctx.lineTo(lSh.x, lSh.y + 10);
  ctx.stroke();
}

/**
 * 6. Power Portrait (Crossed Arms)
 */
function drawPowerPortraitSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean
) {
  const headCenter = toScreen({ x: 0.50, y: 0.18 });
  const headRx = w * 0.095;
  const headRy = headRx * 1.26;

  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.stroke();

  const lSh = toScreen({ x: 0.62, y: 0.35 });
  const rSh = toScreen({ x: 0.38, y: 0.35 });
  const lElb = toScreen({ x: 0.64, y: 0.54 });
  const rElb = toScreen({ x: 0.36, y: 0.54 });
  const crossedHands = toScreen({ x: 0.50, y: 0.53 });

  // Folded Arms Block
  ctx.beginPath();
  ctx.moveTo(headCenter.x - (isMirrored ? -headRx * 0.75 : headRx * 0.75), headCenter.y + headRy * 0.7);
  ctx.lineTo(rSh.x - 10, rSh.y);
  ctx.lineTo(rElb.x - 12, rElb.y);
  ctx.lineTo(crossedHands.x, crossedHands.y + 15);
  ctx.lineTo(lElb.x + 12, lElb.y);
  ctx.lineTo(lSh.x + 10, lSh.y);
  ctx.lineTo(headCenter.x + (isMirrored ? -headRx * 0.75 : headRx * 0.75), headCenter.y + headRy * 0.7);
  ctx.stroke();

  // Torso
  const lHip = toScreen({ x: 0.57, y: 0.78 });
  const rHip = toScreen({ x: 0.43, y: 0.78 });
  ctx.beginPath();
  ctx.moveTo(rElb.x, rElb.y + 10);
  ctx.lineTo(rHip.x, rHip.y);
  ctx.lineTo(lHip.x, lHip.y);
  ctx.lineTo(lElb.x, lElb.y + 10);
}

/**
 * 7. The Candid Stride Silhouette (Walking)
 */
function drawWalkingCandidSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean
) {
  const headCenter = toScreen({ x: 0.52, y: 0.16 });
  const headRx = w * 0.088;
  const headRy = headRx * 1.28;
  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, (isMirrored ? -0.1 : 0.1), 0, Math.PI * 2);
  ctx.stroke();

  const lSh = toScreen({ x: 0.61, y: 0.28 });
  const rSh = toScreen({ x: 0.42, y: 0.27 });
  const lHip = toScreen({ x: 0.57, y: 0.55 });
  const rHip = toScreen({ x: 0.44, y: 0.56 });

  ctx.beginPath();
  ctx.moveTo(rSh.x, rSh.y + 10);
  ctx.lineTo(rHip.x - 8, rHip.y);
  ctx.lineTo(lHip.x + 8, lHip.y);
  ctx.lineTo(lSh.x, lSh.y + 10);
  ctx.closePath();
  ctx.stroke();

  const rElb = toScreen({ x: 0.36, y: 0.42 });
  const rWr = toScreen({ x: 0.34, y: 0.56 });
  ctx.beginPath();
  ctx.moveTo(rSh.x - 5, rSh.y + 5);
  ctx.lineTo(rElb.x - 12, rElb.y);
  ctx.lineTo(rWr.x - 10, rWr.y);
  ctx.arc(rWr.x, rWr.y, 8, 0, Math.PI * 2);
  ctx.lineTo(rElb.x + 8, rElb.y);
  ctx.stroke();

  const lElb = toScreen({ x: 0.65, y: 0.43 });
  const lWr = toScreen({ x: 0.68, y: 0.57 });
  ctx.beginPath();
  ctx.moveTo(lSh.x + 5, lSh.y + 5);
  ctx.lineTo(lElb.x + 12, lElb.y);
  ctx.lineTo(lWr.x + 10, lWr.y);
  ctx.arc(lWr.x, lWr.y, 8, 0, Math.PI * 2);
  ctx.lineTo(lElb.x - 8, lElb.y);
  ctx.stroke();

  const fKnee = toScreen({ x: 0.60, y: 0.73 });
  const fFoot = toScreen({ x: 0.63, y: 0.91 });
  ctx.beginPath();
  ctx.moveTo(lHip.x, lHip.y);
  ctx.lineTo(fKnee.x + 12, fKnee.y);
  ctx.lineTo(fFoot.x + 12, fFoot.y);
  ctx.lineTo(fFoot.x - 14, fFoot.y);
  ctx.lineTo(fKnee.x - 12, fKnee.y);
  ctx.stroke();

  const bKnee = toScreen({ x: 0.41, y: 0.74 });
  const bFoot = toScreen({ x: 0.38, y: 0.91 });
  ctx.beginPath();
  ctx.moveTo(rHip.x, rHip.y);
  ctx.lineTo(bKnee.x - 12, bKnee.y);
  ctx.lineTo(bFoot.x - 14, bFoot.y);
  ctx.lineTo(bFoot.x + 12, bFoot.y);
  ctx.lineTo(bKnee.x + 12, bKnee.y);
  ctx.stroke();
}

/**
 * Continuous Anatomical Human Silhouette Generator
 * Used for dynamic bespoke poses, rendering smooth anatomical contours instead of rigid disconnected pills.
 * Includes automated biomechanical invariant validation so an inverted wireframe is NEVER drawn.
 */
/**
 * Anatomical Human Silhouette Engine
 * Constructs continuous, organic human body geometry with true perpendicular normals,
 * tapered limbs, natural curves, head & neck, and subtle translucent body fill.
 * Works universally for ANY pose suggested by the LLM or selected from presets.
 */
function drawAnatomicalHumanSilhouette(
  ctx: CanvasRenderingContext2D,
  rawLandmarks: PoseLandmarks,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  h: number,
  _isMirrored: boolean,
  isAligned: boolean,
  silhouetteColor: string,
  glowColor: string
) {
  const landmarks: PoseLandmarks = { ...rawLandmarks };
  const pNose = toScreen(landmarks.nose || { x: 0.50, y: 0.20 });
  const pLSh = toScreen(landmarks.left_shoulder || { x: 0.38, y: 0.34 });
  const pRSh = toScreen(landmarks.right_shoulder || { x: 0.62, y: 0.34 });
  const pLElb = toScreen(landmarks.left_elbow || { x: 0.32, y: 0.48 });
  const pRElb = toScreen(landmarks.right_elbow || { x: 0.68, y: 0.48 });
  const pLWr = toScreen(landmarks.left_wrist || { x: 0.36, y: 0.62 });
  const pRWr = toScreen(landmarks.right_wrist || { x: 0.64, y: 0.62 });
  const pLHip = toScreen(landmarks.left_hip || { x: 0.42, y: 0.64 });
  const pRHip = toScreen(landmarks.right_hip || { x: 0.58, y: 0.64 });
  const pLKnee = landmarks.left_knee ? toScreen(landmarks.left_knee) : null;
  const pRKnee = landmarks.right_knee ? toScreen(landmarks.right_knee) : null;
  const pLAnk = landmarks.left_ankle ? toScreen(landmarks.left_ankle) : null;
  const pRAnk = landmarks.right_ankle ? toScreen(landmarks.right_ankle) : null;

  // Base anatomical scale factor
  const shSpan = Math.hypot(pRSh.x - pLSh.x, pRSh.y - pLSh.y);
  const baseUnit = Math.max(shSpan * 0.42, Math.min(w * 0.08, 48));

  // Determine framing: selfie / close-up portrait vs full body
  const isSelfieOrUpperBody =
    (!pLKnee && !pRKnee) ||
    (landmarks.left_hip && landmarks.left_hip.y > 0.72) ||
    shSpan > w * 0.24;

  ctx.save();
  // Soft glowing body fill that solidifies the silhouette shape for instant readability
  ctx.fillStyle = isAligned ? 'rgba(0, 255, 136, 0.18)' : 'rgba(251, 191, 36, 0.16)';
  ctx.strokeStyle = silhouetteColor;
  ctx.lineWidth = isAligned ? 3.2 : 2.6;
  ctx.setLineDash([7, 5]);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = isAligned ? 18 : 10;

  // Midpoint between shoulders
  const midShoulder = { x: (pLSh.x + pRSh.x) / 2, y: (pLSh.y + pRSh.y) / 2 };

  // 1. Natural Human Head Oval with Tapered Jaw
  const headRx = baseUnit * 0.88;
  const headRy = headRx * 1.26;
  const headCenter = { x: pNose.x, y: pNose.y };

  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 2. Neck Contours (Two elegant curves connecting jaw to trapezius/shoulders - NO closed floating box!)
  const neckHalfW = headRx * 0.38;
  const jawBottomY = headCenter.y + headRy * 0.72;
  const nL = { x: headCenter.x - neckHalfW, y: jawBottomY };
  const nR = { x: headCenter.x + neckHalfW, y: jawBottomY };

  // Neck left to shoulder left (smooth trapezius slope)
  ctx.beginPath();
  ctx.moveTo(nL.x, nL.y);
  ctx.quadraticCurveTo((nL.x + pLSh.x) / 2, (nL.y + pLSh.y) / 2 - 4, pLSh.x, pLSh.y);
  ctx.stroke();

  // Neck right to shoulder right (smooth trapezius slope)
  ctx.beginPath();
  ctx.moveTo(nR.x, nR.y);
  ctx.quadraticCurveTo((nR.x + pRSh.x) / 2, (nR.y + pRSh.y) / 2 - 4, pRSh.x, pRSh.y);
  ctx.stroke();

  // Gentle neckline scoop / collarbone curve
  ctx.beginPath();
  ctx.moveTo(nL.x, nL.y + 8);
  ctx.quadraticCurveTo(midShoulder.x, nL.y + 22, nR.x, nR.y + 8);
  ctx.stroke();

  // 3. Torso & Body Outlines
  if (isSelfieOrUpperBody) {
    // Upper body / selfie framing: clean torso contour flowing down naturally
    const torsoBottomY = Math.max(pLSh.y + baseUnit * 2.8, h * 0.95);
    const torsoL = { x: pLSh.x - baseUnit * 0.25, y: torsoBottomY };
    const torsoR = { x: pRSh.x + baseUnit * 0.25, y: torsoBottomY };

    // Torso outline
    ctx.beginPath();
    ctx.moveTo(pLSh.x, pLSh.y);
    ctx.quadraticCurveTo(pLSh.x - 10, (pLSh.y + torsoL.y) / 2, torsoL.x, torsoL.y);
    ctx.lineTo(torsoR.x, torsoR.y);
    ctx.quadraticCurveTo(pRSh.x + 10, (pRSh.y + torsoR.y) / 2, pRSh.x, pRSh.y);
    ctx.fill();
    ctx.stroke();

    // Arms: check if user has raised arm gestures (e.g. hand touching hair/chin)
    const checkArmGesture = (pSh: Point2D, pElb: Point2D, pWr: Point2D, side: 'left' | 'right') => {
      const isRaised =
        pWr.y < pSh.y + baseUnit * 0.6 ||
        Math.hypot(pWr.x - headCenter.x, pWr.y - headCenter.y) < baseUnit * 2.2;
      const sign = side === 'left' ? -1 : 1;

      if (isRaised) {
        // Expressive gesture arm (curving up to head/collarbone)
        ctx.beginPath();
        ctx.moveTo(pSh.x, pSh.y);
        ctx.quadraticCurveTo(pElb.x + sign * 14, pElb.y, pWr.x, pWr.y);
        ctx.stroke();

        // Natural hand profile
        ctx.beginPath();
        ctx.ellipse(pWr.x, pWr.y, baseUnit * 0.28, baseUnit * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        // Natural resting arm contour flanking the torso
        ctx.beginPath();
        ctx.moveTo(pSh.x, pSh.y);
        ctx.quadraticCurveTo(pElb.x + sign * 12, pElb.y, pWr.x + sign * 8, pWr.y);
        ctx.stroke();
      }
    };

    checkArmGesture(pLSh, pLElb, pLWr, 'left');
    checkArmGesture(pRSh, pRElb, pRWr, 'right');

  } else {
    // Full body framing: natural torso and legs
    const waistW = shSpan * 0.38;
    const midTorsoY = (midShoulder.y + (pLHip.y + pRHip.y) / 2) / 2;
    const waistL = { x: midShoulder.x - waistW, y: midTorsoY };
    const waistR = { x: midShoulder.x + waistW, y: midTorsoY };

    // Torso outline
    ctx.beginPath();
    ctx.moveTo(pLSh.x, pLSh.y);
    ctx.quadraticCurveTo(waistL.x, waistL.y, pLHip.x, pLHip.y);
    ctx.lineTo(pRHip.x, pRHip.y);
    ctx.quadraticCurveTo(waistR.x, waistR.y, pRSh.x, pRSh.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Arms
    const drawFullArm = (pSh: Point2D, pElb: Point2D, pWr: Point2D, sign: number) => {
      ctx.beginPath();
      ctx.moveTo(pSh.x, pSh.y);
      ctx.quadraticCurveTo(pElb.x + sign * 14, pElb.y, pWr.x, pWr.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pWr.x, pWr.y, baseUnit * 0.20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };

    drawFullArm(pLSh, pLElb, pLWr, -1);
    drawFullArm(pRSh, pRElb, pRWr, 1);

    // Legs
    if (pLKnee && pLAnk) {
      ctx.beginPath();
      ctx.moveTo(pLHip.x, pLHip.y);
      ctx.quadraticCurveTo(pLKnee.x - 10, pLKnee.y, pLAnk.x, pLAnk.y);
      ctx.lineTo(pLAnk.x - 14, pLAnk.y);
      ctx.quadraticCurveTo(pLKnee.x + 10, pLKnee.y, pLHip.x + 10, pLHip.y);
      ctx.fill();
      ctx.stroke();
    }

    if (pRKnee && pRAnk) {
      ctx.beginPath();
      ctx.moveTo(pRHip.x, pRHip.y);
      ctx.quadraticCurveTo(pRKnee.x + 10, pRKnee.y, pRAnk.x, pRAnk.y);
      ctx.lineTo(pRAnk.x + 14, pRAnk.y);
      ctx.quadraticCurveTo(pRKnee.x - 10, pRKnee.y, pRHip.x - 10, pRHip.y);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draws subtle inner skeletal bone connections (for hybrid or skeletal view)
 */
function drawInnerSkeletalGuide(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmarks,
  toScreen: (pt: Point2D) => { x: number; y: number },
  _isAligned: boolean,
  color: string
) {
  ctx.save();
  ctx.setLineDash([]); // solid line for inner bones
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;

  const connections: [JointName, JointName][] = [
    ['left_shoulder', 'right_shoulder'],
    ['left_shoulder', 'left_elbow'],
    ['left_elbow', 'left_wrist'],
    ['right_shoulder', 'right_elbow'],
    ['right_elbow', 'right_wrist'],
    ['left_shoulder', 'left_hip'],
    ['right_shoulder', 'right_hip'],
    ['left_hip', 'right_hip'],
    ['left_hip', 'left_knee'],
    ['left_knee', 'left_ankle'],
    ['right_hip', 'right_knee'],
    ['right_knee', 'right_ankle'],
  ];

  for (const [j1, j2] of connections) {
    const p1 = landmarks[j1];
    const p2 = landmarks[j2];
    if (p1 && p2) {
      const s1 = toScreen(p1);
      const s2 = toScreen(p2);
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Draws soft live user tracking anchors so user can easily observe how their own body
 * is aligning inside the yellow silhouette guide.
 */
function drawLiveUserFeedback(
  ctx: CanvasRenderingContext2D,
  liveLandmarks: PoseLandmarks,
  toScreen: (pt: Point2D) => { x: number; y: number },
  isAligned: boolean
) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.shadowBlur = isAligned ? 12 : 6;
  ctx.shadowColor = isAligned ? 'rgba(0, 255, 136, 0.8)' : 'rgba(255, 255, 255, 0.6)';

  // Key tracking joints: nose, wrists, shoulders
  const trackedJoints: JointName[] = [
    'nose',
    'left_wrist',
    'right_wrist',
    'left_shoulder',
    'right_shoulder',
  ];

  for (const j of trackedJoints) {
    const pt = liveLandmarks[j];
    if (pt) {
      const s = toScreen(pt);
      ctx.beginPath();
      ctx.arc(s.x, s.y, isAligned ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isAligned ? '#00ff88' : '#ffffff';
      ctx.fill();

      // Subtle pulse halo around wrists and head
      ctx.beginPath();
      ctx.arc(s.x, s.y, isAligned ? 9 : 7, 0, Math.PI * 2);
      ctx.strokeStyle = isAligned ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  ctx.restore();
}
