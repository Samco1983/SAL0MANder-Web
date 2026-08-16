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
    // No COOP/COEP here on purpose.
    //
    // Cross-origin isolation is only *required* for SharedArrayBuffer, i.e. a
    // Unity WebGL build with threads enabled. Unity threads are currently off,
    // so the headers buy nothing — and COEP actively breaks the loading path we
    // do use: a build served from `VITE_UNITY_BUILD_BASE_URL` (a CDN) and any
    // cross-origin thumbnail are blocked unless every one of those responses
    // carries `Cross-Origin-Resource-Policy`, which a third-party CDN will not
    // do on our say-so. Dev then fails in a way production would not.
    //
    // Restore both headers the moment Unity ships a threaded build, and pair
    // them with CORP on the asset origin — see docs/DECISIONS.md D-011.
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
