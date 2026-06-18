import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // In dev, proxy API calls to the FastAPI backend
    proxy: {
      '/api': {
        target: 'http://localhost:7777',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
  }
})
