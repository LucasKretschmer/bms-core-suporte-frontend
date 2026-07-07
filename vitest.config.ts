import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Evita React duplicado ao consumir @migrate/design-system via dependência file: (R1) —
    // vitest.config.ts é isolado de vite.config.ts, precisa do mesmo dedupe.
    dedupe: ['react', 'react-dom'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
