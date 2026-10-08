import { defineConfig } from 'vitest/config';

// Integration suites share one explicitly supplied disposable PostgreSQL database.
// Keep only those files serial; normal unit tests retain Vitest's default parallelism.
export default defineConfig({
  test: {
    fileParallelism: false,
    include: ['test/**/*.integration.test.ts'],
  },
});
