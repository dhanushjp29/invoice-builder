import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Netlify Dev (port 8888) opens the user-facing tab. Disable Vite's own
    // auto-open so we don't end up with two tabs (5173 + 8888) on dev start.
    open: false,
  },
});
