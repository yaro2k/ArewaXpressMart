import { defineConfig } from 'vitest/config';

// PostgreSQL-backed suites are intentionally excluded from the ordinary test
// workflow. Run them with `npm run test:integration`, which uses the serial
// integration configuration and an explicitly supplied disposable database.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.integration.test.ts'],
  },
});
