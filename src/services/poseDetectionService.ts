import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

/**
 * Lightweight Gesture & Hand Trigger Service:
 * Removed heavy joint scoring and skeleton alignment calculation.
 * Dedicated to lightweight hands-free selfie gestures (e.g. raised palm countdown).
 */
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
      const liteModelPath =
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

      try {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: liteModelPath,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });
      } catch {
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: liteModelPath,
            delegate: 'CPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });
      }

      this.isInitializing = false;
      return true;
    } catch (err) {
      console.warn('Pose landmarker init warning:', err);
      this.isInitializing = false;
      return false;
    }
  }

  public detectPalmRaised(videoElement: HTMLVideoElement, timestamp: number): boolean {
    if (!this.poseLandmarker || videoElement.readyState < 2) return false;
    try {
      const result = this.poseLandmarker.detectForVideo(videoElement, timestamp);
      const landmarks = result.landmarks?.[0];
      if (!landmarks) return false;

      const leftWrist = landmarks[15];
      const leftShoulder = landmarks[11];
      const rightWrist = landmarks[16];
      const rightShoulder = landmarks[12];

      const leftRaised =
        leftWrist &&
        leftShoulder &&
        leftWrist.y < leftShoulder.y - 0.04 &&
        (leftWrist.visibility ?? 1) > 0.45;

      const rightRaised =
        rightWrist &&
        rightShoulder &&
        rightWrist.y < rightShoulder.y - 0.04 &&
        (rightWrist.visibility ?? 1) > 0.45;

      return Boolean(leftRaised || rightRaised);
    } catch {
      return false;
    }
  }
}

export const poseDetectionService = new PoseDetectionService();
