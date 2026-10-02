import type { CameraSensorInfo } from '../types/camera';

// TypeScript declarations for ImageCapture API
declare class ImageCapture {
  constructor(track: MediaStreamTrack);
  getPhotoCapabilities(): Promise<{
    imageWidth?: { min: number; max: number; step: number };
    imageHeight?: { min: number; max: number; step: number };
    fillLightMode?: string[];
    redEyeReduction?: string;
  }>;
  takePhoto(photoSettings?: {
    imageWidth?: number;
    imageHeight?: number;
    fillLightMode?: string;
  }): Promise<Blob>;
  grabFrame(): Promise<ImageBitmap>;
}

export class CameraService {
  private stream: MediaStream | null = null;
  private videoTrack: MediaStreamTrack | null = null;
  private imageCapture: ImageCapture | null = null;
  private facingMode: 'user' | 'environment' = 'environment';
  private torchEnabled = false;

  public getFacingMode(): 'user' | 'environment' {
    return this.facingMode;
  }

  public async startCamera(
    videoElement: HTMLVideoElement,
    preferredFacing: 'user' | 'environment' = 'environment'
  ): Promise<CameraSensorInfo> {
    this.stopCamera();
    this.facingMode = preferredFacing;

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: 3840, min: 1280 },
        height: { ideal: 2160, min: 720 },
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('High-res constraint failed, falling back to standard resolution', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: this.facingMode } },
        });
      } catch (err2) {
        console.warn('FacingMode ideal failed, falling back to default video track', err2);
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }
    }

    videoElement.srcObject = this.stream;
    await videoElement.play();

    this.videoTrack = this.stream.getVideoTracks()[0] || null;

    if (this.videoTrack && 'ImageCapture' in window) {
      try {
        // @ts-ignore
        this.imageCapture = new (window as any).ImageCapture(this.videoTrack);
      } catch (e) {
        console.warn('ImageCapture constructor error:', e);
      }
    }

    return this.getSensorInfo();
  }

  /**
   * Switches seamlessly between Front (Selfie) and Back (Environment) cameras
   */
  public async switchCamera(videoElement: HTMLVideoElement): Promise<CameraSensorInfo> {
    const nextFacing: 'user' | 'environment' = this.facingMode === 'environment' ? 'user' : 'environment';
    return this.startCamera(videoElement, nextFacing);
  }

  public async toggleTorch(): Promise<boolean> {
    if (!this.videoTrack) return false;
    try {
      const caps = (this.videoTrack.getCapabilities?.() || {}) as { torch?: boolean };
      if (caps.torch) {
        this.torchEnabled = !this.torchEnabled;
        await this.videoTrack.applyConstraints({
          // @ts-ignore
          advanced: [{ torch: this.torchEnabled }],
        });
        return this.torchEnabled;
      }
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
    return false;
  }

  public async getSensorInfo(): Promise<CameraSensorInfo> {
    let maxWidth = 1920;
    let maxHeight = 1080;
    let hasImageCapture = false;
    let torchAvailable = false;
    let cameraLabel = this.facingMode === 'user' ? 'Front Camera (Selfie)' : 'Back Camera (Main Lens)';
    let zoomMin: number | undefined;
    let zoomMax: number | undefined;
    let zoomCurrent: number | undefined;

    if (this.videoTrack) {
      const settings = this.videoTrack.getSettings?.() || {};
      maxWidth = settings.width || 1920;
      maxHeight = settings.height || 1080;
      if (this.videoTrack.label) {
        cameraLabel = this.videoTrack.label;
      }

      const caps = (this.videoTrack.getCapabilities?.() || {}) as any;
      if (caps.width?.max) maxWidth = Math.max(maxWidth, caps.width.max);
      if (caps.height?.max) maxHeight = Math.max(maxHeight, caps.height.max);
      if (caps.torch) torchAvailable = true;
      if (caps.zoom) {
        zoomMin = caps.zoom.min;
        zoomMax = caps.zoom.max;
        zoomCurrent = (settings as any).zoom || zoomMin;
      }
    }

    if (this.imageCapture) {
      hasImageCapture = true;
      try {
        const photoCaps = await this.imageCapture.getPhotoCapabilities();
        if (photoCaps.imageWidth?.max) {
          maxWidth = Math.max(maxWidth, photoCaps.imageWidth.max);
        }
        if (photoCaps.imageHeight?.max) {
          maxHeight = Math.max(maxHeight, photoCaps.imageHeight.max);
        }
      } catch (err) {
        console.warn('Error reading photo capabilities:', err);
      }
    }

    const rawMp = (maxWidth * maxHeight) / 1_000_000;
    const maxMegapixels = Number(rawMp.toFixed(1));

    return {
      maxWidth,
      maxHeight,
      maxMegapixels,
      hasImageCapture,
      facingMode: this.facingMode,
      torchAvailable,
      cameraLabel,
      zoomMin,
      zoomMax,
      zoomCurrent,
    };
  }

  /**
   * Captures the ultimate full-sensor photo.
   * If the device has a 48MP, 50MP, 64MP, 108MP sensor and supports ImageCapture,
   * it grabs directly from the camera sensor in full still-photo uncompressed resolution!
   */
  public async captureFullQualityPhoto(videoElement: HTMLVideoElement): Promise<{
    blob: Blob;
    width: number;
    height: number;
    megapixels: number;
    megapixelsFormatted: string;
    cameraUsed: string;
    facingMode: 'user' | 'environment';
    isFullSensor: boolean;
  }> {
    const isFront = this.facingMode === 'user';
    const cameraUsed = isFront ? 'Front Camera (Selfie)' : 'Back Camera (Optical Sensor)';

    if (this.imageCapture) {
      try {
        const photoCaps = await this.imageCapture.getPhotoCapabilities();
        const targetWidth = photoCaps.imageWidth?.max;
        const targetHeight = photoCaps.imageHeight?.max;

        const photoSettings: any = {};
        if (targetWidth) photoSettings.imageWidth = targetWidth;
        if (targetHeight) photoSettings.imageHeight = targetHeight;

        // Still image sensor capture
        const photoBlob = await this.imageCapture.takePhoto(photoSettings);

        // Read natural image dimensions from blob
        const dims = await this.getBlobDimensions(photoBlob);
        const rawMp = (dims.width * dims.height) / 1_000_000;
        const megapixels = Number(rawMp.toFixed(1));
        const megapixelsFormatted = `${megapixels.toFixed(1)} MP`;

        return {
          blob: photoBlob,
          width: dims.width,
          height: dims.height,
          megapixels,
          megapixelsFormatted,
          cameraUsed,
          facingMode: this.facingMode,
          isFullSensor: true,
        };
      } catch (err) {
        console.warn('ImageCapture.takePhoto failed, falling back to canvas grab:', err);
      }
    }

    // High quality canvas fallback
    const width = videoElement.videoWidth || 1920;
    const height = videoElement.videoHeight || 1080;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not create canvas context');

    // Draw video frame with image smoothing enabled
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(videoElement, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create photo blob'));
        },
        'image/jpeg',
        0.98 // Near-lossless high quality JPEG
      );
    });

    const rawMp = (width * height) / 1_000_000;
    const megapixels = Number(rawMp.toFixed(1));
    const megapixelsFormatted = `${megapixels.toFixed(1)} MP`;

    return {
      blob,
      width,
      height,
      megapixels,
      megapixelsFormatted,
      cameraUsed,
      facingMode: this.facingMode,
      isFullSensor: false,
    };
  }

  /**
   * Captures a single normal-quality frame for sending to LLM for scene & person analysis
   */
  public captureAnalysisFrame(videoElement: HTMLVideoElement): { base64: string; mimeType: string } {
    const targetDim = 768; // Ideal balance of detail & fast network transfer to LLM
    const aspect = (videoElement.videoWidth || 1) / (videoElement.videoHeight || 1);
    let w = targetDim;
    let h = Math.round(targetDim / aspect);
    if (aspect < 1) {
      h = targetDim;
      w = Math.round(targetDim * aspect);
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoElement, 0, 0, w, h);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const base64 = dataUrl.split(',')[1];
    return { base64, mimeType: 'image/jpeg' };
  }

  private getBlobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 1920, height: 1080 });
      };
      img.src = url;
    });
  }

  public stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.videoTrack = null;
    this.imageCapture = null;
  }
}

export const cameraService = new CameraService();
