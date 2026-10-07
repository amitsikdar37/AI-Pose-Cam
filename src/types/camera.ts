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
}

// PosePreset alias for compatibility
export type PosePreset = AIPoseSuggestion;

export type OrientationAngle = 0 | 90 | 180 | 270;
export type ResolutionMode = '32mp' | '48mp' | '50mp' | '12mp' | '4mp' | 'auto';

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
