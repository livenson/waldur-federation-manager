import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
      '/.well-known': {
        target: 'http://localhost:9000',
        changeOrigin: true,
      },
      '/federation': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        bypass(req) {
          // Don't proxy the bare /federation route — it's a frontend SPA page
          if (req.url === '/federation' || req.url === '/federation/') {
            return '/index.html';
          }
        },
      },
    },
  },
});
