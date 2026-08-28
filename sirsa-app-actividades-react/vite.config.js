import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest → SW propio (src/sw.js) para poder manejar Web Push
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'SIR-Flow — Control de Actividades',
        short_name: 'SIR-Flow',
        description: 'Seguimiento de proyectos y actividades del Departamento Técnico SIRSA.',
        lang: 'es-MX',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1D1C19',
        background_color: '#F5F5F5',
        categories: ['productivity', 'business'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
      devOptions: {
        // La PWA solo se activa en el build de producción
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
