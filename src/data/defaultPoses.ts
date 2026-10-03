import type { PosePreset } from '../types/camera';
import downtownStepsImg from '../assets/poses/downtown_steps.jpg';
import selfieHairImg from '../assets/poses/selfie_hair.jpg';
import downtownLeanImg from '../assets/poses/downtown_lean.jpg';
import editorialCollarImg from '../assets/poses/editorial_collar.jpg';
import handsHipsImg from '../assets/poses/hands_hips.jpg';

export const DEFAULT_POSES: PosePreset[] = [
  // 1. Downtown Steps Chill (User Image 1)
  {
    id: 'downtown_steps',
    title: 'Downtown Steps Chill',
    vibe: 'Candid Street & Outdoor Seated',
    category: 'Downtown',
    framing: 'seated',
    directionTip: 'Sit on steps, rest elbows on knees, clasp hands gently under chin with a warm candid smile.',
    reasoning: 'Creates an intimate triangular framing that highlights facial features and relaxed urban vibe.',
    referenceImage: downtownStepsImg,
    landmarks: {
      nose: { x: 0.50, y: 0.22 },
      left_shoulder: { x: 0.58, y: 0.38 },
      right_shoulder: { x: 0.42, y: 0.38 },
      left_elbow: { x: 0.66, y: 0.48 },
      right_elbow: { x: 0.34, y: 0.48 },
      left_wrist: { x: 0.52, y: 0.34 }, // clasped near chin
      right_wrist: { x: 0.48, y: 0.34 }, // clasped near chin
      left_hip: { x: 0.57, y: 0.66 },
      right_hip: { x: 0.43, y: 0.66 },
      left_knee: { x: 0.68, y: 0.72 },
      right_knee: { x: 0.32, y: 0.72 },
      left_ankle: { x: 0.64, y: 0.94 },
      right_ankle: { x: 0.36, y: 0.94 },
    },
  },

  // 2. Selfie Hair Touch (User Image 2)
  {
    id: 'selfie_hair',
    title: 'Selfie Hair Touch',
    vibe: 'Close-Up Selfie & Casual',
    category: 'Selfie',
    framing: 'upper_body',
    directionTip: 'Tilt head slightly right, reach one hand up to gently run fingers through your hair crown.',
    reasoning: 'Breaks facial symmetry, adds natural volume to hair, and creates an effortless candid selfie angle.',
    referenceImage: selfieHairImg,
    landmarks: {
      nose: { x: 0.51, y: 0.28 },
      left_shoulder: { x: 0.68, y: 0.58 },
      right_shoulder: { x: 0.32, y: 0.56 },
      left_elbow: { x: 0.76, y: 0.82 },
      right_elbow: { x: 0.22, y: 0.38 },
      left_wrist: { x: 0.65, y: 0.95 },
      right_wrist: { x: 0.36, y: 0.16 }, // touching hair crown
      left_hip: { x: 0.62, y: 0.95 },
      right_hip: { x: 0.38, y: 0.95 },
    },
  },

  // 3. Downtown Wall Lean (User Image 3)
  {
    id: 'downtown_lean',
    title: 'The Downtown Wall Lean',
    vibe: 'Urban Streetwear & Architecture',
    category: 'Downtown',
    framing: 'full_body',
    directionTip: 'Lean back against wall/window, slip hands into front pockets, cross front leg casually over back leg.',
    reasoning: 'Casual posture that flatters body proportions and utilizes environmental architecture.',
    referenceImage: downtownLeanImg,
    landmarks: {
      nose: { x: 0.52, y: 0.15 },
      left_shoulder: { x: 0.59, y: 0.27 },
      right_shoulder: { x: 0.44, y: 0.27 },
      left_elbow: { x: 0.63, y: 0.41 },
      right_elbow: { x: 0.39, y: 0.41 },
      left_wrist: { x: 0.56, y: 0.53 }, // in pocket
      right_wrist: { x: 0.42, y: 0.53 }, // in pocket
      left_hip: { x: 0.54, y: 0.54 },
      right_hip: { x: 0.45, y: 0.54 },
      left_knee: { x: 0.52, y: 0.72 },
      right_knee: { x: 0.44, y: 0.70 },
      left_ankle: { x: 0.48, y: 0.90 }, // crossed over
      right_ankle: { x: 0.43, y: 0.91 },
    },
  },

  // 4. Casual Hands on Hips
  {
    id: 'hands_hips',
    title: 'The Confident Stance',
    vibe: 'Modern Casual & Lifestyle',
    category: 'Casual',
    framing: 'full_body',
    directionTip: 'Rest hands firmly on hips, open your chest, keep feet shoulder-width with a friendly smile.',
    reasoning: 'Elongates the torso, creates clean negative space, and portrays warm open body language.',
    referenceImage: handsHipsImg,
    landmarks: {
      nose: { x: 0.50, y: 0.16 },
      left_shoulder: { x: 0.60, y: 0.28 },
      right_shoulder: { x: 0.40, y: 0.28 },
      left_elbow: { x: 0.68, y: 0.42 },
      right_elbow: { x: 0.32, y: 0.42 },
      left_wrist: { x: 0.58, y: 0.52 }, // on hip
      right_wrist: { x: 0.42, y: 0.52 }, // on hip
      left_hip: { x: 0.56, y: 0.55 },
      right_hip: { x: 0.44, y: 0.55 },
      left_knee: { x: 0.56, y: 0.74 },
      right_knee: { x: 0.44, y: 0.74 },
      left_ankle: { x: 0.57, y: 0.92 },
      right_ankle: { x: 0.43, y: 0.92 },
    },
  },

  // 5. Editorial Collarbone Stance
  {
    id: 'editorial_collar',
    title: 'Editorial Collarbone Stance',
    vibe: 'High Fashion & Editorial Studio',
    category: 'Editorial',
    framing: 'upper_body',
    directionTip: 'Raise right hand lightly toward collarbone or jaw, turn torso 20°, look 15° past lens.',
    reasoning: 'Dynamic diagonal arm line accentuates jawline structure and brings high-fashion elegance.',
    referenceImage: editorialCollarImg,
    landmarks: {
      nose: { x: 0.48, y: 0.22 },
      left_shoulder: { x: 0.62, y: 0.40 },
      right_shoulder: { x: 0.38, y: 0.38 },
      left_elbow: { x: 0.65, y: 0.62 },
      right_elbow: { x: 0.36, y: 0.50 },
      left_wrist: { x: 0.55, y: 0.78 },
      right_wrist: { x: 0.45, y: 0.34 }, // at collarbone
      left_hip: { x: 0.58, y: 0.85 },
      right_hip: { x: 0.42, y: 0.85 },
    },
  },

  // 6. Confident Luminary (Crossed Arms)
  {
    id: 'power_portrait',
    title: 'The Confident Luminary',
    vibe: 'Executive & Editorial Portrait',
    category: 'Stylish',
    framing: 'upper_body',
    directionTip: 'Square shoulders slightly, fold arms gently across chest with hands visible, tilt head subtly.',
    reasoning: 'Project authority, poise, and warmth without appearing guarded or overly rigid.',
    landmarks: {
      nose: { x: 0.50, y: 0.18 },
      left_shoulder: { x: 0.62, y: 0.35 },
      right_shoulder: { x: 0.38, y: 0.35 },
      left_elbow: { x: 0.64, y: 0.54 },
      right_elbow: { x: 0.36, y: 0.54 },
      left_wrist: { x: 0.46, y: 0.53 }, // crossed
      right_wrist: { x: 0.54, y: 0.52 }, // crossed
      left_hip: { x: 0.57, y: 0.78 },
      right_hip: { x: 0.43, y: 0.78 },
      left_knee: { x: 0.58, y: 0.95 },
      right_knee: { x: 0.42, y: 0.95 },
    },
  },

  // 7. The Candid Stride
  {
    id: 'golden_hour_candid',
    title: 'The Candid Stride',
    vibe: 'Golden Hour & Lifestyle Dynamic',
    category: 'Dynamic',
    framing: 'full_body',
    directionTip: 'Take a slow deliberate step toward camera, turn torso slightly, glance over shoulder.',
    reasoning: 'Walking motion introduces natural movement into garments and hair, catching light beautifully.',
    landmarks: {
      nose: { x: 0.52, y: 0.16 },
      left_shoulder: { x: 0.60, y: 0.28 },
      right_shoulder: { x: 0.43, y: 0.27 },
      left_elbow: { x: 0.64, y: 0.43 },
      right_elbow: { x: 0.37, y: 0.42 },
      left_wrist: { x: 0.66, y: 0.57 },
      right_wrist: { x: 0.36, y: 0.56 },
      left_hip: { x: 0.56, y: 0.55 },
      right_hip: { x: 0.45, y: 0.56 },
      left_knee: { x: 0.60, y: 0.73 },
      right_knee: { x: 0.41, y: 0.74 },
      left_ankle: { x: 0.62, y: 0.91 },
      right_ankle: { x: 0.39, y: 0.91 },
    },
  },
];
