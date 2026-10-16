import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/hospitals': 'http://127.0.0.1:8000',
      '/forecast': 'http://127.0.0.1:8000',
      '/transfers': 'http://127.0.0.1:8000',
      '/inventory': 'http://127.0.0.1:8000',
      '/stock': 'http://127.0.0.1:8000',
    },
  },
})
