import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { AlignmentResult, JointName, Point2D, PoseLandmarks } from '../types/camera';

// MediaPipe 33-landmark index mapping to JointName
const MEDIAPIPE_INDEX_MAP: Record<number, JointName> = {
  0: 'nose',
  2: 'left_eye',
  5: 'right_eye',
  7: 'left_ear',
  8: 'right_ear',
  11: 'left_shoulder',
  12: 'right_shoulder',
  13: 'left_elbow',
  14: 'right_elbow',
  15: 'left_wrist',
  16: 'right_wrist',
  23: 'left_hip',
  24: 'right_hip',
  25: 'left_knee',
  26: 'right_knee',
  27: 'left_ankle',
  28: 'right_ankle',
};

export class PoseDetectionService {
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitializing = false;
  private prevLandmarks: PoseLandmarks | null = null;

  public async initialize(): Promise<boolean> {
    if (this.poseLandmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      // Attempt high-accuracy Full model first on GPU, fallback to Lite
      const fullModelPath =
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
      const liteModelPath =
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: fullModelPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.4,
          minPosePresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
      } catch (gpuErr) {
        console.warn('Full GPU PoseLandmarker failed, trying Lite model:', gpuErr);
        try {
          this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: liteModelPath,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.4,
            minPosePresenceConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
        } catch (cpuErr) {
          console.warn('GPU fallback failed, using CPU delegate:', cpuErr);
          this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: liteModelPath,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.35,
            minPosePresenceConfidence: 0.35,
            minTrackingConfidence: 0.35,
          });
        }
      }

      this.isInitializing = false;
      return true;
    } catch (err: any) {
      console.error('Failed to initialize PoseLandmarker:', err);
      this.isInitializing = false;
      return false;
    }
  }

  public isReady(): boolean {
    return Boolean(this.poseLandmarker);
  }

  /**
   * Runs frame detection with velocity-adaptive EMA temporal smoothing
   * to eliminate landmark jitter and provide buttery-smooth tracking.
   */
  public detectPose(
    videoElement: HTMLVideoElement,
    timestamp: number
  ): PoseLandmarks | null {
    if (!this.poseLandmarker || videoElement.readyState < 2) return null;

    try {
      const result = this.poseLandmarker.detectForVideo(videoElement, timestamp);
      if (!result.landmarks || result.landmarks.length === 0) {
        return this.prevLandmarks; // retain last known pose briefly for smooth continuity
      }

      const rawLandmarks = result.landmarks[0];
      const currentLandmarks: PoseLandmarks = {};

      for (let i = 0; i < rawLandmarks.length; i++) {
        const jointName = MEDIAPIPE_INDEX_MAP[i];
        if (jointName) {
          const pt = rawLandmarks[i];
          currentLandmarks[jointName] = {
            x: pt.x,
            y: pt.y,
            z: pt.z,
            visibility: pt.visibility,
          };
        }
      }

      // Apply Exponential Moving Average (EMA) smoothing to eliminate tracking jitter
      if (this.prevLandmarks) {
        for (const joint of Object.keys(currentLandmarks) as JointName[]) {
          const curr = currentLandmarks[joint];
          const prev = this.prevLandmarks[joint];
          if (curr && prev) {
            const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
            // Adaptive smoothing: smoother when holding still (0.5), faster when moving (0.75)
            const alpha = dist > 0.05 ? 0.75 : 0.50;
            curr.x = prev.x * (1 - alpha) + curr.x * alpha;
            curr.y = prev.y * (1 - alpha) + curr.y * alpha;
          }
        }
      }

      this.prevLandmarks = currentLandmarks;
      return currentLandmarks;
    } catch {
      return this.prevLandmarks;
    }
  }

  /**
   * Scale- and position-invariant posture alignment.
   * Compares relative body vectors, joint angles, and torso-normalized coordinates
   * so the user doesn't need to stand at an exact pixel coordinate.
   */
  public calculateAlignment(
    liveLandmarks: PoseLandmarks | null,
    targetLandmarks: PoseLandmarks | null,
    alignmentThreshold = 75
  ): AlignmentResult {
    if (!liveLandmarks || !targetLandmarks) {
      return {
        score: 0,
        isAligned: false,
        jointErrors: {},
        primaryFeedback: 'Step into view to align with pose',
        alignedJointsCount: 0,
        totalJointsCount: 0,
      };
    }

    // 1. Compute torso centers and scales to normalize for distance and horizontal position
    const liveShoulderMid = this.getMidpoint(liveLandmarks.left_shoulder, liveLandmarks.right_shoulder);
    const liveHipMid = this.getMidpoint(liveLandmarks.left_hip, liveLandmarks.right_hip);
    const targetShoulderMid = this.getMidpoint(targetLandmarks.left_shoulder, targetLandmarks.right_shoulder);
    const targetHipMid = this.getMidpoint(targetLandmarks.left_hip, targetLandmarks.right_hip);

    const liveCenter = liveShoulderMid && liveHipMid ? this.getMidpoint(liveShoulderMid, liveHipMid) : liveShoulderMid;
    const targetCenter = targetShoulderMid && targetHipMid ? this.getMidpoint(targetShoulderMid, targetHipMid) : targetShoulderMid;

    const liveScale =
      liveShoulderMid && liveHipMid
        ? Math.hypot(liveShoulderMid.x - liveHipMid.x, liveShoulderMid.y - liveHipMid.y)
        : 0.35;
    const targetScale =
      targetShoulderMid && targetHipMid
        ? Math.hypot(targetShoulderMid.x - targetHipMid.x, targetShoulderMid.y - targetHipMid.y)
        : 0.35;

    const keyJoints: JointName[] = [
      'nose',
      'left_shoulder',
      'right_shoulder',
      'left_elbow',
      'right_elbow',
      'left_wrist',
      'right_wrist',
      'left_hip',
      'right_hip',
      'left_knee',
      'right_knee',
    ];

    let totalWeight = 0;
    let accumulatedNormalizedError = 0;
    let alignedJoints = 0;
    let maxErrorJoint: JointName | null = null;
    let maxErrorVal = 0;
    const jointErrors: Partial<Record<JointName, number>> = {};

    for (const joint of keyJoints) {
      const livePt = liveLandmarks[joint];
      const targetPt = targetLandmarks[joint];
      if (!livePt || !targetPt) continue;

      // Transform into relative torso space (invariant to screen position and distance)
      let relDist: number;
      if (liveCenter && targetCenter && liveScale > 0.05 && targetScale > 0.05) {
        const liveRelX = (livePt.x - liveCenter.x) / liveScale;
        const liveRelY = (livePt.y - liveCenter.y) / liveScale;
        const targetRelX = (targetPt.x - targetCenter.x) / targetScale;
        const targetRelY = (targetPt.y - targetCenter.y) / targetScale;
        relDist = Math.hypot(liveRelX - targetRelX, liveRelY - targetRelY);
      } else {
        relDist = Math.hypot(livePt.x - targetPt.x, livePt.y - targetPt.y);
      }

      jointErrors[joint] = relDist;

      // Wrists and elbows define expressive silhouette gestures
      const weight = joint.includes('wrist') ? 1.5 : joint.includes('elbow') ? 1.3 : 1.0;
      accumulatedNormalizedError += relDist * weight;
      totalWeight += weight;

      if (relDist < 0.28) {
        alignedJoints++;
      }

      if (relDist > maxErrorVal) {
        maxErrorVal = relDist;
        maxErrorJoint = joint;
      }
    }

    // 2. Compare limb angles (pure posture geometry, completely scale-free)
    const angleScores: number[] = [];

    // Left arm angle (shoulder-elbow-wrist)
    const liveLeftElbow = this.calculateAngle(liveLandmarks.left_shoulder, liveLandmarks.left_elbow, liveLandmarks.left_wrist);
    const targetLeftElbow = this.calculateAngle(targetLandmarks.left_shoulder, targetLandmarks.left_elbow, targetLandmarks.left_wrist);
    if (liveLeftElbow !== null && targetLeftElbow !== null) {
      angleScores.push(this.angleSimilarity(liveLeftElbow, targetLeftElbow));
    }

    // Right arm angle (shoulder-elbow-wrist)
    const liveRightElbow = this.calculateAngle(liveLandmarks.right_shoulder, liveLandmarks.right_elbow, liveLandmarks.right_wrist);
    const targetRightElbow = this.calculateAngle(targetLandmarks.right_shoulder, targetLandmarks.right_elbow, targetLandmarks.right_wrist);
    if (liveRightElbow !== null && targetRightElbow !== null) {
      angleScores.push(this.angleSimilarity(liveRightElbow, targetRightElbow));
    }

    // Left shoulder elevation (hip-shoulder-elbow)
    const liveLeftSh = this.calculateAngle(liveLandmarks.left_hip, liveLandmarks.left_shoulder, liveLandmarks.left_elbow);
    const targetLeftSh = this.calculateAngle(targetLandmarks.left_hip, targetLandmarks.left_shoulder, targetLandmarks.left_elbow);
    if (liveLeftSh !== null && targetLeftSh !== null) {
      angleScores.push(this.angleSimilarity(liveLeftSh, targetLeftSh));
    }

    // Right shoulder elevation (hip-shoulder-elbow)
    const liveRightSh = this.calculateAngle(liveLandmarks.right_hip, liveLandmarks.right_shoulder, liveLandmarks.right_elbow);
    const targetRightSh = this.calculateAngle(targetLandmarks.right_hip, targetLandmarks.right_shoulder, targetLandmarks.right_elbow);
    if (liveRightSh !== null && targetRightSh !== null) {
      angleScores.push(this.angleSimilarity(liveRightSh, targetRightSh));
    }

    if (totalWeight === 0) {
      return {
        score: 0,
        isAligned: false,
        jointErrors: {},
        primaryFeedback: 'Detecting body position...',
        alignedJointsCount: 0,
        totalJointsCount: 0,
      };
    }

    const avgRelError = accumulatedNormalizedError / totalWeight;
    const positionScore = Math.max(0, Math.min(100, 100 - avgRelError * 85));

    const avgAngleScore =
      angleScores.length > 0
        ? angleScores.reduce((a, b) => a + b, 0) / angleScores.length
        : positionScore;

    // Combined score: 60% angle geometry + 40% normalized relative position
    let finalScore = Math.round(avgAngleScore * 0.6 + positionScore * 0.4);

    // Bonus for matching key limbs
    if (alignedJoints >= 5) {
      finalScore = Math.min(100, finalScore + 6);
    }

    const isAligned = finalScore >= alignmentThreshold;

    let primaryFeedback = 'Match the yellow silhouette guide';
    if (isAligned) {
      primaryFeedback = 'PERFECT! Hold steady & snap photo!';
    } else if (finalScore >= 65) {
      primaryFeedback = 'Almost there! Hold steady inside the silhouette';
    } else if (maxErrorJoint && maxErrorVal > 0.32) {
      primaryFeedback = this.getJointDirectionCue(
        maxErrorJoint,
        liveLandmarks[maxErrorJoint]!,
        targetLandmarks[maxErrorJoint]!
      );
    }

    return {
      score: finalScore,
      isAligned,
      jointErrors,
      primaryFeedback,
      alignedJointsCount: alignedJoints,
      totalJointsCount: keyJoints.length,
    };
  }

  private getMidpoint(p1?: Point2D, p2?: Point2D): Point2D | null {
    if (!p1 || !p2) return null;
    return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  }

  private calculateAngle(a?: Point2D, b?: Point2D, c?: Point2D): number | null {
    if (!a || !b || !c) return null;
    const radians =
      Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return angle;
  }

  private angleSimilarity(angleA: number, angleB: number): number {
    const diff = Math.abs(angleA - angleB);
    return Math.max(0, Math.min(100, 100 - (diff / 60) * 100));
  }

  private getJointDirectionCue(joint: JointName, livePt: Point2D, targetPt: Point2D): string {
    const dx = targetPt.x - livePt.x;
    const dy = targetPt.y - livePt.y;

    const jointLabel = joint
      .replace('left_', 'Left ')
      .replace('right_', 'Right ')
      .replace('_', ' ');

    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < -0.05) return `Raise ${jointLabel} ↑`;
      if (dy > 0.05) return `Lower ${jointLabel} ↓`;
    } else {
      if (dx < -0.05) return `Move ${jointLabel} left ←`;
      if (dx > 0.05) return `Move ${jointLabel} right →`;
    }

    return `Adjust ${jointLabel}`;
  }
}

export const poseDetectionService = new PoseDetectionService();
