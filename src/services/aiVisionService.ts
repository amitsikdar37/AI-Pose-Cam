import type { AIPoseSuggestion } from '../types/camera';
import { InferenceClient } from '@huggingface/inference';

const API_KEY_STORAGE = 'gemini_api_key';
const MODEL_PREF_STORAGE = 'gemini_model_preference';
const HF_TOKEN_STORAGE = 'hf_api_token';
const POLLINATIONS_KEY_STORAGE = 'pollinations_api_key';

export class AIVisionService {
  private apiKey: string = '';
  private hfToken: string = '';
  private pollinationsKey: string = '';
  private preferredModel: string = 'auto';
  private cachedModels: string[] = [];

  constructor() {
    const envKey = typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GEMINI_API_KEY || ''
      : '';
    this.apiKey = this.sanitizeApiKey(
      localStorage.getItem(API_KEY_STORAGE) || envKey
    );
    this.hfToken = (localStorage.getItem(HF_TOKEN_STORAGE) || '').trim();
    this.pollinationsKey = (localStorage.getItem(POLLINATIONS_KEY_STORAGE) || '').trim();
    const storedModel = localStorage.getItem(MODEL_PREF_STORAGE) || 'gemini-3.5-flash';
    const legacyDiscontinued = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-pro',
      'gemini-3.1-pro-preview',
      'auto',
    ];
    if (legacyDiscontinued.includes(storedModel)) {
      this.preferredModel = 'gemini-3.5-flash';
      localStorage.setItem(MODEL_PREF_STORAGE, 'gemini-3.5-flash');
    } else {
      this.preferredModel = storedModel;
    }
  }

  public getHfToken(): string {
    return this.hfToken;
  }

  public setHfToken(token: string): void {
    this.hfToken = (token || '').replace(/["';\s\\]/g, '').trim();
    if (this.hfToken) {
      localStorage.setItem(HF_TOKEN_STORAGE, this.hfToken);
    } else {
      localStorage.removeItem(HF_TOKEN_STORAGE);
    }
  }

  public getPollinationsKey(): string {
    return this.pollinationsKey;
  }

  public setPollinationsKey(key: string): void {
    this.pollinationsKey = (key || '').replace(/["';\s\\]/g, '').trim();
    if (this.pollinationsKey) {
      localStorage.setItem(POLLINATIONS_KEY_STORAGE, this.pollinationsKey);
    } else {
      localStorage.removeItem(POLLINATIONS_KEY_STORAGE);
    }
  }

  public sanitizeApiKey(key: string): string {
    if (!key) return '';
    return key.replace(/["';\s\\]/g, '').trim();
  }

  public setApiKey(key: string): void {
    this.apiKey = this.sanitizeApiKey(key);
    this.cachedModels = [];
    if (this.apiKey) {
      localStorage.setItem(API_KEY_STORAGE, this.apiKey);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public setPreferredModel(model: string): void {
    this.preferredModel = model;
    localStorage.setItem(MODEL_PREF_STORAGE, model);
  }

  public getPreferredModel(): string {
    return this.preferredModel;
  }

  public hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  /**
   * Queries Google Gemini API to discover supported models for this API key,
   * prioritizing Gemini 1.5 Pro (deep vision) and 2.0 Flash.
   */
  public async discoverAvailableModels(): Promise<string[]> {
    if (this.cachedModels.length > 0) return this.cachedModels;

    if (!this.hasApiKey()) {
      return ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.models)) {
          const supported = data.models
            .filter((m: any) =>
              Array.isArray(m.supportedGenerationMethods) &&
              m.supportedGenerationMethods.includes('generateContent')
            )
            .map((m: any) => m.name.replace(/^models\//, ''))
            .filter((name: string) => name.startsWith('gemini'));

          // Priority ranking: 3.5-flash > 3.8-flash > 3.5-flash-lite > 2.5-flash
          const prioritized = supported.sort((a: string, b: string) => {
            const score = (name: string) => {
              if (name === 'gemini-3.5-flash') return 120;
              if (name === 'gemini-3.8-flash') return 115;
              if (name === 'gemini-3.5-flash-lite') return 110;
              if (name === 'gemini-2.5-flash') return 90;
              if (name.includes('3.5-flash')) return 85;
              if (name.includes('3.8-flash')) return 80;
              if (name.includes('flash')) return 60;
              return 10;
            };
            return score(b) - score(a);
          });

          if (prioritized.length > 0) {
            this.cachedModels = prioritized;
            return prioritized;
          }
        }
      }
    } catch (e) {
      console.warn('Could not auto-discover models:', e);
    }

    return ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-flash'];
  }

  public async testConnection(key?: string): Promise<{ success: boolean; message: string; models?: string[] }> {
    const cleanKey = this.sanitizeApiKey(key || this.apiKey);
    if (!cleanKey) {
      return { success: false, message: 'Please enter a Gemini API key first.' };
    }

    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
      if (!resp.ok) {
        const errText = await resp.text();
        if (resp.status === 400 || errText.includes('API_KEY_INVALID')) {
          return { success: false, message: 'Invalid API key. Google rejected this key (HTTP 400: API_KEY_INVALID).' };
        }
        if (resp.status === 403 || errText.includes('PERMISSION_DENIED')) {
          return { success: false, message: 'Permission denied (HTTP 403). Make sure Generative Language API is enabled.' };
        }
        return { success: false, message: `Google returned error status ${resp.status}. Please verify your key.` };
      }
      const data = await resp.json();
      const models: string[] = (data.models || [])
        .map((m: any) => m.name.replace('models/', ''))
        .filter((n: string) => n.startsWith('gemini'));

      return {
        success: true,
        message: `Connected successfully! Found ${models.length} Gemini models.`,
        models,
      };
    } catch (e: any) {
      return { success: false, message: `Network error: ${e?.message || 'Could not connect'}` };
    }
  }

  /**
   * Tests Hugging Face token against the API to verify inference permissions.
   */
  public async testHfToken(token?: string): Promise<{ success: boolean; message: string; username?: string }> {
    const cleanToken = (token || this.hfToken).replace(/["';\s\\]/g, '').trim();
    if (!cleanToken) {
      return { success: false, message: 'Please enter a Hugging Face token first.' };
    }

    let username = 'user';
    try {
      // 1. Check user profile & authentication
      const whoamiResp = await fetch('https://huggingface.co/api/whoami-v2', {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });

      if (whoamiResp.status === 401) {
        return { success: false, message: 'Invalid token (HTTP 401). Please check the token string on huggingface.co.' };
      }

      if (whoamiResp.ok) {
        const whoami = await whoamiResp.json().catch(() => ({}));
        username = whoami?.name || whoami?.fullname || 'user';
      }

      // 2. Test actual Inference with official client
      const client = new InferenceClient(cleanToken);
      await client.textToImage({
        model: 'black-forest-labs/FLUX.1-schnell',
        inputs: 'candid photo test',
      });

      return {
        success: true,
        message: `Connected as @${username}! FLUX.1 [schnell] is verified and active for 1024px studio photorealism.`,
        username,
      };
    } catch (err: any) {
      const msg = err?.message || '';
      const lower = msg.toLowerCase();
      if (lower.includes('no remaining credits') || lower.includes('credits') || lower.includes('subscribe to pro')) {
        return {
          success: false,
          message: `Credits Exhausted: Your Hugging Face account (@${username}) has used up its free serverless trial credits ($0.00 remaining). Hugging Face free credits are limited per account. You can create a token from a new free HF account, top up prepaid credits at huggingface.co/settings/billing, or use Pose Cam's built-in Free AI fallback.`,
        };
      }
      if (lower.includes('permission') || lower.includes('unauthorized') || (msg.includes('403') && !lower.includes('credit'))) {
        return {
          success: false,
          message: 'Permission Issue (HTTP 403): Token is missing "Inference Providers" permission. When creating a token on huggingface.co/settings/tokens, select Token type "Write" (or check "Make calls to Inference Providers").',
        };
      }
      return {
        success: false,
        message: `Hugging Face test note: ${msg || 'Could not verify token'}`,
      };
    }
  }

  /**
   * Generates a photorealistic reference image from an image generation prompt.
   * Priority:
   * 1. Hugging Face Serverless FLUX.1 [schnell] / SDXL (if HF Token is provided) -> 12B parameter studio quality!
   * 2. Pollinations FLUX.1 (if Pollinations Key is provided)
   * 3. Google Imagen 3 (if available on Gemini key)
   * 4. Zero-Key Fallback with enhanced photographic realism conditioning
   */
  public async generateImageFromPrompt(
    prompt: string,
    aspectRatio: '3:4' | '1:1' = '1:1'
  ): Promise<{ imageUrl: string; engine: string; fallbackReason?: string }> {
    const clean = prompt
      .replace(/[\n\r]+/g, ' ')
      .replace(/["']/g, '')
      .trim();

    let fallbackReason: string | undefined;

    // 1. Hugging Face Serverless Inference: FLUX.1 [schnell] / SDXL
    if (this.hfToken) {
      const hfModels = [
        'black-forest-labs/FLUX.1-schnell',
        'stabilityai/stable-diffusion-xl-base-1.0',
      ];

      for (const m of hfModels) {
        try {
          const client = new InferenceClient(this.hfToken);
          const isSelfiePrompt = clean.toLowerCase().includes('selfie') || clean.toLowerCase().includes('head and shoulders');
          const hfInputs = isSelfiePrompt
            ? (clean.startsWith('RAW') || clean.startsWith('A photorealistic') ? clean : `RAW close-up selfie portrait, ${clean}`)
            : (clean.startsWith('RAW') || clean.startsWith('A photorealistic') ? clean : `RAW candid photograph of a stylish fully clothed person, ${clean}, 35mm lens, sharp focus, natural skin texture`);

          const result: any = await client.textToImage({
            model: m,
            inputs: hfInputs,
          });

          if (result && typeof result === 'object' && 'size' in result && result.size > 1000) {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(result as Blob);
            });
            const engineLabel = m.includes('FLUX') ? 'FLUX.1 [schnell]' : 'SDXL 1.0';
            return { imageUrl: dataUrl, engine: engineLabel };
          } else if (typeof result === 'string' && result.length > 100) {
            const engineLabel = m.includes('FLUX') ? 'FLUX.1 [schnell]' : 'SDXL 1.0';
            return { imageUrl: result, engine: engineLabel };
          }
        } catch (hfErr: any) {
          const errText = hfErr?.message || '';
          const lower = errText.toLowerCase();
          if (lower.includes('no remaining credits') || lower.includes('credits') || lower.includes('subscribe to pro')) {
            fallbackReason = 'Hugging Face free trial credits exhausted. Automatically using Free AI engine.';
          } else if (errText.includes('403') || errText.includes('permission')) {
            fallbackReason = 'HF Token missing "Inference Providers" permission (HTTP 403). Create a "Write" token on huggingface.co.';
          } else if (errText.includes('401')) {
            fallbackReason = 'HF Token is invalid (HTTP 401). Check token in Settings.';
          } else {
            fallbackReason = `HF (${m}) error: ${errText}`;
          }
          console.warn(`Hugging Face inference error (${m}):`, hfErr);
        }
      }
    }

    // 2. Pollinations Authenticated (Unlocks genuine FLUX & Turbo with Pollen)
    if (this.pollinationsKey) {
      try {
        const seed = Math.floor(Math.random() * 9999999) + 1;
        const encoded = encodeURIComponent(`RAW 35mm photograph, fully clothed person, ${clean}, natural lighting`);
        const url = `https://image.pollinations.ai/prompt/${encoded}?model=flux&key=${this.pollinationsKey}&nologo=true&seed=${seed}`;
        return { imageUrl: url, engine: 'FLUX.1 (Pollinations)' };
      } catch (pollErr) {
        console.warn('Pollinations key error:', pollErr);
      }
    }

    // 3. Google Imagen 3 API if key is set
    if (this.apiKey) {
      try {
        const imagenEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${this.apiKey}`;
        const resp = await fetch(imagenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: clean }],
            parameters: {
              sampleCount: 1,
              aspectRatio: aspectRatio === '3:4' ? '3:4' : '1:1',
              outputMimeType: 'image/jpeg',
            },
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const base64Data = data.predictions?.[0]?.bytesBase64Encoded;
          if (base64Data) {
            return { imageUrl: `data:image/jpeg;base64,${base64Data}`, engine: 'Google Imagen 3' };
          }
        }
      } catch (err) {
        console.warn('Imagen 3 skipped:', err);
      }
    }

    // 4. Zero-Key Fast Fallback with anti-doll / realistic clothing conditioning
    const isSelfie = clean.toLowerCase().includes('selfie') || clean.toLowerCase().includes('head and shoulders');
    const qualityPrefix = isSelfie
      ? 'RAW color selfie portrait photograph, candid close-up of stylish fully clothed person,'
      : 'RAW color photograph, candid 35mm photo of stylish fully clothed person,';
    const qualitySuffix = isSelfie
      ? 'natural flattering lighting on face, sharp focus on eyes, realistic human skin texture'
      : 'real human skin texture, natural pose, sharp focus, ambient lighting';
    const finalPrompt = `${qualityPrefix} ${clean}, ${qualitySuffix}`.slice(0, 360);

    const seed = Math.floor(Math.random() * 9999999) + 1;
    const encoded = encodeURIComponent(finalPrompt);
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}?enhance=false&nologo=true&seed=${seed}`;

    return {
      imageUrl: fallbackUrl,
      engine: 'Free AI (Pollinations SANA)',
      fallbackReason,
    };
  }

  /**
   * Core Vision Pipeline:
   * 1. Sends the live camera frame to Google Gemini Multimodal Vision API.
   * 2. Gemini inspects camera mode (Selfie vs Rear) and the live snapshot framing.
   * 3. If Selfie: crafts an upper-body / head-and-shoulders selfie pose with flattering angles & gestures.
   * 4. If Rear camera: crafts an environmental medium or full-body pose interacting with scene objects.
   * 5. Prompts the image generation model with matching shot framing.
   */
  public async analyzeSceneAndGeneratePose(
    base64Image: string,
    mimeType = 'image/jpeg',
    options?: {
      facingMode?: 'user' | 'environment';
      previousTitles?: string[];
    }
  ): Promise<AIPoseSuggestion> {
    if (!this.hasApiKey()) {
      throw new Error(
        'Please enter a Google Gemini API Key in Settings to enable real-time camera scene analysis.'
      );
    }

    const isFront = options?.facingMode === 'user';
    const cameraContext = isFront
      ? 'FRONT-FACING SELFIE CAMERA: The user is holding the phone in hand at arm\'s length taking a selfie portrait. Only head, shoulders, and chest are visible.'
      : 'REAR MAIN CAMERA: The phone is pointing outward at the subject/room (medium to full-body distance).';

    const exclusionNotice =
      options?.previousTitles && options.previousTitles.length > 0
        ? `PREVIOUS POSES ALREADY SUGGESTED: ${options.previousTitles.join(', ')}.\nCRITICAL: Do NOT repeat these exact poses. Devise a fresh creative variation or different posture angle for the scene.`
        : '';

    const prompt = `You are a world-class professional photographer and creative pose director.
Inspect this live camera viewfinder snapshot very carefully.

CAMERA HARDWARE CONTEXT:
${cameraContext}

STEP 1: SHOT FRAMING & USER INTENTION RECOGNITION (CRITICAL FIRST STEP):
Determine whether the user is taking a SELFIE (front-facing hand-held portrait) or a REAR-CAMERA ENVIRONMENT SHOT:

- SCENARIO A: USER IS TAKING A SELFIE (Front camera is active OR user's face and upper torso dominate the viewfinder at close range):
  * The user is holding their smartphone in hand at arm's length!
  * ABSOLUTE PROHIBITION: DO NOT recommend full-body poses! NEVER tell the user to show their legs, feet, or sit far back in a distant chair. The user physically CANNOT take a full-body photo while holding a selfie camera!
  * Framing MUST BE: Head-and-shoulders, bust, or close-up self-portrait.
  * What to direct for Selfies:
    - Head & jawline angle: 3/4 turn to the primary light source, chin slightly lowered or angled up to sharpen jawline, eyes making direct confident or relaxed contact with the lens.
    - Shoulder rotation: Angling one shoulder slightly forward toward the camera to create depth (avoiding flat passport-style shoulders).
    - Natural hand gestures in frame: Hand gently resting on jawline, fingers touching chin or hair, adjusting glasses or collar, resting chin on palm/knuckles, or casual hand holding the phone at high/low 45-degree angle.
    - Subtle background interaction: If background furniture (chair headrest, car headrest, bed pillow, wall, window) is visible behind the user, instruct them to lean their head or upper back lightly against it as a background accent, but KEEP the shot strictly head-and-shoulders!
  * "imagePrompt" for Selfie:
    MUST be: "A photorealistic candid selfie photograph of a stylish fully clothed person, close-up head-and-shoulders portrait framing, smartphone camera angle held at arm's length, [exact head tilt and shoulder angle], [hand touching chin/hair if specified], [subtle background setting hints], natural flattering lighting on face, sharp focus on eyes and facial features, 8k, realistic human skin texture".

- SCENARIO B: REAR CAMERA / ENVIRONMENT SHOT (Subject at medium or full-body distance):
  * The phone is pointing outward at a person or space from 1.5 to 4 meters away.
  * Recommend a natural pose interacting with the primary physical object in the frame (e.g. seated in chair/couch with natural leg cross, leaning against a wall/railing, sitting on steps, standing with weight shifted).
  * "imagePrompt" for Rear Camera:
    MUST be: "A photorealistic candid photograph of a stylish fully clothed person, [medium or full-body framing], [outfit], [exact pose interacting with detected objects], 50mm portrait lens, natural ambient lighting, 8k, realistic human anatomy".

STEP 2: SCENE OBJECT IDENTIFICATION:
- Identify 1 to 4 dominant physical objects, furniture, or architectural elements visible in the frame (e.g. chair, wall, window, desk, pillow, shelf).

STEP 3: POSE RECOMMENDATION:
- Devise a creative, stylish pose matching the user's camera mode (Selfie vs Rear environment).
${exclusionNotice}

STEP 4: OUTPUT JSON FORMAT:
Return ONLY valid JSON matching this exact structure:
{
  "sceneObjects": ["Object 1", "Object 2"],
  "title": "Short Catchy Pose Title (e.g. 'The Angled Jawline Glance', 'The Casual Headrest Lean', 'The Studio Wall Slant')",
  "vibe": "Aesthetic Vibe (e.g. 'Candid Golden Hour', 'Clean Minimalist Selfie', 'Effortless Streetwear')",
  "directionTip": "2-3 clear, friendly, actionable sentences instructing the user how to position their head, shoulders, face, and hands according to their camera framing.",
  "imagePrompt": "Photorealistic prompt formatted strictly according to SCENARIO A (for selfie) or SCENARIO B (for rear camera)."
}`;

    const discovered = await this.discoverAvailableModels();
    const modelsToTry = this.preferredModel !== 'auto'
      ? [this.preferredModel, ...discovered.filter((m) => m !== this.preferredModel)]
      : discovered;

    let parsedResult: {
      title: string;
      vibe: string;
      directionTip: string;
      sceneObjects: string[];
      imagePrompt: string;
    } | null = null;

    let lastError: string = '';

    for (const model of modelsToTry.slice(0, 4)) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType, data: base64Image } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          if (response.status === 400 && errText.includes('API_KEY_INVALID')) {
            throw new Error('Invalid Gemini API Key. Please verify your key in Settings.');
          }
          if (response.status === 429) {
            lastError = 'Gemini quota exceeded (HTTP 429). Please wait a moment.';
            continue;
          }
          lastError = `Google Gemini (${model}) error HTTP ${response.status}: ${errText.slice(0, 100)}`;
          continue;
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        const match = rawText.match(/\{[\s\S]*\}/);
        const jsonStr = match ? match[0] : rawText;
        const candidate = JSON.parse(jsonStr);

        if (candidate?.title && candidate?.imagePrompt && candidate?.directionTip) {
          parsedResult = candidate;
          break;
        }
      } catch (err: any) {
        lastError = err?.message || 'Vision request failed';
        if (err?.message?.includes('Invalid Gemini API Key')) {
          throw err;
        }
      }
    }

    if (!parsedResult) {
      throw new Error(
        lastError || 'Could not analyze scene with Gemini Vision. Please check your API key in Settings.'
      );
    }

    // Step 2: Generate the Reference Photo from the Vision Model's Prompt!
    const { imageUrl, engine, fallbackReason } = await this.generateImageFromPrompt(
      parsedResult.imagePrompt,
      '1:1'
    );

    return {
      id: `ai_pose_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: parsedResult.title,
      vibe: parsedResult.vibe || 'AI Scene Director',
      directionTip: parsedResult.directionTip,
      sceneObjects: parsedResult.sceneObjects || [],
      imagePrompt: parsedResult.imagePrompt,
      referenceImageUrl: imageUrl,
      imageEngine: engine,
      fallbackReason,
      createdAt: Date.now(),
      cameraFacing: options?.facingMode || 'environment',
      generationEngine: 'gemini_vision',
    };
  }
}

export const aiVisionService = new AIVisionService();
