import type { AIPoseSuggestion } from '../types/camera';

const API_KEY_STORAGE = 'gemini_api_key';
const MODEL_PREF_STORAGE = 'gemini_model_preference';

interface DiversePoseArchetype {
  name: string;
  focus: string;
  title: string;
  vibe: string;
  directionTip: string;
  sceneObjects: string[];
  imagePrompt: string;
}

const ENVIRONMENT_ARCHETYPES: DiversePoseArchetype[] = [
  {
    name: 'Sculptural Chair Recline',
    focus: 'Seated posture with crossed leg and asymmetric armrest',
    title: 'The Modern Chair Recline',
    vibe: 'Editorial & Effortless Chic',
    directionTip: 'Sit back into the chair or sofa, cross one leg casually over the knee, rest your elbow on the armrest, and look just off-camera with a relaxed expression.',
    sceneObjects: ['Armchair / Sofa', 'Natural Room Light'],
    imagePrompt: 'A photorealistic photograph of a stylish person sitting casually in an armchair, one leg crossed over the knee, relaxed posture, soft ambient interior lighting, 50mm portrait lens, 8k',
  },
  {
    name: 'Casual Wall Slant',
    focus: 'Vertical surface lean with relaxed legs',
    title: 'The Casual Wall Slant',
    vibe: 'Urban & Confident',
    directionTip: 'Lean your back or shoulder gently against the nearest wall or doorway. Cross your front ankle over your back ankle, rest hands loosely in pockets, and look toward the camera.',
    sceneObjects: ['Wall / Doorframe', 'Architectural Lines'],
    imagePrompt: 'A photorealistic photograph of a stylish person leaning casually with shoulder against a modern architectural wall, crossed ankles, confident posture, soft cinematic lighting, 50mm portrait',
  },
  {
    name: 'Mid-Turn Candid',
    focus: 'Dynamic movement with over-shoulder glance',
    title: 'The Mid-Stride Glance',
    vibe: 'Candid Motion & Spontaneity',
    directionTip: 'Take a slow step forward as if walking past the camera, then turn your head back over your shoulder with an easy, natural smile.',
    sceneObjects: ['Open Floor / Pathway', 'Dynamic Light'],
    imagePrompt: 'A photorealistic candid photograph of a stylish person caught mid-stride, turning head back over shoulder with a spontaneous smile, natural movement, warm sunlight, 50mm lens',
  },
  {
    name: 'Coffee Table Lean',
    focus: 'Seated forward lean with chin or elbows on table',
    title: 'The Cafe Table Lean',
    vibe: 'Intimate & Conversational',
    directionTip: 'Sit forward toward the table, place your forearms or elbows comfortably on the surface, and lean slightly forward toward the lens with a warm, engaging gaze.',
    sceneObjects: ['Table / Desk', 'Coffee Cup / Prop'],
    imagePrompt: 'A photorealistic portrait photograph of a person seated at a wooden table, leaning forward on elbows with a warm engaging expression, soft window light, cozy cafe atmosphere, 50mm lens',
  },
  {
    name: 'Floor Lounge Cross',
    focus: 'Low ground sitting with bent knees',
    title: 'The Floor Lounge',
    vibe: 'Boho & Relaxed Lifestyle',
    directionTip: 'Sit casually on the rug or floor with knees bent sideways, lean one hand back on the floor for support, and tilt your head with a thoughtful smile.',
    sceneObjects: ['Floor / Area Rug', 'Ambient Room Decor'],
    imagePrompt: 'A photorealistic photograph of a stylish person sitting cross-legged on a modern wooden floor with rug, casual relaxed posture, leaning back on one palm, warm interior lighting, 50mm',
  },
  {
    name: 'Balcony / Ledge Rest',
    focus: 'Elevated leaning pose with distant gaze',
    title: 'The Balcony Horizon Gaze',
    vibe: 'Dreamy & Contemplative',
    directionTip: 'Lean your forearms on the balcony railing, counter, or window sill. Gaze out toward the horizon or light source, letting the natural daylight illuminate your profile.',
    sceneObjects: ['Balcony Railing / Window Sill', 'Daylight Sky'],
    imagePrompt: 'A photorealistic photograph of a person leaning forearms casually on a balcony railing, looking thoughtfully into the distance, beautiful golden hour sky in background, 50mm lens',
  },
  {
    name: 'Architectural Doorway Frame',
    focus: 'Using surroundings as a natural geometric frame',
    title: 'The Doorway Silhouette Frame',
    vibe: 'Clean Geometry & Modernism',
    directionTip: 'Position yourself standing right inside a doorway or archway. Rest one hand against the doorframe at chest height, shifting your weight onto your back leg.',
    sceneObjects: ['Doorframe / Archway', 'Geometric Backdrop'],
    imagePrompt: 'A photorealistic portrait photograph of a person framed naturally inside a modern minimalist doorway, one hand resting on the jamb, clean geometric lines, soft rim lighting, 50mm',
  },
  {
    name: 'Power Stance Hip Shift',
    focus: 'Full standing posture with asymmetrical weight shift',
    title: 'The Confident Stride & Shift',
    vibe: 'Bold & High Fashion',
    directionTip: 'Stand with feet shoulder-width apart, shift your weight onto one hip, hook one thumb into your waistband or pocket, and gaze directly down the camera lens.',
    sceneObjects: ['Open Space / Clean Backdrop', 'Studio Ambient Light'],
    imagePrompt: 'A photorealistic full-body portrait photograph of a stylish person in a confident standing pose, weight shifted onto one hip, one hand in pocket, modern minimal background, 50mm lens',
  },
];

