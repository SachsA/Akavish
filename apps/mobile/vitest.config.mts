import { defineConfig } from 'vitest/config'

// Unit tests for the app's pure helpers (src/lib). Screens and components need
// a device or simulator; these don't.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
})
