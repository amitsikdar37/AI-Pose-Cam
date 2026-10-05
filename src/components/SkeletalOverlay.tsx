import React, { useEffect, useRef } from 'react';
import type { AlignmentResult, JointName, Point2D, PoseLandmarks, PosePreset, PoseArchetype } from '../types/camera';

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

    const landmarks = currentPose?.landmarks || targetLandmarks;
    if (!landmarks) {
      ctx.restore();
      return;
    }
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

    // Set dashed line style matching user's reference screenshots (Ulike/Posture Cam style)
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = isAligned ? 3.5 : 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = silhouetteColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isAligned ? 18 : 10;

    // 1. Draw Tailored Silhouette Outline based on Archetype and Pose ID
    const archetype = getArchetypeFromPose(currentPose);
    const leanSide = getLeanSideFromPose(currentPose);

    if (archetype === 'railing_lean') {
      drawRailingLeanSilhouette(ctx, toScreen, renderW, renderH, isMirrored, leanSide);
    } else if (archetype === 'seated_lean') {
      drawSeatedLeanSilhouette(ctx, toScreen, renderW, renderH, isMirrored, leanSide);
    } else if (archetype === 'seated_steps') {
      drawDowntownStepsSilhouette(ctx, toScreen, renderW, renderH, isMirrored);
    } else if (archetype === 'selfie_hair') {
      drawSelfieHairSilhouette(ctx, toScreen, renderW, renderH, isMirrored);
    } else if (archetype === 'wall_lean') {
      drawDowntownLeanSilhouette(ctx, toScreen, renderW, renderH, isMirrored);
    } else if (archetype === 'hands_hips') {
      drawHandsHipsSilhouette(ctx, toScreen, renderW, renderH, isMirrored);
    } else if (archetype === 'editorial_collar') {
      drawEditorialCollarSilhouette(ctx, toScreen, renderW, renderH, isMirrored);
    } else if (archetype === 'power_portrait') {
      drawPowerPortraitSilhouette(ctx, toScreen, renderW, renderH, isMirrored);
    } else if (archetype === 'walking_candid') {
      drawWalkingCandidSilhouette(ctx, toScreen, renderW, renderH, isMirrored);
    } else {
      // Universal Continuous Anatomical Human Silhouette for any custom pose
      drawContinuousAnatomicalSilhouette(ctx, landmarks, toScreen, renderW, renderH, isMirrored);
    }

    // 2. Optional Hybrid / Skeletal Inner Markers
    if (guideMode === 'hybrid' || guideMode === 'skeletal') {
      drawInnerSkeletalGuide(ctx, landmarks, toScreen, isAligned, silhouetteColor);
    }

    // 3. Draw Live User Detection Tracking Feedback (Soft glowing anchors so user sees where their body is)
    if (liveLandmarks) {
      drawLiveUserFeedback(ctx, liveLandmarks, toScreen, isAligned);
    }

    ctx.restore();
  }, [currentPose, liveLandmarks, alignment, isMirrored, opacity, guideMode, videoElement]);

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
  ctx.stroke();
}

/**
 * Helper to determine pose archetype from pose data or text keywords
 */
function getArchetypeFromPose(pose?: PosePreset | null): PoseArchetype {
  if (!pose) return 'general';
  if (pose.archetype) return pose.archetype;

  const id = (pose.id || '').toLowerCase();
  const text = `${pose.id} ${pose.title} ${pose.directionTip} ${pose.vibe} ${pose.reasoning || ''}`.toLowerCase();

  if (text.includes('railing') || text.includes('handrail') || (text.includes('stair') && text.includes('lean'))) {
    return 'railing_lean';
  }
  if (text.includes('seated') && text.includes('lean')) {
    return 'seated_lean';
  }
  if (id.includes('step') || text.includes('steps') || (text.includes('sit') && text.includes('stair'))) {
    return 'seated_steps';
  }
  if (id.includes('hair') || text.includes('hair') || text.includes('selfie')) {
    return 'selfie_hair';
  }
  if (id.includes('lean') || text.includes('wall') || text.includes('pillar') || text.includes('window')) {
    return 'wall_lean';
  }
  if (id.includes('hip') || text.includes('hip')) {
    return 'hands_hips';
  }
  if (id.includes('collar') || text.includes('collar') || text.includes('jacket')) {
    return 'editorial_collar';
  }
  if (id.includes('power') || text.includes('luminary') || text.includes('cross')) {
    return 'power_portrait';
  }
  if (id.includes('stride') || text.includes('walk') || text.includes('dynamic')) {
    return 'walking_candid';
  }
  return 'general';
}

