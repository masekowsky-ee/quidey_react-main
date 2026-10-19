import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { securityHeaders } from './security-headers.js'

// https://vite.dev/config/
// The build also writes dist/_headers (security headers, see security-headers.js) for the
// API address in VITE_API_URL, e.g. from .env.production.local.
export default defineConfig(({ mode }) => ({
  plugins: [react(), securityHeaders(loadEnv(mode, '.', 'VITE_').VITE_API_URL)],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      // forward every request starting with /api to the backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
}))
