import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
})
