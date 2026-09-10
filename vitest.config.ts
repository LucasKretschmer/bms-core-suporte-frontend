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
    /**
     * 134/U12 — o universo coletado é DECLARADO, não implícito.
     *
     * Sem `include`, o padrão do vitest é `**\/*.{test,spec}.?(c|m)[jt]s?(x)` a partir da raiz
     * do projeto: qualquer arquivo de teste que apareça FORA de `src/` (worktree solto, cópia
     * de trabalho, `dist/`, artefato de ferramenta) entra na contagem sem que ninguém decida
     * isso — e o denominador da suíte deixa de ser comparável entre execuções. Já aconteceu
     * neste repo: um worktree órfão dentro de `.claude/` inflou a contagem.
     *
     * Medido em 2026-09-09 (`vitest list --filesOnly`): **267 arquivos antes e 267 depois** —
     * hoje não há nenhum teste fora de `src/`, então a restrição não desloca o denominador;
     * ela só impede que o universo mude sozinho amanhã.
     */
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
