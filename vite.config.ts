import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the app from https://<user>.github.io/<repo>/, so every asset
// URL has to be prefixed with the repo name. Override with BASE_PATH when hosting
// elsewhere (a custom domain wants "/").
const base = process.env.BASE_PATH ?? '/GT-OMSCS-Planner/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
