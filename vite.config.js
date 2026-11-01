import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { securityHeaders } from './security-headers.js'
import { pwa } from './pwa.js'
import { existsSync, readFileSync } from 'node:fs'
import process from 'node:process'

// The Android app to download from Settings → App (features/native/androidApk.js): the Android repo's
// `npm run apk:web` puts the signed APK and its details into public/download/ (git-ignored, so the
// file goes out with the deploy but never into git). Without them the row isn't shown.
const APK_INFO = 'public/download/quidey-android.json'
const androidApk = () => (existsSync(APK_INFO) && existsSync('public/download/quidey.apk') ? readFileSync(APK_INFO, 'utf8') : '')

// https://vite.dev/config/
// The build also writes dist/_headers (security headers, see security-headers.js) for the
// API address in VITE_API_URL, e.g. from .env.production.local, and dist/sw.js (the PWA's
// service worker, see pwa.js).
export default defineConfig(({ mode }) => {
  // VITE_ANDROID_APK: the APK's details for import.meta.env (Vite takes VITE_ variables from
  // process.env too); only in the web build, not in the app itself (mode android) nor in tests
  if (mode === 'production') process.env.VITE_ANDROID_APK = androidApk()
  return {
    plugins: [react(), securityHeaders(loadEnv(mode, '.', 'VITE_').VITE_API_URL), pwa()],
    build: {
      rolldownOptions: {
        output: {
          // The libraries in chunks of their own: they change far less often than the app, so after
          // a deploy browsers keep them cached and only fetch the app's (small) changed chunks.
          // Remotion and the Socket.IO client stay where they are: loaded only when needed.
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'router', test: /node_modules[\\/](react-router|react-router-dom)[\\/]/ },
              { name: 'state', test: /node_modules[\\/](@reduxjs|redux|redux-thunk|react-redux|reselect|immer|use-sync-external-store)[\\/]/ },
              { name: 'motion', test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/ },
            ],
          },
        },
      },
    },
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
        // the live connection (Socket.IO) for chats and notices, incl. its WebSocket upgrade
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      host: true,
      port: 4173,
      strictPort: true,
    },
  }
})
