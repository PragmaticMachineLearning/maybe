import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'hyperformula': path.resolve(__dirname, './hyperformula/es')
    }
  },
  // Define global variables for the browser environment
  define: {
    // Provide process.env for code that expects Node.js environment
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    // For older code that accesses process directly
    'process': {
      env: {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
      }
    }
  },
  optimizeDeps: {
    // Properly handle TypeScript's types during build
    esbuildOptions: {
      // This helps preserve TypeScript types during the build
      tsconfigRaw: {
        compilerOptions: {
          // Allow importing types
          "importsNotUsedAsValues": "preserve",
          "preserveValueImports": true
        }
      }
    },
    include: ['hyperformula']
  },
  build: {
    // Better source maps for debugging
    sourcemap: true,
    // Cleaner output
    minify: false
  }
})
