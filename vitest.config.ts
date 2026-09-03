import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // No @vitejs/plugin-react: it pins a babel line the Astryx CLI conflicts
  // with, and esbuild compiles our TSX fine with the automatic runtime.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/support/setup.ts'],
    include: ['test/**/*.test.tsx', 'test/**/*.test.ts'],
  },
})
