import { defineConfig } from 'vite'

// `tsconfig.node.json` deliberately does not pull in @types/node, so reach for the
// environment through a narrow cast instead of adding a dependency for one variable.
const devApiTarget =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.FRESHBLOX_DEV_API_URL || 'http://127.0.0.1:8787'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    cors: true,
    // Vercel functions live in api/ and vite cannot execute them, so proxy to
    // `npm run dev:api` (scripts/dev-api.mjs). Without this, /api/* fell through to
    // index.html and the client reported an unhelpful JSON parsing failure.
    proxy: {
      '/api': {
        target: devApiTarget,
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
