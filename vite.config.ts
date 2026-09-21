/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/sql-viewer/' : '/',
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm']
  },
  test: {
    environment: 'happy-dom',
    globals: true
  }
});
