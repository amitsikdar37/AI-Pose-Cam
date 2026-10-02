export interface Point2D {
  x: number; // Normalized 0.0 to 1.0
  y: number; // Normalized 0.0 to 1.0
  z?: number;
  visibility?: number;
}

export type JointName =
  | 'nose'
  | 'left_eye'
  | 'right_eye'
  | 'left_ear'
  | 'right_ear'
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_elbow'
  | 'right_elbow'
  | 'left_wrist'
  | 'right_wrist'
  | 'left_hip'
  | 'right_hip'
  | 'left_knee'
  | 'right_knee'
  | 'left_ankle'
  | 'right_ankle';

export type PoseLandmarks = Partial<Record<JointName, Point2D>>;

export interface PosePreset {
  id: string;
  title: string;
  vibe: string;
  category: 'Casual' | 'Editorial' | 'Portrait' | 'Dynamic' | 'Seated' | 'Streetwear';
  framing: 'full_body' | 'upper_body' | 'seated';
  directionTip: string;
  reasoning: string;
  landmarks: PoseLandmarks;
}

export interface SceneAnalysisResponse {
  sceneDescription: string;
  vibe: string;
  poseTitle: string;
  directionTip: string;
  framing: 'full_body' | 'upper_body' | 'seated';
  landmarks: PoseLandmarks;
  confidence?: number;
}

export interface AlignmentResult {
  score: number; // 0 to 100
  isAligned: boolean; // >= threshold (e.g. 80%)
  jointErrors: Partial<Record<JointName, number>>;
  primaryFeedback: string;
  alignedJointsCount: number;
  totalJointsCount: number;
}

export interface CapturedPhoto {
  id: string;
  url: string;
  blob: Blob;
  stampedUrl: string; // Photo with actual MP watermark and camera banner
  stampedBlob: Blob;
  width: number;
  height: number;
  megapixels: number;
  megapixelsFormatted: string; // e.g. "48.0 MP", "50.0 MP", "108.0 MP", "12.2 MP"
  cameraUsed: string; // e.g. "Back Camera (Full Optical Sensor)" or "Front Camera (Selfie)"
  facingMode: 'user' | 'environment';
  alignmentScore: number;
  timestamp: number;
  isFullSensor: boolean;
  poseTitle: string;
  fileSizeBytes: number;
}

export interface CameraSensorInfo {
  maxWidth: number;
  maxHeight: number;
  maxMegapixels: number;
  hasImageCapture: boolean;
  facingMode: 'user' | 'environment';
  torchAvailable: boolean;
  cameraLabel?: string;
  zoomMin?: number;
  zoomMax?: number;
  zoomCurrent?: number;
}
