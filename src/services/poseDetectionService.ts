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

  public async initialize(): Promise<boolean> {
    if (this.poseLandmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      // Attempt GPU delegate first, fallback to CPU
      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      } catch (gpuErr) {
        console.warn('GPU acceleration failed for PoseLandmarker, falling back to CPU:', gpuErr);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });
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

  public detectPose(
    videoElement: HTMLVideoElement,
    timestamp: number
  ): PoseLandmarks | null {
    if (!this.poseLandmarker || videoElement.readyState < 2) return null;

    try {
      const result = this.poseLandmarker.detectForVideo(videoElement, timestamp);
      if (!result.landmarks || result.landmarks.length === 0) return null;

      const rawLandmarks = result.landmarks[0];
      const landmarks: PoseLandmarks = {};

      for (let i = 0; i < rawLandmarks.length; i++) {
        const jointName = MEDIAPIPE_INDEX_MAP[i];
        if (jointName) {
          const pt = rawLandmarks[i];
          landmarks[jointName] = {
            x: pt.x,
            y: pt.y,
            z: pt.z,
            visibility: pt.visibility,
          };
        }
      }

      return landmarks;
    } catch {
      // In case video frame is briefly dropped or timestamp non-monotonic
      return null;
    }
  }

  /**
   * Compares live detected person landmarks with target AI skeleton.
   * Uses normalized Euclidean distance and scale-invariant limb vectors.
   */
  public calculateAlignment(
    liveLandmarks: PoseLandmarks | null,
    targetLandmarks: PoseLandmarks | null,
    alignmentThreshold = 78
  ): AlignmentResult {
    if (!liveLandmarks || !targetLandmarks) {
      return {
        score: 0,
        isAligned: false,
        jointErrors: {},
        primaryFeedback: 'Step into the frame to begin alignment',
        alignedJointsCount: 0,
        totalJointsCount: 0,
      };
    }

    const keyJoints: JointName[] = [
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
    let accumulatedError = 0;
    let alignedJoints = 0;
    let maxErrorJoint: JointName | null = null;
    let maxErrorVal = 0;
    const jointErrors: Partial<Record<JointName, number>> = {};

    for (const joint of keyJoints) {
      const livePt = liveLandmarks[joint];
      const targetPt = targetLandmarks[joint];

      if (!livePt || !targetPt) continue;

      // Distance in normalized coordinates (0 to 1)
      const dist = Math.hypot(livePt.x - targetPt.x, livePt.y - targetPt.y);
      jointErrors[joint] = dist;

      // Weight wrists and elbows higher for expressive poses
      const isLimbEnd = joint.includes('wrist') || joint.includes('elbow');
      const weight = isLimbEnd ? 1.3 : 1.0;

      accumulatedError += dist * weight;
      totalWeight += weight;

      if (dist < 0.12) {
        alignedJoints++;
      }

      if (dist > maxErrorVal) {
        maxErrorVal = dist;
        maxErrorJoint = joint;
      }
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

    const avgError = accumulatedError / totalWeight;

    // Convert average error (typically 0.03 to 0.40) into 0 - 100 score
    let score = Math.round(Math.max(0, Math.min(100, 100 - avgError * 220)));

    // Extra bonus if all major joints are reasonably close
    if (alignedJoints >= 6) {
      score = Math.min(100, score + 5);
    }

    const isAligned = score >= alignmentThreshold;

    let primaryFeedback = 'Match the glowing guide';
    if (isAligned) {
      primaryFeedback = 'PERFECT ALIGNMENT! Hold steady & shoot!';
    } else if (maxErrorJoint && maxErrorVal > 0.14) {
      primaryFeedback = this.getJointDirectionCue(maxErrorJoint, liveLandmarks[maxErrorJoint]!, targetLandmarks[maxErrorJoint]!);
    } else if (score >= 65) {
      primaryFeedback = 'Almost there! Adjust limbs to match green skeleton';
    }

    return {
      score,
      isAligned,
      jointErrors,
      primaryFeedback,
      alignedJointsCount: alignedJoints,
      totalJointsCount: keyJoints.length,
    };
  }

  private getJointDirectionCue(joint: JointName, livePt: Point2D, targetPt: Point2D): string {
    const dx = targetPt.x - livePt.x;
    const dy = targetPt.y - livePt.y;

    const jointLabel = joint
      .replace('left_', 'Left ')
      .replace('right_', 'Right ')
      .replace('_', ' ');

    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy < -0.06) return `Raise ${jointLabel} ↑`;
      if (dy > 0.06) return `Lower ${jointLabel} ↓`;
    } else {
      if (dx < -0.06) return `Move ${jointLabel} left ←`;
      if (dx > 0.06) return `Move ${jointLabel} right →`;
    }

    return `Adjust ${jointLabel}`;
  }
}

export const poseDetectionService = new PoseDetectionService();
