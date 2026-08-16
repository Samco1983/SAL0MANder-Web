/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': r('./src'),
      '@app': r('./src/app'),
      '@routes': r('./src/routes'),
      '@components': r('./src/components'),
      '@design': r('./src/design'),
      '@api': r('./src/api'),
      '@contracts': r('./src/contracts'),
      '@storage': r('./src/storage'),
      '@unity': r('./src/unity'),
      '@auth': r('./src/auth'),
      '@config': r('./src/config'),
      '@lib': r('./src/lib'),
    },
  },
  build: {
    // Unity WebGL builds are large; keep the warning meaningful for *our* JS only.
    chunkSizeWarningLimit: 900,
    sourcemap: true,
  },
  server: {
    port: 5173,
    // Unity WebGL (brotli/gzip streaming + SharedArrayBuffer-capable builds) is
    // sensitive to these; harmless for the rest of the site.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**', 'src/**/*.d.ts'],
    },
  },
})