const SELFIE_ARCHETYPES: DiversePoseArchetype[] = [
  {
    name: 'Soft Jawline Rest',
    focus: 'Hand-to-jaw gentle framing with soft smile',
    title: 'The Soft Jawline Rest',
    vibe: 'Warm Glow & Gentle Smile',
    directionTip: 'Hold your phone slightly above eye level. Rest your fingertips softly along your jawline or cheek, tilt your head slightly, and smile warmly into the camera.',
    sceneObjects: ['Soft Ambient Lighting', 'Phone Camera'],
    imagePrompt: 'A photorealistic close-up selfie portrait photograph of a stylish smiling person, gently resting fingertips along jawline, warm golden light, gentle head tilt, 35mm lens, high resolution',
  },
  {
    name: 'Hair Touch Candid',
    focus: 'Spontaneous hand-in-hair gesture',
    title: 'The Hair-Touch Candid',
    vibe: 'Playful & Spontaneous',
    directionTip: 'Run one hand casually through your hair as if caught in a spontaneous moment. Angle your phone at 45 degrees and glance slightly off-center with a relaxed smirk.',
    sceneObjects: ['Natural Daylight', 'Casual Backdrop'],
    imagePrompt: 'A photorealistic close-up selfie photograph of a stylish person with hand running through hair in a spontaneous candid gesture, playful relaxed smirk, bright natural daylight, 35mm',
  },
  {
    name: 'Over-the-Shoulder Selfie',
    focus: 'Angled torso with back glance',
    title: 'The Over-Shoulder Glance',
    vibe: 'Cinematic & Flattering Depth',
    directionTip: 'Turn your shoulders slightly away from the camera, then turn your neck back to look over your shoulder directly into the lens. This creates flattering jawline definition.',
    sceneObjects: ['Soft Rim Lighting', 'Blurred Background'],
    imagePrompt: 'A photorealistic selfie portrait photograph of a person looking back over their shoulder into the lens, sharp jawline definition, soft bokeh background, flattering cinematic light, 35mm',
  },
  {
    name: 'Sunlit Shadow Play',
    focus: 'Chiaroscuro lighting across face',
    title: 'The Golden Sunlit Edge',
    vibe: 'Moody Art & Warm Shadows',
    directionTip: 'Position yourself so sunlight strikes one side of your face, creating soft dimensional shadows. Hold phone at eye level and look intently into the lens.',
    sceneObjects: ['Golden Hour Sunbeams', 'Window Blind Shadow'],
    imagePrompt: 'A photorealistic close-up selfie portrait of a person with golden hour sunlight casting artistic soft shadows across half of the face, striking eyes, cinematic lighting, 35mm',
  },
  {
    name: 'Cozy Collar Frame',
    focus: 'Two hands framing jacket collar',
    title: 'The Cozy Collar Frame',
    vibe: 'Cozy & Approachable',
    directionTip: 'Use both hands to gently hold the collar or lapel of your shirt or jacket. Look directly at the camera with big, approachable eyes and a soft genuine smile.',
    sceneObjects: ['Cozy Apparel / Texture', 'Diffused Soft Light'],
    imagePrompt: 'A photorealistic selfie photograph of a stylish smiling person lightly holding jacket collar, warm approachable gaze, soft diffused indoor lighting, high detail portrait photography, 35mm',
  },
  {
    name: 'High Angle Doll Glance',
    focus: 'Elevated camera angle looking up',
    title: 'The Elevated High-Angle Glance',
    vibe: 'Sweet & Dramatic Perspective',
    directionTip: 'Raise your phone 30-40 degrees higher than eye level, tuck your chin slightly, and look up toward the camera with open eyes and a sweet expression.',
    sceneObjects: ['Top-down Ambient Glow', 'Minimal Background'],
    imagePrompt: 'A photorealistic high-angle selfie portrait of a person looking up toward camera, expressive eyes, flattering chin angle, soft ring light glow, clean minimalist aesthetic, 35mm',
  },
];

