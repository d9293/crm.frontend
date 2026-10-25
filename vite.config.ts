import react from '@vitejs/plugin-react'
// `defineConfig` from `vitest/config` rather than `vite`: it is the same
// function widened to accept the `test` block below. Vite's own config type
// has no `test` property, so importing from `vite` fails typecheck.
import { defineConfig } from 'vitest/config'

/**
 * Dev-server proxy target is provisional: the backend framework and its port
 * are decided in D-01. Override with VITE_API_PROXY_TARGET rather than
 * editing this file, so the Compose and local-run profiles can differ.
 */
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    // jsdom rather than a real browser: these tests assert what renders for
    // which role. Real-browser verification of layout and responsive
    // behaviour is the design review in ui-ux.md section 12.
    environment: 'jsdom',
    globals: false,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
