import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const at = p => fileURLToPath(new URL(p, import.meta.url));

/* The upstream Next.js source sits unmodified in upstream/ (tools/sync-speedrun.mjs puts it there).
   Its three Next imports resolve to the stand-ins in src/next/, and base './' lets the build run from any path. */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': at('./upstream/src'),
      'next/link': at('./src/next/link.jsx'),
      'next/navigation': at('./src/next/navigation.js'),
      'next/server': at('./src/next/server.js')
    }
  },
  build: { outDir: '../app', emptyOutDir: true, chunkSizeWarningLimit: 900 }
});
