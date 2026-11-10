import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite' // Add this

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(), // Add this
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'firebase',
              test: /node_modules[\\/](?:@firebase|firebase)[\\/]/,
              priority: 20,
            },
            {
              name: 'vue-vendor',
              test: /node_modules[\\/](?:vue|@vue|vue-router|pinia)[\\/]/,
              priority: 10,
            },
            {
              name: 'ticket-pdf',
              test: /node_modules[\\/](?:jspdf|fflate|fast-png|@babel)[\\/]/,
              priority: 5,
            },
            {
              name: 'ticket-qr',
              test: /node_modules[\\/](?:qrcode|dijkstrajs|pngjs)[\\/]/,
              priority: 5,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 1,
            },
          ],
        },
      },
    },
  },
})