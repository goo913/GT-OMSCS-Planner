import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the app from https://<user>.github.io/<repo>/, so every asset
// URL has to be prefixed with the repo name. Override with BASE_PATH when hosting
// elsewhere (a custom domain wants "/").
const base = process.env.BASE_PATH ?? '/GT-OMSCS-Planner/'

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
