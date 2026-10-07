import type { AIPoseSuggestion } from '../types/camera';

const API_KEY_STORAGE = 'gemini_api_key';
const MODEL_PREF_STORAGE = 'gemini_model_preference';

export class AIVisionService {
  private apiKey: string = '';
  private preferredModel: string = 'gemini-2.5-flash';

  constructor() {
    this.apiKey = this.sanitizeApiKey(
      localStorage.getItem(API_KEY_STORAGE) || (import.meta as any).env?.VITE_GEMINI_API_KEY || ''
    );
    this.preferredModel = localStorage.getItem(MODEL_PREF_STORAGE) || 'gemini-2.5-flash';
  }

  public sanitizeApiKey(key: string): string {
    if (!key) return '';
    return key.replace(/["';\s\\]/g, '').trim();
  }

  public setApiKey(key: string): void {
    this.apiKey = this.sanitizeApiKey(key);
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
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  public async testConnection(key?: string): Promise<{ success: boolean; message: string; models?: string[] }> {
    const cleanKey = this.sanitizeApiKey(key || this.apiKey);
    if (!cleanKey) {
      return { success: false, message: 'API key is empty.' };
    }

    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
      if (!resp.ok) {
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
   * Generates a photorealistic reference image from an image generation prompt.
   * 1. Attempts Google Imagen 3 if API key is available.
   * 2. Seamlessly falls back to fast, high-quality Pollinations Flux generation.
   */
  public async generateImageFromPrompt(
    prompt: string,
    aspectRatio: '3:4' | '1:1' = '3:4'
  ): Promise<string> {
    // 1. Try Google Imagen 3 API if key is set
    if (this.apiKey) {
      try {
        const imagenEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${this.apiKey}`;
        const resp = await fetch(imagenEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: {
              sampleCount: 1,
              aspectRatio,
              outputMimeType: 'image/jpeg',
            },
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const base64Data = data.predictions?.[0]?.bytesBase64Encoded;
          if (base64Data) {
            return `data:image/jpeg;base64,${base64Data}`;
          }
        } else {
          console.warn('Google Imagen 3 returned non-OK, using high-speed Flux fallback:', resp.status);
        }
      } catch (err) {
        console.warn('Imagen 3 fetch failed, switching to Flux fallback:', err);
      }
    }

    // 2. High-speed Pollinations Flux fallback (100% free, reliable, instant, 0 key required)
    const cleanPrompt = prompt
      .replace(/[\n\r]+/g, ' ')
      .replace(/["']/g, '')
      .trim()
      .slice(0, 400);

    const encoded = encodeURIComponent(cleanPrompt);
    const [width, height] = aspectRatio === '3:4' ? [768, 1024] : [1024, 1024];
    return `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&model=flux`;
  }

  /**
   * Full AI Director Pipeline:
   * 1. Analyzes the live camera frame to detect physical scene objects, lighting, and framing.
   * 2. Formulates a tailored human pose utilizing those objects.
   * 3. Crafts a tailored photorealistic image generation prompt.
   * 4. Synthesizes the reference photo via text-to-image AI.
   * 5. Returns a rich AIPoseSuggestion for the Picture-in-Picture reference card.
   */
  public async analyzeSceneAndGeneratePose(
    base64Image: string,
    mimeType = 'image/jpeg',
    options?: {
      facingMode?: 'user' | 'environment';
      previousTitle?: string;
    }
  ): Promise<AIPoseSuggestion> {
    const isFront = options?.facingMode === 'user';
    const cameraModeDesc = isFront
      ? 'Front-facing selfie camera (close-up to upper-body portrait distance)'
      : 'Rear main camera (subject in environment, portrait to full-body)';

    const prompt = `You are a world-class professional photographer and creative pose director.
Analyze this live camera frame and craft a creative photography pose idea tailored specifically to this scene.

CAMERA CONTEXT: ${cameraModeDesc}.
${options?.previousTitle ? `Previous pose suggested was "${options.previousTitle}". Suggest a fresh, different pose idea.` : ''}

CRITICAL REQUIREMENTS:
1. SCENE OBJECT IDENTIFICATION: Detect specific physical objects, furniture, architecture, or elements in the frame (e.g. "leather armchair", "wooden cafe table", "concrete wall", "staircase steps", "doorway", "coffee mug", "balcony railing", "park grass", "sunlit window").
2. OBJECT UTILIZATION: The suggested pose MUST actively use or interact with one or more of these detected objects (e.g., sitting on it, leaning against it, propping an arm/foot, holding a prop, or framing against it). If it is a handheld selfie, utilize flattering facial angles, hand-to-face/hair gestures, and visible background elements.
3. POSE INSTRUCTION: Write clear, friendly step-by-step direction tips for the user on how to position their body, limbs, and head.
4. IMAGE GENERATION PROMPT: Write a vivid, photorealistic prompt for a text-to-image generator that accurately portrays a stylish person performing this exact pose utilizing the detected scene objects.
   - Must specify: "A photorealistic photograph of a stylish person [exact pose], interacting with [detected objects], natural flattering lighting, 50mm lens portrait photography, 8k, cinematic, realistic human anatomy".

Output ONLY valid JSON matching this exact schema:
{
  "title": "Short catchy pose title (e.g. 'The Cafe Window Lean', 'The Velvet Sofa Recline', 'The Casual Wall Slant')",
  "vibe": "Short aesthetic vibe (e.g. 'Moody Editorial', 'Warm Coffee Shop', 'Golden Hour Candid')",
  "directionTip": "2-3 clear, actionable sentences instructing the user how to pose (e.g. 'Sit comfortably on the edge of the sofa, cross your legs casually, rest your left elbow on the armrest, and gaze softly towards the camera.')",
  "sceneObjects": ["Object 1", "Object 2", "Object 3"],
  "imagePrompt": "Detailed photorealistic text-to-image prompt showing the person in this pose with the scene objects"
}`;

    let parsedResult: {
      title: string;
      vibe: string;
      directionTip: string;
      sceneObjects: string[];
      imagePrompt: string;
    } | null = null;

    if (this.apiKey) {
      const modelsToTry = [
        this.preferredModel,
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
      ].filter((m, i, arr) => m && arr.indexOf(m) === i);

      for (const model of modelsToTry) {
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

          if (!response.ok) continue;

          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) continue;

          const match = rawText.match(/\{[\s\S]*\}/);
          const jsonStr = match ? match[0] : rawText;
          parsedResult = JSON.parse(jsonStr);
          if (parsedResult?.title && parsedResult?.imagePrompt) {
            break;
          }
        } catch (e) {
          console.warn(`Model ${model} analysis failed:`, e);
        }
      }
    }

    // High quality contextual fallback if Gemini is offline / no key
    if (!parsedResult) {
      if (isFront) {
        parsedResult = {
          title: 'The Golden Hour Selfie',
          vibe: 'Warm Glow & Gentle Smile',
          directionTip: 'Hold your phone slightly above eye level at a 45-degree angle. Tilt your chin up slightly and touch your fingertips softly to your collarbone.',
          sceneObjects: ['Soft Ambient Lighting', 'Phone Camera'],
          imagePrompt: 'A photorealistic close-up selfie portrait of a stylish smiling person holding their phone at a gentle angle, touching their collarbone, warm golden lighting, 35mm lens, high resolution photograph',
        };
      } else {
        parsedResult = {
          title: 'The Ambient Room Portrait',
          vibe: 'Relaxed Lifestyle & Clean Lines',
          directionTip: 'Find the nearest chair or wall in your room. Lean your upper body casually against it, shift your weight to your back foot, and look toward the light source.',
          sceneObjects: ['Furniture / Room Wall', 'Ambient Light'],
          imagePrompt: 'A photorealistic full-shot photograph of a person leaning casually against modern room furniture, natural relaxed posture, soft cinematic ambient lighting, professional portrait photography',
        };
      }
    }

    // Step 2: Generate the Reference Photo from the Prompt!
    const imageUrl = await this.generateImageFromPrompt(
      parsedResult.imagePrompt,
      isFront ? '3:4' : '3:4'
    );

    return {
      id: `ai_pose_${Date.now()}`,
      title: parsedResult.title,
      vibe: parsedResult.vibe,
      directionTip: parsedResult.directionTip,
      sceneObjects: parsedResult.sceneObjects || [],
      imagePrompt: parsedResult.imagePrompt,
      referenceImageUrl: imageUrl,
      createdAt: Date.now(),
      cameraFacing: options?.facingMode || 'environment',
    };
  }
}

export const aiVisionService = new AIVisionService();
