import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/portal/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'ふたりのポータル',
        short_name: 'ポータル',
        description: 'ふたりの生活・予定・共有アプリハブ',
        start_url: '/portal/',
        scope: '/portal/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#db2777',
        lang: 'ja',
        icons: [
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
});