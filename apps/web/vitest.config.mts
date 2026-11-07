import { defineConfig } from 'vitest/config'

// Unit tests only. The Playwright specs in tests/e2e/ run with `pnpm test:e2e`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
