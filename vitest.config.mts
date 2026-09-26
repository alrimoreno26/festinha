import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': import.meta.dirname,
      // Fora do Next o pacote "server-only" lança erro; nos testes ele não precisa fazer nada.
      'server-only': path.resolve(import.meta.dirname, 'tests/helpers/empty.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
