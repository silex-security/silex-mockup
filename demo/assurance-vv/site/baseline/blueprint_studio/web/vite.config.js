import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* Static build with relative paths, so the same files work under
   /blueprint_studio/app/ on Vercel and inside a Claude Artifact. The engine
   modules in ../js and the templates in ../templates are bundled from outside
   the project root. */
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
  build: { outDir: '../app', emptyOutDir: true, chunkSizeWarningLimit: 900 }
});
