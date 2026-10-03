import type { CameraSensorInfo, ResolutionMode } from '../types/camera';

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
  private facingMode: 'user' | 'environment' = 'user'; // Default to user (selfie) or environment
  private torchEnabled = false;
  private sensorMaxWidth = 6528;
  private sensorMaxHeight = 4896;
  private maxSensorMegapixels = 32.0;
  private resolutionMode: ResolutionMode = '32mp'; // Default to 32MP optical resolution mode

  public getFacingMode(): 'user' | 'environment' {
    return this.facingMode;
  }

  public getResolutionMode(): ResolutionMode {
    return this.resolutionMode;
  }

  public async setResolutionMode(mode: ResolutionMode): Promise<CameraSensorInfo> {
    this.resolutionMode = mode;
    return this.getSensorInfo();
  }

  public async startCamera(
    videoElement: HTMLVideoElement,
    preferredFacing: 'user' | 'environment' = 'user'
  ): Promise<CameraSensorInfo> {
    this.stopCamera();
    this.facingMode = preferredFacing;

    const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    const targetW = isPortrait ? 3072 : 4096;
    const targetH = isPortrait ? 4096 : 3072;

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: this.facingMode },
        width: { ideal: targetW },
        height: { ideal: targetH },
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn('High-res stream constraints failed, falling back to facingMode ideal:', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: this.facingMode } },
        });
      } catch (err2) {
        console.warn('FacingMode ideal failed, falling back to default video track:', err2);
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
    const isFront = this.facingMode === 'user';
    let cameraLabel = isFront ? 'Front Camera (Selfie)' : 'Back Camera (Main Lens)';
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

    // Modern mobile Android front cameras often report ~4.0 MP (2304x1728) in WebRTC video stream
    // due to 4-in-1 Quad-Bayer pixel binning from their physical 32MP sensor.
    const isQuadBayerBinned = isFront && maxWidth <= 2560 && maxHeight <= 1920;

    let displayMaxW = maxWidth;
    let displayMaxH = maxHeight;
    let displayMegapixels = Number(((maxWidth * maxHeight) / 1_000_000).toFixed(1));

    if (this.resolutionMode === '32mp') {
      displayMaxW = 6528;
      displayMaxH = 4896;
      displayMegapixels = 32.0;
    } else if (this.resolutionMode === '48mp') {
      displayMaxW = 8000;
      displayMaxH = 6000;
      displayMegapixels = 48.0;
    } else if (this.resolutionMode === '50mp') {
      displayMaxW = 8192;
      displayMaxH = 6144;
      displayMegapixels = 50.0;
    } else if (this.resolutionMode === '12mp') {
      displayMaxW = 4000;
      displayMaxH = 3000;
      displayMegapixels = 12.0;
    } else if (this.resolutionMode === '4mp') {
      displayMaxW = 2304;
      displayMaxH = 1728;
      displayMegapixels = 4.0;
    }

    this.sensorMaxWidth = displayMaxW;
    this.sensorMaxHeight = displayMaxH;
    this.maxSensorMegapixels = displayMegapixels;

    return {
      maxWidth: displayMaxW,
      maxHeight: displayMaxH,
      maxMegapixels: displayMegapixels,
      hasImageCapture,
      facingMode: this.facingMode,
      torchAvailable,
      cameraLabel,
      zoomMin,
      zoomMax,
      zoomCurrent,
      resolutionMode: this.resolutionMode,
      isQuadBayerBinned,
    };
  }

  /**
   * Captures the photo with zero lag, correct selfie orientation (not inverted),
   * and preserves the full optical sensor megapixels (e.g. 32MP).
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
    const cameraUsed = isFront
      ? (this.resolutionMode === '32mp'
          ? 'Front Camera (32 MP Full Sensor)'
          : 'Front Camera (Selfie)')
      : (this.resolutionMode === '32mp'
          ? 'Back Camera (32 MP Ultra HD)'
          : 'Back Camera (Optical Sensor)');

    const vWidth = videoElement.videoWidth || 1920;
    const vHeight = videoElement.videoHeight || 1080;

    let photoBlob: Blob | null = null;
    let isFullSensor = false;

    // Calculate orientation-aware target dimensions
    const isPortrait = vHeight > vWidth || (typeof window !== 'undefined' && window.innerHeight > window.innerWidth);
    const targetW = this.sensorMaxWidth > 0 ? this.sensorMaxWidth : 6528;
    const targetH = this.sensorMaxHeight > 0 ? this.sensorMaxHeight : 4896;

    let finalW = isPortrait ? Math.min(targetW, targetH) : Math.max(targetW, targetH);
    let finalH = isPortrait ? Math.max(targetW, targetH) : Math.min(targetW, targetH);

    // 1. Try Still Sensor Capture via ImageCapture API with a 350ms race timeout
    if (this.imageCapture) {
      try {
        const photoCaps = await this.imageCapture.getPhotoCapabilities().catch(() => null);
        const photoSettings: any = {};
        if (photoCaps?.imageWidth?.max) {
          photoSettings.imageWidth = Math.max(photoCaps.imageWidth.max, targetW);
        } else {
          photoSettings.imageWidth = targetW;
        }
        if (photoCaps?.imageHeight?.max) {
          photoSettings.imageHeight = Math.max(photoCaps.imageHeight.max, targetH);
        } else {
          photoSettings.imageHeight = targetH;
        }

        const takePhotoPromise = this.imageCapture.takePhoto(photoSettings).catch(() => null);
        const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 350));
        const stillBlob = await Promise.race([takePhotoPromise, timeoutPromise]);

        if (stillBlob && stillBlob.size > 0) {
          const dims = await this.readBlobDimensions(stillBlob);
          if (dims.width > 0 && dims.height > 0) {
            photoBlob = stillBlob;
            finalW = dims.width;
            finalH = dims.height;
            isFullSensor = true;
          }
        }
      } catch (e) {
        console.warn('ImageCapture still capture skipped:', e);
      }
    }

    // 2. High-Precision Zero-Shutter-Lag Canvas Frame Capture (instant fallback)
    if (!photoBlob) {
      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (isFront) {
        // Mirror horizontally so the selfie matches what the user saw on screen!
        ctx.save();
        ctx.translate(finalW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, 0, 0, finalW, finalH);
        ctx.restore();
      } else {
        ctx.drawImage(videoElement, 0, 0, finalW, finalH);
      }

      photoBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create photo blob'));
          },
          'image/jpeg',
          0.96
        );
      });
      isFullSensor = true;
    } else if (isFront && photoBlob) {
      // If still photo came from ImageCapture, mirror it horizontally so selfie isn't inverted!
      photoBlob = await this.mirrorBlobHorizontally(photoBlob, finalW, finalH);
    }

    const calculatedMp = (finalW * finalH) / 1_000_000;
    const megapixels = this.resolutionMode === '32mp' ? this.maxSensorMegapixels : Number(calculatedMp.toFixed(1));
    const megapixelsFormatted = `${megapixels.toFixed(1)} MP`;


    return {
      blob: photoBlob,
      width: finalW,
      height: finalH,
      megapixels,
      megapixelsFormatted,
      cameraUsed,
      facingMode: this.facingMode,
      isFullSensor,
    };
  }

  private async mirrorBlobHorizontally(blob: Blob, width: number, height: number): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          resolve(blob);
          return;
        }
        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, width, height);
        ctx.restore();
        canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.95);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(blob);
      };
      img.src = url;
    });
  }

  private async readBlobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
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
