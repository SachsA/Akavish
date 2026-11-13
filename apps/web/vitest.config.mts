import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests only. The Playwright specs in tests/e2e/ run with `pnpm test:e2e`.
export default defineConfig({
  // The app's `@/…` imports, so route handlers can be tested too.
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
