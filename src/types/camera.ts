export interface AIPoseSuggestion {
  id: string;
  title: string;
  vibe: string;
  directionTip: string;
  sceneObjects: string[];
  imagePrompt: string;
  referenceImageUrl: string;
  createdAt: number;
  cameraFacing?: 'user' | 'environment';
  generationEngine?: string;
  imageEngine?: string;
  fallbackReason?: string;
}

// PosePreset alias for compatibility
export type PosePreset = AIPoseSuggestion;

export type OrientationAngle = 0 | 90 | 180 | 270;
export type ResolutionMode = 'max' | '12mp' | 'auto';

export interface CameraHardwareProfile {
  facing: 'user' | 'environment';
  deviceId?: string;
  label: string;
  maxWidth: number;
  maxHeight: number;
  maxMegapixels: number;
  hasImageCapture: boolean;
  supportsTorch: boolean;
  zoomMin?: number;
  zoomMax?: number;
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
  resolutionMode?: ResolutionMode;
  isQuadBayerBinned?: boolean;
  hardwareProfiles?: {
    user?: CameraHardwareProfile;
    environment?: CameraHardwareProfile;
  };
}

export interface CapturedPhoto {
  id: string;
  url: string;
  blob: Blob;
  stampedUrl: string;
  stampedBlob: Blob;
  width: number;
  height: number;
  megapixels: number;
  megapixelsFormatted: string;
  cameraUsed: string;
  facingMode: 'user' | 'environment';
  timestamp: number;
  isFullSensor: boolean;
  poseTitle: string;
  fileSizeBytes: number;
}
