# 📸 AI Pose Cam — Intelligent Mobile Director & Full-Sensor Camera

A pure browser-based, mobile-optimized AI camera application that acts as a real-time portrait director. It uses multimodal LLMs (Google Gemini 2.5 Flash / 1.5 Flash) to analyze surroundings and subjects, renders aesthetic skeletal wireframe pose guides, tracks the user's pose in real-time with WebGL MediaPipe, turns green when aligned, and outputs full optical resolution still captures (e.g. 48MP, 50MP, 64MP, 108MP).

---

## ✨ Features

1. **AI Scene & Subject Analysis (Multimodal LLM)**:
   - When the camera starts (or on tap of **"AI Analyze Scene"**), it captures a clean frame and sends it to the vision model.
   - Analyzes lighting, background geometry, architectural textures, framing, and model clothing.
   - Returns a custom pose title, aesthetic reasoning, director direction tips, and normalized 2D skeletal landmarks.

2. **Skeletal Wireframe Overlay & Real-Time Tracking**:
   - Renders a futuristic HUD skeletal wireframe on top of the live camera stream.
   - Uses **Google MediaPipe Tasks Vision (PoseLandmarker)** running at 30+ FPS via browser WebGL/WASM.
   - Calculates joint-by-joint alignment with scale and position invariance.

3. **Real-time Color Coded Alignment Feedback**:
   - **Default / Search**: Sleek glowing cyber cyan (`#38bdf8`).
   - **Approaching**: Amber / Gold (`#f59e0b`).
   - **Aligned (>= 80%)**: **VIBRANT NEON GREEN** (`#00ff88`) with pulse glow, audio chime, and mobile haptic vibration.
   - Dynamic direction prompter: tells the photographer exactly how to direct the model (e.g. *"Raise left elbow ↑"*, *"Shift weight to right foot"*).

4. **True Full Sensor RAW / Optical Still Capture (48MP / 50MP / 64MP / 108MP)**:
   - Normal video streams are compressed to 1080p or 4K.
   - This app utilizes the W3C **`ImageCapture` API** (`imageCapture.takePhoto({ imageWidth: max, imageHeight: max })`).
   - Captures directly from the phone's physical camera sensor at maximum still optical dimensions without downscaling!
   - Full resolution preview with EXIF resolution badge (e.g. `8000 × 6000 px - 48.0 MP`), zoom inspection, and direct lossless download.

5. **Mobile-First Camera Experience**:
   - Ergonomic bottom shutter button with glowing green pulse upon alignment.
   - Touch-to-focus indicator ring.
   - Front/Back camera flip.
   - Flash / Torch toggle.
   - Rule-of-Thirds composition grid.
   - Auto-Capture when aligned option.
   - Built-in library of curated photographer poses (Streetwear, Editorial, Portrait, Dynamic, Seated).
   - Served over local HTTPS via `@vitejs/plugin-basic-ssl` so camera and sensor APIs work over mobile LAN.

---

## 🚀 How to Run & Connect from Mobile

### 1. Start the Development Server
```bash
npm run dev
```

Vite will start with local HTTPS enabled:
```
  ➜  Local:   https://localhost:5173/
  ➜  Network: https://192.168.x.x:5173/
```

### 2. Open on Mobile Phone
1. Connect your phone to the same Wi-Fi network as your computer.
2. Open Chrome (Android) or Safari (iOS) on your phone and go to the `Network` URL (e.g., `https://192.168.1.5:5173`).
3. Tap **Advanced -> Proceed** if prompted for the self-signed certificate.
4. Allow Camera permissions when prompted.

---

## 🔑 Gemini API Key (Optional but Recommended)
- Tap the **Settings ⚙️** icon in the top right.
- Enter your Google Gemini API key ([Get a free key here](https://aistudio.google.com/apikey)).
- The app also includes a built-in intelligent contextual director engine that works even without an API key or offline!
