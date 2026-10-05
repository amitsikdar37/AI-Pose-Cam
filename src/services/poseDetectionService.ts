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
    alignmentThreshold = 75,
    isMirrored = false
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

    const isVisible = (pt?: Point2D) => {
      if (!pt) return false;
      if (typeof pt.visibility === 'number' && pt.visibility < 0.40) return false;
      return true;
    };

    // 1. Unified Anatomical Reference Point & Scale:
    // Shoulder midpoint & shoulder span are present in 100% of human camera framings (selfie, portrait, full body).
    // Using shoulderMid guarantees live and target coordinate spaces have the EXACT SAME origin!
    const liveShoulderMid = this.getMidpoint(liveLandmarks.left_shoulder, liveLandmarks.right_shoulder) || liveLandmarks.nose;
    const targetShoulderMid = this.getMidpoint(targetLandmarks.left_shoulder, targetLandmarks.right_shoulder) || targetLandmarks.nose;

    if (!liveShoulderMid || !targetShoulderMid) {
      return {
        score: 0,
        isAligned: false,
        jointErrors: {},
        primaryFeedback: 'Position your face & shoulders in frame',
        alignedJointsCount: 0,
        totalJointsCount: 0,
      };
    }

    const liveShSpan = liveLandmarks.left_shoulder && liveLandmarks.right_shoulder
      ? Math.hypot(liveLandmarks.left_shoulder.x - liveLandmarks.right_shoulder.x, liveLandmarks.left_shoulder.y - liveLandmarks.right_shoulder.y)
      : 0.25;
    const targetShSpan = targetLandmarks.left_shoulder && targetLandmarks.right_shoulder
      ? Math.hypot(targetLandmarks.left_shoulder.x - targetLandmarks.right_shoulder.x, targetLandmarks.left_shoulder.y - targetLandmarks.right_shoulder.y)
      : 0.25;

    const liveScale = Math.max(0.12, liveShSpan);
    const targetScale = Math.max(0.12, targetShSpan);

    // 2. Framing Intelligence (Selfie / Close-Up vs Full Body):
    // In selfies, hips and knees are out of frame, and hands may be holding the phone.
    // We only score joints that are visible and relevant to the framing!
    const hasLiveHips = isVisible(liveLandmarks.left_hip) || isVisible(liveLandmarks.right_hip);
    const hasLiveKnees = isVisible(liveLandmarks.left_knee) || isVisible(liveLandmarks.right_knee);
    const isSelfieOrUpperBody = !hasLiveHips && !hasLiveKnees;

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
    let scoredJointsCount = 0;
    let maxErrorJoint: JointName | null = null;
    let maxErrorVal = 0;
    const jointErrors: Partial<Record<JointName, number>> = {};

    for (const joint of keyJoints) {
      const livePt = liveLandmarks[joint];
      const targetPt = targetLandmarks[joint];
      if (!livePt || !targetPt) continue;

      // In a selfie or close-up, skip joints that are not visible in the camera frame
      const visible = isVisible(livePt);
      if (isSelfieOrUpperBody && !visible) {
        continue;
      }
      // In full body, also skip completely invisible joints (occluded legs/hands)
      if (!visible && (joint.includes('knee') || joint.includes('ankle') || joint.includes('wrist'))) {
        continue;
      }

      scoredJointsCount++;

      // Relative torso/shoulder coordinate comparison
      const liveRelX = (livePt.x - liveShoulderMid.x) / liveScale;
      const liveRelY = (livePt.y - liveShoulderMid.y) / liveScale;
      const targetRelX = (targetPt.x - targetShoulderMid.x) / targetScale;
      const targetRelY = (targetPt.y - targetShoulderMid.y) / targetScale;
      const relDist = Math.hypot(liveRelX - targetRelX, liveRelY - targetRelY);

      jointErrors[joint] = relDist;

      // Assign weight: nose and shoulders are the primary visual anchor in all framings
      let weight = 1.0;
      if (joint === 'nose') {
        weight = isSelfieOrUpperBody ? 2.5 : 1.8;
      } else if (joint.includes('shoulder')) {
        weight = isSelfieOrUpperBody ? 2.0 : 1.5;
      } else if (joint.includes('wrist')) {
        weight = 1.2;
      } else if (joint.includes('elbow')) {
        weight = 1.0;
      }

      accumulatedNormalizedError += relDist * weight;
      totalWeight += weight;

      if (relDist < 0.35) {
        alignedJoints++;
      }

      if (relDist > maxErrorVal && visible) {
        maxErrorVal = relDist;
        maxErrorJoint = joint;
      }
    }

    if (totalWeight === 0 || scoredJointsCount === 0) {
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
    // Map error to a responsive score: 0 error = 100%, 0.4 error = 72%, 0.8 error = 44%
    const positionScore = Math.max(0, Math.min(100, 100 - avgRelError * 70));

    // 3. Posture Geometry Angles (Limb & Shoulder Slopes)
    const angleScores: number[] = [];

    // Shoulder tilt / posture level (always checked if shoulders present)
    if (liveLandmarks.left_shoulder && liveLandmarks.right_shoulder && targetLandmarks.left_shoulder && targetLandmarks.right_shoulder) {
      const liveShAngle = Math.atan2(liveLandmarks.left_shoulder.y - liveLandmarks.right_shoulder.y, liveLandmarks.left_shoulder.x - liveLandmarks.right_shoulder.x) * (180 / Math.PI);
      const targetShAngle = Math.atan2(targetLandmarks.left_shoulder.y - targetLandmarks.right_shoulder.y, targetLandmarks.left_shoulder.x - targetLandmarks.right_shoulder.x) * (180 / Math.PI);
      const shDiff = Math.abs(liveShAngle - targetShAngle);
      angleScores.push(Math.max(0, 100 - shDiff * 3));
    }

    // Arm angles (only if elbow and wrist are visible)
    if (isVisible(liveLandmarks.left_elbow) && isVisible(liveLandmarks.left_wrist)) {
      const liveLeftElbow = this.calculateAngle(liveLandmarks.left_shoulder, liveLandmarks.left_elbow, liveLandmarks.left_wrist);
      const targetLeftElbow = this.calculateAngle(targetLandmarks.left_shoulder, targetLandmarks.left_elbow, targetLandmarks.left_wrist);
      if (liveLeftElbow !== null && targetLeftElbow !== null) {
        angleScores.push(this.angleSimilarity(liveLeftElbow, targetLeftElbow));
      }
    }

    if (isVisible(liveLandmarks.right_elbow) && isVisible(liveLandmarks.right_wrist)) {
      const liveRightElbow = this.calculateAngle(liveLandmarks.right_shoulder, liveLandmarks.right_elbow, liveLandmarks.right_wrist);
      const targetRightElbow = this.calculateAngle(targetLandmarks.right_shoulder, targetLandmarks.right_elbow, targetLandmarks.right_wrist);
      if (liveRightElbow !== null && targetRightElbow !== null) {
        angleScores.push(this.angleSimilarity(liveRightElbow, targetRightElbow));
      }
    }

    const avgAngleScore =
      angleScores.length > 0
        ? angleScores.reduce((a, b) => a + b, 0) / angleScores.length
        : positionScore;

    let finalScore = Math.round(positionScore * 0.60 + avgAngleScore * 0.40);

    // Alignment reward bonus if head and shoulders match well
    const noseErr = jointErrors['nose'] ?? 1.0;
    const lShErr = jointErrors['left_shoulder'] ?? 1.0;
    const rShErr = jointErrors['right_shoulder'] ?? 1.0;
    if (noseErr < 0.25 && lShErr < 0.30 && rShErr < 0.30) {
      finalScore = Math.min(100, finalScore + 8);
    }

    const isAligned = finalScore >= alignmentThreshold;

    let primaryFeedback = 'Match the yellow silhouette guide';
    if (isAligned) {
      primaryFeedback = 'PERFECT! Hold steady & snap photo!';
    } else if (finalScore >= 65) {
      primaryFeedback = 'Almost there! Hold steady inside the silhouette';
    } else if (maxErrorJoint && maxErrorVal > 0.28) {
      primaryFeedback = this.getJointDirectionCue(
        maxErrorJoint,
        liveLandmarks[maxErrorJoint]!,
        targetLandmarks[maxErrorJoint]!,
        isMirrored
      );
    }

    return {
      score: finalScore,
      isAligned,
      jointErrors,
      primaryFeedback,
      alignedJointsCount: alignedJoints,
      totalJointsCount: scoredJointsCount,
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

  private getJointDirectionCue(joint: JointName, livePt: Point2D, targetPt: Point2D, isMirrored = false): string {
    let dx = targetPt.x - livePt.x;
    const dy = targetPt.y - livePt.y;

    if (isMirrored) {
      dx = -dx;
    }

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
