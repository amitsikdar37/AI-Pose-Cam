/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        camera: {
          dark: '#0a0a0c',
          card: '#141418',
          accent: '#10b981',
          neon: '#00ff88',
          cyber: '#38bdf8',
        }
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.9', filter: 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.8))' },
          '50%': { opacity: '0.4', filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.3))' },
        },
        shutterFlash: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shutter': 'shutterFlash 0.35s ease-out forwards',
      }
    },
  },
  plugins: [],
}
