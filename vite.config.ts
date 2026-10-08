import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pre-bundle the 3D libraries, so the dev server does not reload the page the first time the
  // 3D chunk loads (end-to-end tests run against a fresh dev server).
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei', 'comlink'],
  },
  build: {
    // tools/measure-js.mjs reads it to tell the mock API's chunk from the app's (NFR-06).
    manifest: true,
    // The 3D chunk (three.js) is about 1 MB before gzip. NFR-06 limits it to 350 kB gzip,
    // which docs/BUILD_NOTES.md records per milestone.
    chunkSizeWarningLimit: 1100,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    benchmark: { include: ['src/**/*.bench.ts'] },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.bench.ts',
        'src/domain/testing/**',
        'src/test/**',
        // Start-up only, covered by every end-to-end test: the entry point and the service
        // worker start. Nothing else is left out.
        'src/main.tsx',
        'src/api/mock/browser.ts',
        'src/**/*.d.ts',
      ],
      reporter: ['text-summary', 'text', 'html', 'json-summary'],
      // NFR-23: the whole app 70% of lines or more, the domain 90% or more.
      thresholds: { lines: 70, 'src/domain/**': { lines: 90 } },
    },
  },
});