function getLeanSideFromPose(pose?: PosePreset | null): 'left' | 'right' {
  if (pose?.leanSide) return pose.leanSide;
  const text = `${pose?.title || ''} ${pose?.directionTip || ''} ${pose?.reasoning || ''}`.toLowerCase();
  if (text.includes('left arm') || text.includes('left rail') || text.includes('left side')) {
    return 'left';
  }
  return 'right';
}

/**
 * 7. The Staircase Railing Lean:
 * Model leans against a staircase / balcony / bridge handrail.
 * Displays an environmental diagonal handrail guide line with arm resting directly on it.
 */
function drawRailingLeanSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean,
  leanSide: 'left' | 'right' = 'right'
) {
  const isRight = leanSide === 'right';

  // Head
  const headCenter = toScreen({ x: isRight ? 0.48 : 0.52, y: 0.16 });
  const headRx = w * 0.088;
  const headRy = headRx * 1.28;

  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, (isRight ? 0.08 : -0.08) * (isMirrored ? -1 : 1), 0, Math.PI * 2);
  ctx.stroke();

  // Neck lines
  ctx.beginPath();
  ctx.moveTo(headCenter.x - headRx * 0.45, headCenter.y + headRy * 0.85);
  ctx.lineTo(headCenter.x - headRx * 0.55, headCenter.y + headRy * 1.15);
  ctx.moveTo(headCenter.x + headRx * 0.45, headCenter.y + headRy * 0.85);
  ctx.lineTo(headCenter.x + headRx * 0.55, headCenter.y + headRy * 1.15);
  ctx.stroke();

  // ENVIRONMENTAL GUIDE: Staircase Railing / Handrail Diagonal Line!
  ctx.save();
  ctx.setLineDash([12, 6]);
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  if (isRight) {
    const railStart = toScreen({ x: 0.50, y: 0.32 });
    const railEnd = toScreen({ x: 0.95, y: 0.58 });
    ctx.moveTo(railStart.x, railStart.y);
    ctx.lineTo(railEnd.x, railEnd.y);
  } else {
    const railStart = toScreen({ x: 0.50, y: 0.32 });
    const railEnd = toScreen({ x: 0.05, y: 0.58 });
    ctx.moveTo(railStart.x, railStart.y);
    ctx.lineTo(railEnd.x, railEnd.y);
  }
  ctx.stroke();
  ctx.restore();

  // Shoulders & Arm resting on railing
  const railSh = toScreen({ x: isRight ? 0.58 : 0.42, y: 0.29 });
  const freeSh = toScreen({ x: isRight ? 0.38 : 0.62, y: 0.27 });
  const railElb = toScreen({ x: isRight ? 0.70 : 0.30, y: 0.40 });
  const railWr = toScreen({ x: isRight ? 0.76 : 0.24, y: 0.44 });

  // Railing Arm Contour (resting along railing)
  ctx.beginPath();
  ctx.moveTo(headCenter.x + (isRight ? headRx * 0.5 : -headRx * 0.5), headCenter.y + headRy);
  ctx.quadraticCurveTo(railSh.x, railSh.y - 10, railSh.x + (isRight ? 12 : -12), railSh.y + 5);
  ctx.lineTo(railElb.x + (isRight ? 14 : -14), railElb.y);
  ctx.lineTo(railWr.x + (isRight ? 16 : -16), railWr.y);
  ctx.quadraticCurveTo(railWr.x + (isRight ? 20 : -20), railWr.y + 12, railWr.x, railWr.y + 12);
  ctx.lineTo(railElb.x, railElb.y + 16);
  ctx.lineTo(railSh.x - (isRight ? 10 : -10), railSh.y + 20);
  ctx.stroke();

  // Free Arm (hand casually tucked in pocket)
  const freeElb = toScreen({ x: isRight ? 0.30 : 0.70, y: 0.41 });
  const freeWr = toScreen({ x: isRight ? 0.37 : 0.63, y: 0.53 });
  ctx.beginPath();
  ctx.moveTo(headCenter.x - (isRight ? headRx * 0.5 : -headRx * 0.5), headCenter.y + headRy);
  ctx.quadraticCurveTo(freeSh.x, freeSh.y - 10, freeSh.x - (isRight ? 10 : -10), freeSh.y + 5);
  ctx.lineTo(freeElb.x - (isRight ? 12 : -12), freeElb.y);
  ctx.quadraticCurveTo(freeElb.x, freeElb.y + 12, freeWr.x - (isRight ? 8 : -8), freeWr.y);
  ctx.lineTo(freeWr.x + (isRight ? 10 : -10), freeWr.y);
  ctx.lineTo(freeElb.x + (isRight ? 8 : -8), freeElb.y);
  ctx.stroke();

  // Leaning Torso
  const lHip = toScreen({ x: 0.42, y: 0.56 });
  const rHip = toScreen({ x: 0.55, y: 0.56 });
  ctx.beginPath();
  ctx.moveTo(freeSh.x, freeSh.y + 10);
  ctx.lineTo(isRight ? lHip.x : rHip.x, isRight ? lHip.y : rHip.y);
  ctx.lineTo(isRight ? rHip.x : lHip.x, isRight ? rHip.y : lHip.y);
  ctx.lineTo(railSh.x, railSh.y + 10);
  ctx.stroke();

  // Crossed Legs (One weight-bearing leg, one crossed front leg)
  const backHip = isRight ? rHip : lHip;
  const backKnee = toScreen({ x: isRight ? 0.52 : 0.48, y: 0.72 });
  const backAnkle = toScreen({ x: isRight ? 0.46 : 0.54, y: 0.92 });
  ctx.beginPath();
  ctx.moveTo(backHip.x, backHip.y);
  ctx.lineTo(backKnee.x + (isRight ? 10 : -10), backKnee.y);
  ctx.lineTo(backAnkle.x + (isRight ? 8 : -8), backAnkle.y);
  ctx.lineTo(backAnkle.x - (isRight ? 12 : -12), backAnkle.y);
  ctx.lineTo(backKnee.x - (isRight ? 10 : -10), backKnee.y);
  ctx.stroke();

  const frontHip = isRight ? lHip : rHip;
  const frontKnee = toScreen({ x: isRight ? 0.48 : 0.52, y: 0.73 });
  const frontAnkle = toScreen({ x: isRight ? 0.52 : 0.48, y: 0.91 });
  ctx.beginPath();
  ctx.moveTo(frontHip.x, frontHip.y);
  ctx.quadraticCurveTo(frontKnee.x - (isRight ? 12 : -12), frontKnee.y, frontAnkle.x - (isRight ? 10 : -10), frontAnkle.y);
  ctx.lineTo(frontAnkle.x + (isRight ? 14 : -14), frontAnkle.y);
  ctx.quadraticCurveTo(frontKnee.x + (isRight ? 12 : -12), frontKnee.y, frontHip.x + (isRight ? 10 : -10), frontHip.y);
  ctx.stroke();
}

