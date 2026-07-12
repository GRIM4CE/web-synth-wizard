import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
  ],
  server: {
    port: 4000,
  },
  build: {
    // Skip the gzip-size report Vite computes for every emitted asset — it is
    // build-time-only diagnostics with no effect on output, so dropping it
    // shaves a small amount off each Amplify build.
    reportCompressedSize: false,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @import "./src/assets/extends.scss";
        `
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
