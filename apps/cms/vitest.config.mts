import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Integration tests: they boot Payload against a real Postgres (DATABASE_URL)
// and write to it, so `vitest.setup.ts` refuses anything but a local database.
// Node environment: Payload's local API isn't meant to run under jsdom.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    // Booting Payload and its first queries can take a while on a cold DB.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
