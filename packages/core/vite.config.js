import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    target: 'es2022',
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.js'),
      name: 'SimEngine',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.global.js'),
    },
    rollupOptions: {
      // No external deps — bundle everything for zero-peer-dep consumers.
      external: [],
    },
  },
  test: {
    globals: false,
    environment: 'happy-dom',
    include: ['tests/**/*.test.js'],
  },
});
