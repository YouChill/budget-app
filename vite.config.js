import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Service worker: precache zbudowanych zasobów, żeby aplikacja startowała
    // offline (kolejka offline w JS obsługuje dane; SW obsługuje sam shell).
    // Manifest utrzymujemy ręcznie w public/site.webmanifest (manifest: false).
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Nie przechwytuj żądań nawigacyjnych do endpointów API.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
