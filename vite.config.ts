/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm']
  },
  test: {
    environment: 'happy-dom',
    globals: true
  }
});
