import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    env: {
      JWT_SECRET: 'test-only-secret-not-used-anywhere-else-0123456789abcdef',
      NODE_ENV: 'test'
    }
  }
});
