import React, { useEffect, useRef } from 'react';
import type { AlignmentResult, JointName, Point2D, PoseLandmarks } from '../types/camera';

interface SkeletalOverlayProps {
  targetLandmarks: PoseLandmarks | null;
  liveLandmarks: PoseLandmarks | null;
  alignment: AlignmentResult;
  isMirrored?: boolean;
  opacity?: number;
}

const BONE_CONNECTIONS: [JointName, JointName][] = [
  // Shoulders & Torso
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  // Left arm
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  // Right arm
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  // Left leg
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  // Right leg
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
];

export const SkeletalOverlay: React.FC<SkeletalOverlayProps> = ({
  targetLandmarks,
  liveLandmarks,
  alignment,
  isMirrored = false,
  opacity = 0.9,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays
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

    if (!targetLandmarks) {
      ctx.restore();
      return;
    }

    const isAligned = alignment.isAligned;
    const score = alignment.score;

    // Colors:
    // If aligned (>= 80%): Vibrant electric green (#00FF88)
    // If close (65-79%): Amber / Gold (#F59E0B)
    // Otherwise: Cyber cyan / cool white (#38BDF8)
    let strokeColor = '#38bdf8';
    let glowColor = 'rgba(56, 189, 248, 0.6)';
    let nodeColor = '#ffffff';

    if (isAligned) {
      strokeColor = '#00ff88';
      glowColor = 'rgba(0, 255, 136, 0.9)';
      nodeColor = '#10b981';
    } else if (score >= 65) {
      strokeColor = '#fbbf24';
      glowColor = 'rgba(251, 191, 36, 0.7)';
      nodeColor = '#f59e0b';
    }

    ctx.globalAlpha = opacity;

    // Helper to transform normalized point into screen coordinates
    const toScreen = (pt: Point2D) => {
      let x = pt.x * width;
      if (isMirrored) {
        x = (1 - pt.x) * width;
      }
      return { x, y: pt.y * height };
    };

    // 1. Draw Target AI Bones (Skeletal Wireframe)
    ctx.lineWidth = isAligned ? 4.5 : 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = strokeColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = isAligned ? 18 : 10;

    for (const [j1, j2] of BONE_CONNECTIONS) {
      const p1 = targetLandmarks[j1];
      const p2 = targetLandmarks[j2];

      if (p1 && p2) {
        const s1 = toScreen(p1);
        const s2 = toScreen(p2);

        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
      }
    }

    // 2. Draw Head Guide Oval & Direction
    const nose = targetLandmarks.nose;
    const lSh = targetLandmarks.left_shoulder;
    const rSh = targetLandmarks.right_shoulder;

    if (nose) {
      const noseScreen = toScreen(nose);
      let headRadius = width * 0.055;
      if (lSh && rSh) {
        const shoulderDist = Math.hypot(lSh.x - rSh.x, lSh.y - rSh.y) * width;
        headRadius = Math.max(20, shoulderDist * 0.28);
      }

      ctx.beginPath();
      ctx.arc(noseScreen.x, noseScreen.y, headRadius, 0, Math.PI * 2);
      ctx.strokeStyle = strokeColor;
      ctx.stroke();

      // Head center node
      ctx.beginPath();
      ctx.arc(noseScreen.x, noseScreen.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = nodeColor;
      ctx.fill();
    }

    // 3. Draw Target Joint Nodes with feedback rings
    for (const [jointName, pt] of Object.entries(targetLandmarks)) {
      if (!pt || jointName === 'nose') continue;
      const s = toScreen(pt);
      const jointError = alignment.jointErrors[jointName as JointName];
      const isJointAligned = jointError !== undefined && jointError < 0.11;

      // Outer ring
      ctx.beginPath();
      ctx.arc(s.x, s.y, isJointAligned ? 7 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isJointAligned ? '#00ff88' : nodeColor;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(s.x, s.y, isJointAligned ? 11 : 9, 0, Math.PI * 2);
      ctx.strokeStyle = isJointAligned ? '#00ff88' : strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 4. Subtle Live Landmark Feedback (ghost dots showing user where their limbs currently are)
    if (liveLandmarks) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.55;

      for (const [jointName, livePt] of Object.entries(liveLandmarks)) {
        if (!livePt) continue;
        const targetPt = targetLandmarks[jointName as JointName];
        if (!targetPt) continue;

        const liveScreen = toScreen(livePt);
        const targetScreen = toScreen(targetPt);
        const dist = Math.hypot(liveScreen.x - targetScreen.x, liveScreen.y - targetScreen.y);

        // If not yet aligned, draw subtle connecting thread toward target
        if (dist > 18) {
          ctx.beginPath();
          ctx.setLineDash([3, 4]);
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.moveTo(liveScreen.x, liveScreen.y);
          ctx.lineTo(targetScreen.x, targetScreen.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Live joint dot
        ctx.beginPath();
        ctx.arc(liveScreen.x, liveScreen.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = isAligned ? '#00ff88' : 'rgba(255, 255, 255, 0.8)';
        ctx.fill();
      }
    }

    ctx.restore();
  }, [targetLandmarks, liveLandmarks, alignment, isMirrored, opacity]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-10 transition-opacity duration-300"
    />
  );
};
