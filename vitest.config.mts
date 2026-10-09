import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // Use explicit imports (import { describe, it, expect } from 'vitest')
    // rather than globals to keep TypeScript happy without extra tsconfig changes.
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
})
