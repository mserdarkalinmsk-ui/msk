import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { lazySingleFile } from './lazySingleFile';

export default defineConfig({
  plugins: [preact(), lazySingleFile()],
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')) },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 4000, minify: process.env.NOMIN ? false : 'esbuild' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as any);
