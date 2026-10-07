import type { CameraSensorInfo, CameraHardwareProfile, ResolutionMode } from '../types/camera';

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

  // Dynamic hardware sensor resolution values (no hardcoding)
  private sensorMaxWidth = 4032;
  private sensorMaxHeight = 3024;
  private maxSensorMegapixels = 12.0;
  private resolutionMode: ResolutionMode = 'max';

  // Detected hardware profiles for both cameras
  private hardwareProfiles: {
    user?: CameraHardwareProfile;
    environment?: CameraHardwareProfile;
  } = {};

  constructor() {
    this.loadStoredProfiles();
  }

  private loadStoredProfiles(): void {
    try {
      const stored = localStorage.getItem('posecam_camera_hw_profiles');
      if (stored) {
        this.hardwareProfiles = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not read cached camera hardware profiles:', e);
    }
  }

  private saveStoredProfiles(): void {
    try {
      localStorage.setItem('posecam_camera_hw_profiles', JSON.stringify(this.hardwareProfiles));
    } catch (e) {
      console.warn('Could not cache camera hardware profiles:', e);
    }
  }

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

  public getHardwareProfiles(): {
    user?: CameraHardwareProfile;
    environment?: CameraHardwareProfile;
  } {
    return this.hardwareProfiles;
  }

  private isValidVideoStream(stream: MediaStream | null): boolean {
    if (!stream) return false;
    const tracks = stream.getVideoTracks();
    if (!tracks || tracks.length === 0) return false;
    const track = tracks[0];
    return track.readyState === 'live' && track.enabled;
  }

  /**
   * Acquires the most reliable, crisp video preview stream.
   * Prioritizes standard 4:3 native preview (1920x1440) using facingMode: { ideal: facing }.
   * This allows the Android/iOS OS Camera HAL to select the primary lens,
   * initialize auto-exposure, ISP color processing, and prevents black auxiliary lens locks.
   * Extreme sensor photo resolutions are handled by ImageCapture.takePhoto() directly from the ISP.
   */
  private async obtainStream(facing: 'user' | 'environment'): Promise<MediaStream> {
    const previewConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1440 },
      aspectRatio: { ideal: 4 / 3 },
    };

    // Attempt 1: Standard facingMode with ideal preference and 4:3 preview
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
          ...previewConstraints,
        },
      });
      if (this.isValidVideoStream(stream)) {
        return stream;
      }
    } catch (err) {
      console.warn(`[CameraService] Attempt 1 (ideal ${facing} with preview dimensions) failed:`, err);
    }

    // Attempt 2: Exact facingMode with 4:3 preview
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { exact: facing },
          ...previewConstraints,
        },
      });
      if (this.isValidVideoStream(stream)) {
        return stream;
      }
    } catch (err) {
      console.warn(`[CameraService] Attempt 2 (exact ${facing} with preview dimensions) failed:`, err);
    }

    // Attempt 3: Ideal facingMode unconstrained (for devices that reject 1920x1440)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facing },
        },
      });
      if (this.isValidVideoStream(stream)) {
        return stream;
      }
    } catch (err) {
      console.warn(`[CameraService] Attempt 3 (ideal ${facing} unconstrained) failed:`, err);
    }

    // Attempt 4: Exact facingMode unconstrained
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { exact: facing },
        },
      });
      if (this.isValidVideoStream(stream)) {
        return stream;
      }
    } catch (err) {
      console.warn(`[CameraService] Attempt 4 (exact ${facing} unconstrained) failed:`, err);
    }

    // Attempt 5: Enumerate devices and target non-auxiliary matching physical camera
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');

      const matchingDevices = videoDevices.filter((d) => {
        const l = (d.label || '').toLowerCase();
        if (
          l.includes('depth') ||
          l.includes('bokeh') ||
          l.includes('tof') ||
          l.includes('ir') ||
          l.includes('infrared')
        ) {
          return false;
        }
        if (facing === 'environment') {
          return l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('0');
        } else {
          return l.includes('front') || l.includes('user') || l.includes('selfie') || l.includes('1');
        }
      });

      for (const dev of matchingDevices) {
        if (!dev.deviceId) continue;
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              deviceId: { exact: dev.deviceId },
              ...previewConstraints,
            },
          });
          if (this.isValidVideoStream(stream)) {
            return stream;
          }
        } catch {}
      }
    } catch (err) {
      console.warn('[CameraService] Attempt 5 (enumeration fallback) failed:', err);
    }

    // Attempt 6: Universal fallback to default video track
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true,
    });
  }

  public async startCamera(
    videoElement: HTMLVideoElement,
    preferredFacing: 'user' | 'environment' = 'environment'
  ): Promise<CameraSensorInfo> {
    // 1. Detach and pause current video element
    try {
      videoElement.pause();
    } catch {}
    videoElement.srcObject = null;

    // 2. Stop all previous camera tracks cleanly
    this.stopCamera();

    // 3. Android Camera2 HAL Handover Sleep (300ms)
    // Allows mobile camera driver to release hardware locks before opening the next lens
    await new Promise((resolve) => setTimeout(resolve, 300));

    this.stream = await this.obtainStream(preferredFacing);
    this.videoTrack = this.stream.getVideoTracks()[0] || null;

    // Synchronize actual facingMode reported by track settings
    const trackFacing = this.videoTrack?.getSettings?.()?.facingMode as ('user' | 'environment') | undefined;
    this.facingMode = trackFacing || preferredFacing;

    // 4. If track was initially muted (Android hardware spinup), wait for unmute
    if (this.videoTrack && this.videoTrack.muted) {
      await new Promise<void>((res) => {
        const onUnmute = () => {
          this.videoTrack?.removeEventListener('unmute', onUnmute);
          res();
        };
        this.videoTrack?.addEventListener('unmute', onUnmute);
        setTimeout(res, 500);
      });
    }

    // 5. Attach new stream to video element
    videoElement.srcObject = this.stream;
    videoElement.playsInline = true;
    videoElement.muted = true;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('autoplay', 'true');

    // 6. Wait for loadedmetadata or active playback so viewfinder never freezes on black
    await new Promise<void>((resolve) => {
      if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
        resolve();
      } else {
        let isDone = false;
        const done = () => {
          if (!isDone) {
            isDone = true;
            videoElement.removeEventListener('loadedmetadata', done);
            videoElement.removeEventListener('canplay', done);
            videoElement.removeEventListener('playing', done);
            resolve();
          }
        };
        videoElement.addEventListener('loadedmetadata', done);
        videoElement.addEventListener('canplay', done);
        videoElement.addEventListener('playing', done);
        videoElement.play().catch(() => {});
        setTimeout(done, 1000);
      }
    });

    try {
      await videoElement.play();
    } catch (e) {
      console.warn('Video element play warning:', e);
    }

    // 7. Initialize ImageCapture API if supported by browser
    if (this.videoTrack && 'ImageCapture' in window) {
      try {
        // @ts-ignore
        this.imageCapture = new (window as any).ImageCapture(this.videoTrack);
      } catch (e) {
        console.warn('ImageCapture constructor error:', e);
      }
    }

    // 8. Reset zoom to 1.0 (min zoom)
    if (this.videoTrack) {
      try {
        const caps = (this.videoTrack.getCapabilities?.() || {}) as any;
        if (caps.zoom) {
          const minZoom = caps.zoom.min || 1.0;
          await this.videoTrack.applyConstraints({
            // @ts-ignore
            advanced: [{ zoom: minZoom }],
          });
        }
      } catch (e) {
        console.warn('Could not reset zoom to min:', e);
      }
    }

    // 9. Dynamically discover and register hardware sensor capabilities
    await this.inspectAndRegisterHardware(this.facingMode);

    return this.getSensorInfo();
  }

  /**
   * Inspects the active camera sensor and determines true maximum hardware capabilities
   */
  private async inspectAndRegisterHardware(facing: 'user' | 'environment'): Promise<void> {
    let maxWidth = 1920;
    let maxHeight = 1080;
    let hasImageCapture = false;
    let torchAvailable = false;
    let zoomMin: number | undefined;
    let zoomMax: number | undefined;

    if (this.videoTrack) {
      const settings = this.videoTrack.getSettings?.() || {};
      maxWidth = settings.width || 1920;
      maxHeight = settings.height || 1080;

      const caps = (this.videoTrack.getCapabilities?.() || {}) as any;
      if (caps.width?.max) maxWidth = Math.max(maxWidth, caps.width.max);
      if (caps.height?.max) maxHeight = Math.max(maxHeight, caps.height.max);
      if (caps.torch) torchAvailable = true;
      if (caps.zoom) {
        zoomMin = caps.zoom.min;
        zoomMax = caps.zoom.max;
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

    // Normalize landscape orientation for sensor specs (e.g. 4032 x 3024)
    const normalizedW = Math.max(maxWidth, maxHeight);
    const normalizedH = Math.min(maxWidth, maxHeight);
    const maxMegapixels = Number(((normalizedW * normalizedH) / 1_000_000).toFixed(1));

    // Determine target facing profile bucket
    const trackLabel = (this.videoTrack?.label || '').toLowerCase();
    let detectedFacing = facing;
    if (trackLabel.includes('front') || trackLabel.includes('user') || trackLabel.includes('selfie')) {
      detectedFacing = 'user';
    } else if (trackLabel.includes('back') || trackLabel.includes('rear') || trackLabel.includes('environment')) {
      detectedFacing = 'environment';
    }

    const label = this.videoTrack?.label || (detectedFacing === 'user' ? 'Front Camera' : 'Back Camera');

    // Update current active sensor parameters
    this.sensorMaxWidth = normalizedW;
    this.sensorMaxHeight = normalizedH;
    this.maxSensorMegapixels = maxMegapixels;

    // Cache the detected hardware profile for this camera facing
    this.hardwareProfiles[detectedFacing] = {
      facing: detectedFacing,
      label,
      deviceId: this.videoTrack?.getSettings?.()?.deviceId,
      maxWidth: normalizedW,
      maxHeight: normalizedH,
      maxMegapixels,
      hasImageCapture,
      supportsTorch: torchAvailable,
      zoomMin,
      zoomMax,
    };

    this.saveStoredProfiles();
  }

  public async setZoom(zoomLevel: number): Promise<boolean> {
    if (!this.videoTrack) return false;
    try {
      const caps = (this.videoTrack.getCapabilities?.() || {}) as any;
      if (caps.zoom) {
        const target = Math.max(caps.zoom.min || 1, Math.min(caps.zoom.max || 1, zoomLevel));
        await this.videoTrack.applyConstraints({
          // @ts-ignore
          advanced: [{ zoom: target }],
        });
        return true;
      }
    } catch (e) {
      console.warn('Set zoom error:', e);
    }
    return false;
  }

  public async switchCamera(videoElement: HTMLVideoElement): Promise<CameraSensorInfo> {
    const currentActualFacing =
      (this.videoTrack?.getSettings?.()?.facingMode as ('user' | 'environment') | undefined) ||
      this.facingMode;
    const nextFacing: 'user' | 'environment' = currentActualFacing === 'user' ? 'environment' : 'user';
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
    const isFront = this.facingMode === 'user';
    let cameraLabel = isFront ? 'Front Camera (Selfie)' : 'Back Camera (Main Lens)';
    let torchAvailable = false;
    let zoomMin: number | undefined;
    let zoomMax: number | undefined;
    let zoomCurrent: number | undefined;

    if (this.videoTrack) {
      const settings = this.videoTrack.getSettings?.() || {};
      if (this.videoTrack.label) {
        cameraLabel = this.videoTrack.label;
      }

      const caps = (this.videoTrack.getCapabilities?.() || {}) as any;
      if (caps.torch) torchAvailable = true;
      if (caps.zoom) {
        zoomMin = caps.zoom.min;
        zoomMax = caps.zoom.max;
        zoomCurrent = (settings as any).zoom || zoomMin;
      }
    }

    return {
      maxWidth: this.sensorMaxWidth,
      maxHeight: this.sensorMaxHeight,
      maxMegapixels: this.maxSensorMegapixels,
      hasImageCapture: Boolean(this.imageCapture),
      facingMode: this.facingMode,
      torchAvailable,
      cameraLabel,
      zoomMin,
      zoomMax,
      zoomCurrent,
      resolutionMode: this.resolutionMode,
      hardwareProfiles: this.hardwareProfiles,
    };
  }

  /**
   * Captures the photo at the MAXIMUM optical/digital sensor capability dynamically.
   * Uses ImageCapture still hardware snapshot when available, with a sufficient 3000ms timeout
   * so mobile camera ISPs have time to autofocus, expose, and compress the full-resolution photo.
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

    const vWidth = videoElement.videoWidth || 1920;
    const vHeight = videoElement.videoHeight || 1080;

    let photoBlob: Blob | null = null;
    let isFullSensor = false;

    // Calculate orientation-aware target dimensions based on detected hardware max
    const isPortrait = vHeight > vWidth || (typeof window !== 'undefined' && window.innerHeight > window.innerWidth);
    let targetW = this.sensorMaxWidth > 0 ? this.sensorMaxWidth : 4032;
    let targetH = this.sensorMaxHeight > 0 ? this.sensorMaxHeight : 3024;

    if (this.resolutionMode === '12mp') {
      targetW = 4032;
      targetH = 3024;
    }

    let finalW = isPortrait ? Math.min(targetW, targetH) : Math.max(targetW, targetH);
    let finalH = isPortrait ? Math.max(targetW, targetH) : Math.min(targetW, targetH);

    // 1. Try Still Sensor Capture via ImageCapture API
    if (this.imageCapture) {
      try {
        const photoCaps = await this.imageCapture.getPhotoCapabilities().catch(() => null);
        const photoSettings: any = {};
        
        if (this.resolutionMode === 'max' && photoCaps?.imageWidth?.max && photoCaps?.imageHeight?.max) {
          photoSettings.imageWidth = photoCaps.imageWidth.max;
          photoSettings.imageHeight = photoCaps.imageHeight.max;
        } else if (photoCaps?.imageWidth?.max) {
          photoSettings.imageWidth = Math.min(photoCaps.imageWidth.max, targetW);
          photoSettings.imageHeight = Math.min(photoCaps?.imageHeight?.max || targetH, targetH);
        } else {
          photoSettings.imageWidth = targetW;
          photoSettings.imageHeight = targetH;
        }

        // Give mobile camera ISP up to 3000ms for autofocus, metering, and full-resolution JPEG compression
        const takePhotoPromise = this.imageCapture.takePhoto(photoSettings);
        const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 3000));
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
        console.warn('ImageCapture hardware capture skipped or timed out:', e);
      }
    }

    // 2. High-Precision Full-Resolution Fallback (grabs native stream bitmap or canvas)
    if (!photoBlob) {
      let sourceBitmap: ImageBitmap | null = null;
      if (this.imageCapture && 'grabFrame' in this.imageCapture) {
        try {
          sourceBitmap = await this.imageCapture.grabFrame();
        } catch {}
      }

      const nativeSourceW = sourceBitmap?.width || videoElement.videoWidth || 1920;
      const nativeSourceH = sourceBitmap?.height || videoElement.videoHeight || 1080;

      const useW = Math.max(nativeSourceW, finalW);
      const useH = Math.max(nativeSourceH, finalH);

      const canvas = document.createElement('canvas');
      canvas.width = useW;
      canvas.height = useH;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (isFront) {
        // Mirror horizontally so the selfie matches what the user saw in their viewfinder
        ctx.save();
        ctx.translate(useW, 0);
        ctx.scale(-1, 1);
        if (sourceBitmap) {
          ctx.drawImage(sourceBitmap, 0, 0, useW, useH);
        } else {
          ctx.drawImage(videoElement, 0, 0, useW, useH);
        }
        ctx.restore();
      } else {
        if (sourceBitmap) {
          ctx.drawImage(sourceBitmap, 0, 0, useW, useH);
        } else {
          ctx.drawImage(videoElement, 0, 0, useW, useH);
        }
      }

      if (sourceBitmap && 'close' in sourceBitmap) {
        try {
          sourceBitmap.close();
        } catch {}
      }

      photoBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create photo blob'));
          },
          'image/jpeg',
          0.97
        );
      });
      finalW = useW;
      finalH = useH;
      isFullSensor = true;
    } else if (isFront && photoBlob) {
      // Mirror the hardware still photo horizontally so selfie isn't flipped inverted
      photoBlob = await this.mirrorBlobHorizontally(photoBlob, finalW, finalH);
    }

    // Calculate ACTUAL Megapixels from real produced dimensions
    const calculatedMp = (finalW * finalH) / 1_000_000;
    const megapixels = Number(calculatedMp.toFixed(1));
    const megapixelsFormatted = `${megapixels.toFixed(1)} MP`;

    const cameraUsed = isFront
      ? `Front Camera (${megapixelsFormatted} Native)`
      : `Back Camera (${megapixelsFormatted} Native)`;

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
        canvas.toBlob((b) => resolve(b || blob), 'image/jpeg', 0.96);
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

  public stopCamera(videoElement?: HTMLVideoElement | null): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Track stop warning:', e);
        }
      });
      this.stream = null;
    }
    if (videoElement) {
      try {
        videoElement.pause();
      } catch {}
      videoElement.srcObject = null;
    }
    this.videoTrack = null;
    this.imageCapture = null;
    this.torchEnabled = false;
  }
}

export const cameraService = new CameraService();
