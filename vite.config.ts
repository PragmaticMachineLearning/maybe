import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'hyperformula': path.resolve(__dirname, './hyperformula/src'),
      // Make node_modules available to hyperformula
      'chevrotain': path.resolve(__dirname, 'node_modules/chevrotain'),
      'tiny-emitter': path.resolve(__dirname, 'node_modules/tiny-emitter')
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
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
    include: [
      'chevrotain', 
      'tiny-emitter'
    ],
    // Don't exclude hyperformula - let Vite handle its dependencies
    force: true,
    esbuildOptions: {
      // Needed for TypeScript interop
      target: 'esnext',
      supported: {
        'top-level-await': true
      },
      // Add .ts extension handling
      resolveExtensions: ['.ts', '.js'],
      loader: {
        '.ts': 'ts'
      }
    }
  },
  build: {
    // Better source maps for debugging
    sourcemap: true,
    // Cleaner output
    minify: false,
    rollupOptions: {
      external: ['chevrotain', 'tiny-emitter'],
      output: {
        globals: {
          chevrotain: 'chevrotain',
          'tiny-emitter': 'TinyEmitter'
        }
      }
    }
  }
})