/**
 * 8. The Seated Architectural Lean:
 * Model seated comfortably on steps / bench / ledge.
 * Displays horizontal surface guide line, asymmetric knees, and relaxed posture.
 */
function drawSeatedLeanSilhouette(
  ctx: CanvasRenderingContext2D,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  isMirrored: boolean,
  leanSide: 'left' | 'right' = 'right'
) {
  const isRight = leanSide === 'right';

  // Head
  const headCenter = toScreen({ x: isRight ? 0.48 : 0.52, y: 0.20 });
  const headRx = w * 0.092;
  const headRy = headRx * 1.28;

  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, headRx, headRy, (isRight ? 0.08 : -0.08) * (isMirrored ? -1 : 1), 0, Math.PI * 2);
  ctx.stroke();

  // ENVIRONMENTAL GUIDE: Horizontal Ledge / Step surface
  ctx.save();
  ctx.setLineDash([12, 6]);
  ctx.lineWidth = 2.0;
  ctx.globalAlpha = 0.50;
  const ledgeY = toScreen({ x: 0.50, y: 0.63 }).y;
  ctx.beginPath();
  ctx.moveTo(w * 0.15, ledgeY);
  ctx.lineTo(w * 0.85, ledgeY);
  ctx.stroke();
  ctx.restore();

  // Torso seated
  const lSh = toScreen({ x: 0.38, y: 0.34 });
  const rSh = toScreen({ x: 0.58, y: 0.35 });
  const lHip = toScreen({ x: 0.42, y: 0.62 });
  const rHip = toScreen({ x: 0.56, y: 0.62 });

  ctx.beginPath();
  ctx.moveTo(lSh.x - 10, lSh.y + 10);
  ctx.lineTo(lHip.x - 12, lHip.y);
  ctx.lineTo(rHip.x + 12, rHip.y);
  ctx.lineTo(rSh.x + 10, rSh.y + 10);
  ctx.stroke();

  // One arm resting on knee, one propped back on ledge
  const propSh = isRight ? rSh : lSh;
  const propElb = toScreen({ x: isRight ? 0.68 : 0.32, y: 0.48 });
  const propWr = toScreen({ x: isRight ? 0.72 : 0.28, y: 0.62 });

  ctx.beginPath();
  ctx.moveTo(propSh.x, propSh.y + 5);
  ctx.lineTo(propElb.x + (isRight ? 12 : -12), propElb.y);
  ctx.lineTo(propWr.x + (isRight ? 12 : -12), propWr.y);
  ctx.lineTo(propWr.x - (isRight ? 10 : -10), propWr.y);
  ctx.lineTo(propElb.x - (isRight ? 10 : -10), propElb.y);
  ctx.stroke();

  const kneeSh = isRight ? lSh : rSh;
  const kneeElb = toScreen({ x: isRight ? 0.32 : 0.68, y: 0.48 });
  const kneeWr = toScreen({ x: isRight ? 0.38 : 0.62, y: 0.58 });

  ctx.beginPath();
  ctx.moveTo(kneeSh.x, kneeSh.y + 5);
  ctx.lineTo(kneeElb.x - (isRight ? 12 : -12), kneeElb.y);
  ctx.lineTo(kneeWr.x, kneeWr.y);
  ctx.lineTo(kneeElb.x + (isRight ? 8 : -8), kneeElb.y);
  ctx.stroke();

  // Bent knee raised up (on step/ledge)
  const raisedHip = isRight ? lHip : rHip;
  const raisedKnee = toScreen({ x: isRight ? 0.35 : 0.65, y: 0.69 });
  const raisedFoot = toScreen({ x: isRight ? 0.38 : 0.62, y: 0.90 });

  ctx.beginPath();
  ctx.moveTo(raisedHip.x, raisedHip.y);
  ctx.quadraticCurveTo(raisedKnee.x - (isRight ? 16 : -16), raisedKnee.y - 12, raisedKnee.x, raisedKnee.y);
  ctx.lineTo(raisedFoot.x + (isRight ? 12 : -12), raisedFoot.y);
  ctx.lineTo(raisedFoot.x - (isRight ? 14 : -14), raisedFoot.y);
  ctx.quadraticCurveTo(raisedKnee.x + (isRight ? 14 : -14), raisedKnee.y, raisedHip.x + (isRight ? 14 : -14), raisedHip.y);
  ctx.stroke();

  // Relaxed leg extending down
  const relaxHip = isRight ? rHip : lHip;
  const relaxKnee = toScreen({ x: isRight ? 0.62 : 0.38, y: 0.76 });
  const relaxFoot = toScreen({ x: isRight ? 0.64 : 0.36, y: 0.93 });

  ctx.beginPath();
  ctx.moveTo(relaxHip.x, relaxHip.y);
  ctx.lineTo(relaxKnee.x + (isRight ? 12 : -12), relaxKnee.y);
  ctx.lineTo(relaxFoot.x + (isRight ? 12 : -12), relaxFoot.y);
  ctx.lineTo(relaxFoot.x - (isRight ? 14 : -14), relaxFoot.y);
  ctx.lineTo(relaxKnee.x - (isRight ? 12 : -12), relaxKnee.y);
  ctx.stroke();
}

