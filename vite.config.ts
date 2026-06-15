import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vite config da RAIZ — aponta para web/src como entrada principal
export default defineConfig({
  plugins: [react()],
  root: 'web',
  publicDir: 'web/public',
  build: {
    outDir: '../web/dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
