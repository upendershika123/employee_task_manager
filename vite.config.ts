import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Remove the define section as we'll use import.meta.env directly
  build: {
    sourcemap: true
  }
}) 