/**
 * 9. The Candid Stride Silhouette (Walking)
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
function drawContinuousAnatomicalSilhouette(
  ctx: CanvasRenderingContext2D,
  rawLandmarks: PoseLandmarks,
  toScreen: (pt: Point2D) => { x: number; y: number },
  w: number,
  _h: number,
  _isMirrored: boolean
) {
  const landmarks: PoseLandmarks = { ...rawLandmarks };
  const nose = landmarks.nose;
  const lSh = landmarks.left_shoulder;
  const rSh = landmarks.right_shoulder;
  const lHip = landmarks.left_hip;
  const rHip = landmarks.right_hip;
  const lKnee = landmarks.left_knee;
  const rKnee = landmarks.right_knee;
  const lAnk = landmarks.left_ankle;
  const rAnk = landmarks.right_ankle;
  const lElb = landmarks.left_elbow;
  const rElb = landmarks.right_elbow;
  const lWr = landmarks.left_wrist;
  const rWr = landmarks.right_wrist;

  // Invariant normalization: Prevent inverted vertical geometry
  if (nose && lHip && nose.y > lHip.y) {
    nose.y = Math.min(lHip.y - 0.35, 0.20);
  }
  if (lAnk && lHip && lAnk.y < lHip.y) {
    lAnk.y = Math.max(lHip.y + 0.35, 0.90);
  }
  if (rAnk && rHip && rAnk.y < rHip.y) {
    rAnk.y = Math.max(rHip.y + 0.35, 0.90);
  }

  // 1. Head & Neck
  if (nose) {
    const head = toScreen(nose);
    const headRx = w * 0.088;
    const headRy = headRx * 1.28;
    ctx.beginPath();
    ctx.ellipse(head.x, head.y, headRx, headRy, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (lSh && rSh) {
      const pLSh = toScreen(lSh);
      const pRSh = toScreen(rSh);
      ctx.beginPath();
      ctx.moveTo(head.x - headRx * 0.45, head.y + headRy * 0.85);
      ctx.quadraticCurveTo(head.x - headRx * 0.5, pRSh.y - 5, pRSh.x, pRSh.y);
      ctx.moveTo(head.x + headRx * 0.45, head.y + headRy * 0.85);
      ctx.quadraticCurveTo(head.x + headRx * 0.5, pLSh.y - 5, pLSh.x, pLSh.y);
      ctx.stroke();
    }
  }

  // 2. Torso Contour (Smooth continuous body from shoulders to hips)
  if (lSh && rSh && lHip && rHip) {
    const pLSh = toScreen(lSh);
    const pRSh = toScreen(rSh);
    const pLHip = toScreen(lHip);
    const pRHip = toScreen(rHip);

    const midY = (pLSh.y + pLHip.y) / 2;
    const rWaistX = pRSh.x * 0.4 + pRHip.x * 0.6;
    const lWaistX = pLSh.x * 0.4 + pLHip.x * 0.6;

    ctx.beginPath();
    ctx.moveTo(pRSh.x - 5, pRSh.y);
    ctx.quadraticCurveTo(rWaistX - 10, midY, pRHip.x - 6, pRHip.y);
    ctx.lineTo(pLHip.x + 6, pLHip.y);
    ctx.quadraticCurveTo(lWaistX + 10, midY, pLSh.x + 5, pLSh.y);
    ctx.closePath();
    ctx.stroke();
  }

  // 3. Arms (Smooth continuous sleeves instead of disconnected pills)
  const armWidth = Math.max(8, w * 0.024);
  const drawArmContour = (sh: Point2D, elb: Point2D, wr: Point2D) => {
    const pSh = toScreen(sh);
    const pElb = toScreen(elb);
    const pWr = toScreen(wr);

    ctx.beginPath();
    ctx.moveTo(pSh.x, pSh.y);
    ctx.lineTo(pElb.x + armWidth * 0.8, pElb.y);
    ctx.lineTo(pWr.x + armWidth * 0.6, pWr.y);
    ctx.arc(pWr.x, pWr.y, armWidth * 0.7, 0, Math.PI * 2);
    ctx.lineTo(pElb.x - armWidth * 0.8, pElb.y);
    ctx.lineTo(pSh.x, pSh.y + armWidth);
    ctx.stroke();
  };

  if (lSh && lElb && lWr) drawArmContour(lSh, lElb, lWr);
  if (rSh && rElb && rWr) drawArmContour(rSh, rElb, rWr);

  // 4. Legs (Smooth continuous leg & foot contours)
  const legWidth = Math.max(10, w * 0.030);
  const drawLegContour = (hip: Point2D, knee: Point2D, ank: Point2D, side: 'left' | 'right') => {
    const pHip = toScreen(hip);
    const pKnee = toScreen(knee);
    const pAnk = toScreen(ank);
    const sign = side === 'right' ? 1 : -1;

    ctx.beginPath();
    ctx.moveTo(pHip.x, pHip.y);
    ctx.quadraticCurveTo(pKnee.x + sign * legWidth * 1.1, pKnee.y, pAnk.x + sign * legWidth * 0.8, pAnk.y);
    ctx.lineTo(pAnk.x + sign * (legWidth * 1.6), pAnk.y + 12);
    ctx.lineTo(pAnk.x - sign * legWidth * 0.8, pAnk.y + 12);
    ctx.quadraticCurveTo(pKnee.x - sign * legWidth * 0.7, pKnee.y, pHip.x - sign * 5, pHip.y + 10);
    ctx.stroke();
  };

  if (lHip && lKnee && lAnk) drawLegContour(lHip, lKnee, lAnk, 'left');
  if (rHip && rKnee && rAnk) drawLegContour(rHip, rKnee, rAnk, 'right');
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
