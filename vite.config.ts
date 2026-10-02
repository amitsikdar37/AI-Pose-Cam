import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl(), // Automatically enables HTTPS so mobile devices over LAN have full camera & ImageCapture permissions
  ],
  server: {
    host: true, // Listen on all local IP addresses (e.g. 192.168.x.x)
    port: 5173,
  },
});
