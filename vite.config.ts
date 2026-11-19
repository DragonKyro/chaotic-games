import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/chaotic-games/',
  // Online rooms record the build that made them, so devices on another
  // build get a warning (see networkStore).
  define: {
    __APP_BUILD__: JSON.stringify(process.env.GITHUB_SHA?.slice(0, 7) ?? 'dev'),
  },
  // scripts/render.mjs runs its own dev server per port; separate optimizer
  // caches keep concurrent runs from clobbering each other.
  ...(process.env.CG_VITE_CACHE ? { cacheDir: process.env.CG_VITE_CACHE } : {}),
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
