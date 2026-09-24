import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (normalizedId.includes('/node_modules/three/')) return 'three-vendor';
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(normalizedId)) return 'react-vendor';
        },
      },
    },
  },
});
