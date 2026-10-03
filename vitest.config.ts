import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000,
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