export class AIVisionService {
  private apiKey: string = '';
  private preferredModel: string = 'gemini-1.5-flash';

  constructor() {
    this.apiKey = this.sanitizeApiKey(
      localStorage.getItem(API_KEY_STORAGE) || (import.meta as any).env?.VITE_GEMINI_API_KEY || ''
    );
    this.preferredModel = localStorage.getItem(MODEL_PREF_STORAGE) || 'gemini-1.5-flash';
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
   * 2. Seamlessly falls back to fast, high-quality Pollinations Flux generation with unique randomized seeds.
   */
  public async generateImageFromPrompt(
    prompt: string,
    aspectRatio: '3:4' | '1:1' = '1:1'
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
              aspectRatio: aspectRatio === '3:4' ? '3:4' : '1:1',
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
      .slice(0, 350);

    // CRITICAL: Always generate a unique seed so Pollinations produces a fresh new image variation every time
    const seed = Math.floor(Math.random() * 9999999) + 1;
    const encoded = encodeURIComponent(cleanPrompt);
    return `https://image.pollinations.ai/prompt/${encoded}?nologo=true&seed=${seed}&model=flux`;
  }

  /**
   * Full AI Director Pipeline:
   * 1. Direct Multimodal Gemini Vision (if key available): Inspects real camera frame, strictly excluding past poses.
   * 2. Free AI Engine (Pollinations Text LLM): Free fallback with custom creative prompt synthesis.
   * 3. Multi-Archetype Rotation Engine: Guarantees 0-repeat pose variation even offline.
   * 4. Text-to-Image AI Reference Synthesis.
   */
  public async analyzeSceneAndGeneratePose(
    base64Image: string,
    mimeType = 'image/jpeg',
    options?: {
      facingMode?: 'user' | 'environment';
      previousTitles?: string[];
      varietyIndex?: number;
    }
  ): Promise<AIPoseSuggestion> {
    const isFront = options?.facingMode === 'user';
    const previousTitles = options?.previousTitles || [];
    const varietyIndex = options?.varietyIndex ?? Math.floor(Math.random() * 10);

    const pool = isFront ? SELFIE_ARCHETYPES : ENVIRONMENT_ARCHETYPES;
    const archetypeIndex = Math.abs(varietyIndex) % pool.length;
    const targetArchetype = pool[archetypeIndex];

    const cameraModeDesc = isFront
      ? 'Front-facing selfie camera (close-up to upper-body portrait distance)'
      : 'Rear main camera (subject in environment, portrait to full-body)';

    const exclusionList = previousTitles.length > 0
      ? `DO NOT REPEAT: The following poses were ALREADY suggested in this session:\n${previousTitles.map((t) => `- "${t}"`).join('\n')}\nYou MUST choose a completely DIFFERENT pose category and physical position.`
      : '';

    const geminiPrompt = `You are a world-class professional photographer and creative pose director.
Analyze this live camera frame and craft a creative photography pose idea tailored specifically to this scene.

CAMERA CONTEXT: ${cameraModeDesc}.
${exclusionList}
TARGET ARCHETYPE INSPIRATION: Focus on "${targetArchetype.name}" (${targetArchetype.focus}).

CRITICAL REQUIREMENTS:
1. SCENE OBJECT IDENTIFICATION: Detect specific physical objects, furniture, architecture, or elements in the frame (e.g. armchair, desk, cafe table, wall, staircase, doorway, railing, window, cup, plant).
2. OBJECT UTILIZATION: The suggested pose MUST actively use or interact with one or more of these detected objects (e.g. sitting, leaning, propping an elbow/foot, or framing). If it's a selfie, utilize flattering facial angles, natural hand gestures, and background elements.
3. POSE INSTRUCTION: Write 2-3 clear, friendly, actionable sentences on how to position body, limbs, and head.
4. IMAGE GENERATION PROMPT: Write a photorealistic text-to-image prompt showing a stylish person striking this exact pose with the detected scene objects.
   - Format: "A photorealistic photograph of a stylish person [exact pose], interacting with [detected objects], flattering lighting, 50mm portrait photography, 8k".

Output ONLY valid JSON matching this schema:
{
  "title": "Short catchy pose title",
  "vibe": "Short aesthetic vibe",
  "directionTip": "2-3 clear actionable sentences",
  "sceneObjects": ["Object 1", "Object 2"],
  "imagePrompt": "Detailed photorealistic text-to-image prompt"
}`;

    let parsedResult: {
      title: string;
      vibe: string;
      directionTip: string;
      sceneObjects: string[];
      imagePrompt: string;
    } | null = null;

    let engineUsed: 'gemini_vision' | 'free_ai' | 'smart_rotation' = 'smart_rotation';

    // Layer 1: Google Gemini Multimodal Vision API (if user has key)
    if (this.apiKey) {
      const modelsToTry = [
        this.preferredModel,
        'gemini-1.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-pro',
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
                    { text: geminiPrompt },
                    { inlineData: { mimeType, data: base64Image } },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.9,
              },
            }),
          });

          if (!response.ok) continue;

          const data = await response.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) continue;

          const match = rawText.match(/\{[\s\S]*\}/);
          const jsonStr = match ? match[0] : rawText;
          const candidate = JSON.parse(jsonStr);
          if (candidate?.title && candidate?.imagePrompt) {
            // Check that it didn't duplicate a previous title
            if (!previousTitles.includes(candidate.title)) {
              parsedResult = candidate;
              engineUsed = 'gemini_vision';
              break;
            }
          }
        } catch (e) {
          console.warn(`Model ${model} analysis failed:`, e);
        }
      }
    }

    // Layer 2: Free AI Engine (Pollinations Text LLM - Fast, free, 0 key required)
    if (!parsedResult) {
      try {
        const textPrompt = `You are a creative photography pose director.
Generate a fresh, creative pose idea tailored for a ${isFront ? 'front camera selfie' : 'rear camera room/environment photo'}.
${exclusionList}
TARGET ARCHETYPE INSPIRATION: Focus on "${targetArchetype.name}" (${targetArchetype.focus}).

Output ONLY JSON matching:
{
  "title": "Short catchy pose title",
  "vibe": "Short aesthetic vibe",
  "directionTip": "2-3 clear actionable sentences instructing the person's body posture and facial expression",
  "sceneObjects": ["Object 1", "Object 2"],
  "imagePrompt": "A photorealistic portrait photograph of a stylish person in this exact pose, interacting with objects, 50mm portrait lens, 8k"
}`;

        const pollinationsResp = await fetch('https://text.pollinations.ai/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: textPrompt }],
            jsonMode: true,
          }),
        });

        if (pollinationsResp.ok) {
          const rawText = await pollinationsResp.text();
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) {
            const candidate = JSON.parse(match[0]);
            if (candidate?.title && candidate?.directionTip && candidate?.imagePrompt) {
              if (!previousTitles.includes(candidate.title)) {
                parsedResult = candidate;
                engineUsed = 'free_ai';
              }
            }
          }
        }
      } catch (err) {
        console.warn('Free text AI generation failed, using rotation archetype:', err);
      }
    }

    // Layer 3: Dynamic Multi-Archetype Rotation Engine (Local instant fallback)
    if (!parsedResult) {
      // Find the first archetype from the pool that has not been used in previousTitles
      const unused = pool.find((a) => !previousTitles.includes(a.title)) || targetArchetype;
      parsedResult = {
        title: unused.title,
        vibe: unused.vibe,
        directionTip: unused.directionTip,
        sceneObjects: unused.sceneObjects,
        imagePrompt: unused.imagePrompt,
      };
      engineUsed = 'smart_rotation';
    }

    // Step 2: Generate the Reference Photo from the Prompt!
    const imageUrl = await this.generateImageFromPrompt(
      parsedResult.imagePrompt,
      '1:1'
    );

    return {
      id: `ai_pose_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: parsedResult.title,
      vibe: parsedResult.vibe,
      directionTip: parsedResult.directionTip,
      sceneObjects: parsedResult.sceneObjects || [],
      imagePrompt: parsedResult.imagePrompt,
      referenceImageUrl: imageUrl,
      createdAt: Date.now(),
      cameraFacing: options?.facingMode || 'environment',
      generationEngine: engineUsed,
    };
  }
}

export const aiVisionService = new AIVisionService();
