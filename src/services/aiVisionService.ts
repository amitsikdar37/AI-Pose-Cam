import type { PosePreset, SceneAnalysisResponse, PoseLandmarks } from '../types/camera';
import { DEFAULT_POSES } from '../data/defaultPoses';

const API_KEY_STORAGE = 'gemini_api_key';
const MODEL_PREF_STORAGE = 'gemini_model_preference';

// List of legacy/deprecated model aliases to ignore
const DEPRECATED_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-1.5-pro-latest',
];

export class AIVisionService {
  private apiKey: string = '';
  private preferredModel: string = 'auto';
  private cachedModels: string[] = [];

  constructor() {
    this.apiKey = this.sanitizeApiKey(localStorage.getItem(API_KEY_STORAGE) || '');
    const storedModel = localStorage.getItem(MODEL_PREF_STORAGE) || 'auto';
    // If user previously saved a deprecated model (e.g. gemini-2.5-pro), reset to auto
    if (DEPRECATED_MODELS.includes(storedModel)) {
      this.preferredModel = 'auto';
      localStorage.setItem(MODEL_PREF_STORAGE, 'auto');
    } else {
      this.preferredModel = storedModel;
    }
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  public sanitizeApiKey(key: string): string {
    if (!key) return '';
    // Strip invisible Unicode characters, BOM, zero-width chars, non-breaking space
    let clean = key.replace(/[\u200B-\u200D\uFEFF\u00A0\r\n\t]/g, '').trim();
    // Strip quotes (including smart quotes)
    clean = clean.replace(/^[“”"''`]|["'“”'`]$/g, '').trim();
    // Strip common assignment prefixes
    clean = clean.replace(/^(?:export\s+)?(?:gemini_api_key|api_key|key)\s*[:=]\s*/i, '').trim();
    clean = clean.replace(/^Bearer\s+/i, '').trim();

    // Auto-extract modern 'AQ....' key if embedded in text
    const aqMatch = clean.match(/AQ\.[0-9A-Za-z_-]{30,75}/);
    if (aqMatch) {
      return aqMatch[0];
    }

    // Auto-extract legacy 39-character AIza key if embedded in text
    const aizaMatch = clean.match(/AIza[0-9A-Za-z_-]{35}/);
    if (aizaMatch) {
      return aizaMatch[0];
    }

    return clean.replace(/["'“”'`\s]/g, '');
  }

  public setApiKey(key: string): void {
    const clean = this.sanitizeApiKey(key);
    this.apiKey = clean;
    this.cachedModels = []; // reset cached models on key change
    if (this.apiKey) {
      localStorage.setItem(API_KEY_STORAGE, this.apiKey);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  }

  public getPreferredModel(): string {
    return this.preferredModel;
  }

  public setPreferredModel(model: string): void {
    if (DEPRECATED_MODELS.includes(model)) {
      this.preferredModel = 'auto';
    } else {
      this.preferredModel = model;
    }
    localStorage.setItem(MODEL_PREF_STORAGE, this.preferredModel);
  }

  public hasApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  public getCachedModels(): string[] {
    return this.cachedModels;
  }

  /**
   * Tests the connection with the user's API key by listing available models.
   */
  public async testConnection(): Promise<{ success: boolean; message: string; models?: string[] }> {
    if (!this.hasApiKey()) {
      return { success: false, message: 'Please enter a Gemini API key first.' };
    }

    // Reset cached models for fresh discovery
    this.cachedModels = [];

    if (this.apiKey.length < 15) {
      return {
        success: false,
        message: 'Key seems too short. Please copy the complete key from Google AI Studio.',
      };
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await fetch(endpoint);
      if (!response.ok) {
        const errText = await response.text();
        const cleanMsg = this.cleanErrorMessage(errText);
        if (response.status === 400 || cleanMsg.includes('API_KEY_INVALID') || cleanMsg.includes('API key not valid')) {
          return {
            success: false,
            message: 'Invalid API key. Google rejected this key (HTTP 400: API_KEY_INVALID). Please generate a fresh key from aistudio.google.com/apikey.',
          };
        }
        if (response.status === 403 || cleanMsg.includes('PERMISSION_DENIED')) {
          return {
            success: false,
            message: 'Permission denied (HTTP 403). Ensure "Generative Language API" is enabled in your Google Cloud / AI Studio project.',
          };
        }
        return { success: false, message: `Google error (${response.status}): ${cleanMsg}` };
      }

      const availableModels = await this.discoverAvailableModels();
      if (availableModels.length > 0) {
        const topModel = availableModels[0];
        return {
          success: true,
          message: `Connected successfully! Active model: ${topModel}`,
          models: availableModels,
        };
      }
      return {
        success: false,
        message: 'Key validated, but no active vision models found.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Connection failed. Please check your API key.',
      };
    }
  }

  /**
   * Queries Google Gemini API to discover the exact models supported by this API key,
   * automatically filtering out discontinued models and prioritizing Gemini 3.5 & 3.8 Flash.
   */
  public async discoverAvailableModels(): Promise<string[]> {
    if (this.cachedModels.length > 0) return this.cachedModels;

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
            .filter((name: string) => !DEPRECATED_MODELS.includes(name));

          // Modern priority ranking: Gemini 3.5 Flash > 3.8 Flash > 3.5 Flash-Lite > 3.8 Flash-Lite > 2.5 Flash
          const prioritized = supported.sort((a: string, b: string) => {
            const score = (name: string) => {
              if (name.includes('3.5-flash')) return 110;
              if (name.includes('3.8-flash')) return 105;
              if (name.includes('3.5-flash-lite')) return 100;
              if (name.includes('3.8-flash-lite')) return 95;
              if (name.includes('3.1-pro')) return 90;
              if (name.includes('3.8-pro')) return 85;
              if (name.includes('3.5')) return 80;
              if (name.includes('3.8')) return 75;
              if (name === 'gemini-2.5-flash') return 70;
              if (name.includes('flash')) return 60;
              if (name.includes('pro')) return 50;
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
      console.warn('Could not auto-discover models, using fallback list:', e);
    }

    // Default candidate list: 3.5-flash & 3.8-flash first!
    return [
      'gemini-3.5-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash-lite',
      'gemini-2.5-flash',
      'gemini-3.1-pro',
    ];
  }

  /**
   * Sends a single normal-quality camera frame to Google Gemini
   * to analyze surrounding environment, lighting, subject, and output an optimal bespoke pose wireframe.
   * Includes automatic retry on 503 (high demand) and fallback across models.
   */
  public async analyzeSceneAndRecommendPose(
    imageBase64: string,
    mimeType = 'image/jpeg'
  ): Promise<{ preset: PosePreset; isAIGenerated: boolean; errorNotice?: string }> {
    if (!this.hasApiKey()) {
      console.log('No Gemini API key provided, selecting intelligent contextual preset.');
      return {
        preset: this.getIntelligentFallbackPose(),
        isAIGenerated: false,
        errorNotice: 'Using Studio AI Director. (Add a Gemini API key in Settings for live vision).',
      };
    }

    const prompt = `
You are a world-class fashion photographer and portrait creative director.
Look at this single camera viewfinder snapshot from a smartphone camera.
Perform a deep visual analysis of:
1. The surroundings: lighting quality, shadows, background lines, architectural depth, environment vibe (indoor, street, cafe, studio, nature).
2. The subject in view: distance/framing (headshot, half-body, or full-body), posture, attire, vibe.

Invent the SINGLE MOST FLATTERING, AESTHETIC, BESPOKE POSE tailored specifically for this person in this exact background.
Generate normalized 2D skeletal keypoints (x, y between 0.05 and 0.95 relative to image dimensions: x=0 is left, x=1 is right; y=0 is top, y=1 is bottom).

Return ONLY a raw JSON object with this exact structure (NO markdown formatting, NO conversational text):
{
  "sceneDescription": "e.g. Warm indoor ambient lighting with clean vertical shelving background",
  "vibe": "e.g. Casual Candid Urban",
  "poseTitle": "e.g. The Asymmetric Head Tilt",
  "directionTip": "e.g. Turn shoulders 20 degrees right, tilt chin up, relax left arm naturally",
  "framing": "upper_body",
  "landmarks": {
    "nose": {"x": 0.50, "y": 0.20},
    "left_shoulder": {"x": 0.58, "y": 0.35},
    "right_shoulder": {"x": 0.42, "y": 0.35},
    "left_elbow": {"x": 0.61, "y": 0.52},
    "right_elbow": {"x": 0.38, "y": 0.50},
    "left_wrist": {"x": 0.60, "y": 0.68},
    "right_wrist": {"x": 0.43, "y": 0.65},
    "left_hip": {"x": 0.56, "y": 0.72},
    "right_hip": {"x": 0.44, "y": 0.72},
    "left_knee": {"x": 0.57, "y": 0.88},
    "right_knee": {"x": 0.43, "y": 0.88},
    "left_ankle": {"x": 0.58, "y": 0.95},
    "right_ankle": {"x": 0.44, "y": 0.95}
  }
}
`;

    // Determine model list
    let modelsToTry = await this.discoverAvailableModels();
    if (this.preferredModel !== 'auto' && !DEPRECATED_MODELS.includes(this.preferredModel)) {
      modelsToTry = [this.preferredModel, ...modelsToTry.filter((m) => m !== this.preferredModel)];
    }

    let lastError: any = null;

    // Try models in order, with automatic retry for 503 / 429
    for (const model of modelsToTry.slice(0, 6)) {
      if (DEPRECATED_MODELS.includes(model)) continue;

      for (let attempt = 0; attempt < 2; attempt++) {
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
                    {
                      inlineData: {
                        mimeType,
                        data: imageBase64,
                      },
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1024,
                responseMimeType: 'application/json',
              },
            }),
          });

          // Handle 503 (High demand) or 429 (Rate limit) with backoff
          if (response.status === 503 || response.status === 429) {
            if (attempt === 0) {
              console.warn(`Model ${model} returned ${response.status} (high demand). Retrying in 1.2s...`);
              await new Promise((r) => setTimeout(r, 1200));
              continue; // retry same model
            }
            throw new Error(`Google Gemini server busy (${response.status} high traffic).`);
          }

          // Handle 404 (Discontinued model) - skip to next model
          if (response.status === 404) {
            console.warn(`Model ${model} returned 404, skipping to next model...`);
            this.cachedModels = this.cachedModels.filter((m) => m !== model);
            lastError = new Error(`Model ${model} returned 404.`);
            break; // go to next model
          }

          // Handle invalid API key immediately (no need to try other models if key is invalid)
          if (response.status === 400 || response.status === 403) {
            const errText = await response.text();
            const clean = this.cleanErrorMessage(errText);
            if (clean.includes('API_KEY_INVALID') || clean.includes('API key not valid')) {
              throw new Error('Invalid Gemini API key. Please check your key in Settings (⚙️).');
            }
          }

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Model ${model} (${response.status}): ${this.cleanErrorMessage(errText)}`);
          }

          const data = await response.json();
          const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!candidate) throw new Error('Empty response from model');

          const parsed: SceneAnalysisResponse = this.cleanAndParseJSON(candidate);
          const bespokePreset = this.formatResponseAsPosePreset(parsed, model);
          return {
            preset: bespokePreset,
            isAIGenerated: true,
          };
        } catch (err: any) {
          console.warn(`Model ${model} (attempt ${attempt + 1}) failed:`, err);
          lastError = err;
          if (err?.message?.includes('Invalid Gemini API key')) {
            // Short circuit if key is invalid
            break;
          }
          break;
        }
      }

      if (lastError?.message?.includes('Invalid Gemini API key')) {
        break;
      }
    }

    // Clean, human-friendly error explanation
    const friendlyError = this.formatFriendlyError(lastError);
    console.error('All Gemini model calls failed:', lastError);

    return {
      preset: this.getIntelligentFallbackPose(),
      isAIGenerated: false,
      errorNotice: friendlyError,
    };
  }

  private cleanErrorMessage(raw: string): string {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.error?.message) {
        return parsed.error.message;
      }
    } catch {}
    return raw;
  }

  private formatFriendlyError(err: any): string {
    const msg = err?.message || '';
    if (msg.includes('Invalid Gemini API key') || msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      return 'Invalid Gemini API key. Please check or re-paste your key in Settings (⚙️).';
    }
    if (msg.includes('503') || msg.includes('high traffic') || msg.includes('high demand')) {
      return 'Google Gemini is currently experiencing high demand (503). Retrying usually works in a few seconds!';
    }
    if (msg.includes('429')) {
      return 'Gemini API rate limit reached. Please wait a moment and tap Retry.';
    }
    if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
      return 'Permission denied for this API key. Ensure Generative Language API is enabled.';
    }
    if (msg.includes('404')) {
      return 'Vision model not found or deprecated. Please test your key in Settings (⚙️).';
    }
    return msg ? `Connection: ${msg.slice(0, 80)}` : 'Google API is temporarily unavailable.';
  }

  private cleanAndParseJSON(raw: string): SceneAnalysisResponse {
    let text = raw.trim();
    // Use regex to locate the first outer JSON object {...}
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return JSON.parse(text);
  }

  private formatResponseAsPosePreset(data: SceneAnalysisResponse, modelUsed: string): PosePreset {
    const landmarks: PoseLandmarks = {};
    const validJoints = [
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
      'left_ankle',
      'right_ankle',
    ];

    // Robust extraction supporting {x, y}, [x, y], or numbers
    for (const joint of validJoints) {
      const pt = (data.landmarks as any)?.[joint];
      let x: number | null = null;
      let y: number | null = null;

      if (Array.isArray(pt) && pt.length >= 2) {
        x = Number(pt[0]);
        y = Number(pt[1]);
      } else if (pt && typeof pt === 'object') {
        x = Number(pt.x);
        y = Number(pt.y);
      }

      if (x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
        landmarks[joint as keyof PoseLandmarks] = {
          x: Math.max(0.05, Math.min(0.95, x)),
          y: Math.max(0.05, Math.min(0.95, y)),
        };
      }
    }

    // Fill missing joints from baseline fallback
    const fallbackPreset = DEFAULT_POSES[0];
    for (const joint of validJoints) {
      if (!landmarks[joint as keyof PoseLandmarks]) {
        landmarks[joint as keyof PoseLandmarks] = fallbackPreset.landmarks[joint as keyof PoseLandmarks];
      }
    }

    const shortModelName = modelUsed.replace('gemini-', '').toUpperCase();

    return {
      id: `ai_${Date.now()}`,
      title: data.poseTitle || 'Bespoke AI Pose',
      vibe: data.vibe || 'AI Scene Director',
      category: 'Editorial',
      framing: data.framing || 'upper_body',
      directionTip: data.directionTip || 'Follow the glowing green skeletal guide.',
      reasoning: data.sceneDescription ? `${data.sceneDescription} [${shortModelName}]` : `Bespoke pose direct from ${shortModelName}`,
      landmarks,
    };
  }

  private fallbackIndex = 0;
  public getIntelligentFallbackPose(): PosePreset {
    const preset = DEFAULT_POSES[this.fallbackIndex % DEFAULT_POSES.length];
    this.fallbackIndex++;
    return preset;
  }
}

export const aiVisionService = new AIVisionService();
