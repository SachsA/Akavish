import { defineConfig } from 'vitest/config'

// Unit tests: pure code next to its source (src/**/*.test.ts), no database.
// The integration tests (tests/int, real Postgres) have their own config.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
