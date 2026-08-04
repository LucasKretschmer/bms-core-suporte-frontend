/**
 * Trava de contraste das superfícies de faturamento (121/FAT-5).
 *
 * `rules/frontend.md` § Contraste: "deixe um teste que calcula o contraste de todos
 * os pares do mapa e falha abaixo de 4,5:1 — vale mais que os números do dia da
 * entrega". Este arquivo faz três coisas, e as três importam:
 *
 *  1. calcula a razão WCAG de CADA par de `FATURA_CONTRAST_PAIRS` e reprova < 4.5;
 *  2. DERIVA o hex do CSS real (`src/styles/global.css` + `styles.css` do design
 *     system) e exige igualdade com o hex espelhado no módulo — sem isso, mudar o
 *     token no CSS deixaria o teste medindo uma cor que não está mais na tela;
 *  3. trava a IDENTIDADE do conjunto de pares (nomes literais), para que a suíte
 *     não encolha em silêncio quando um par novo entrar sem par de teste
 *     (`rules/tests.md` § "suíte parametrizada por enumeração encolhe em silêncio").
 *
 * Controle positivo/negativo incluído: um par fabricado que REPROVA precisa ser
 * detectado pela mesma função — senão o cálculo pode estar inerte.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../../../../utils/colorContrast'
import { FATURA_CONTRAST_PAIRS } from './faturamentoTheme'

const PISO_AA = 4.5

/**
 * CSS do design system primeiro; o `@theme` do app depois (o app sobrescreve).
 * Caminhos a partir da raiz do projeto (cwd do Vitest) — `import.meta.url` sob o
 * runner não é `file:` e quebraria o `readFileSync`.
 */
const ARQUIVOS_CSS = [
  resolve(process.cwd(), 'node_modules/@migrate/design-system/styles.css'),
  resolve(process.cwd(), 'src/styles/global.css'),
]

/** Lê `--color-*: #hex;` dos arquivos de tema, na ordem de precedência do CSS. */
function lerTokensDeCor(): Record<string, string> {
  const tokens: Record<string, string> = {}
  for (const arquivo of ARQUIVOS_CSS) {
    const conteudo = readFileSync(arquivo, 'utf8')
    const regex = /(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g
    for (const m of conteudo.matchAll(regex)) {
      tokens[m[1]] = m[2].toLowerCase()
    }
  }
  return tokens
}

const TOKENS = lerTokensDeCor()

describe('faturamentoTheme — contraste (piso AA de 4.5:1, inviolável)', () => {
  it('o conjunto de pares auditados é exatamente o esperado (não encolhe em silêncio)', () => {
    expect(new Set(FATURA_CONTRAST_PAIRS.map((p) => p.label))).toEqual(
      new Set([
        'badge "Na fatura: Sim"',
        'badge "Na fatura: Não"',
        'card de exceções — título/contagem',
        'card de exceções — subtexto (foreground sobre o fundo de alerta)',
        'texto secundário e aba inativa (muted sobre card)',
        'aba ativa do modal (primary sobre card)',
      ]),
    )
  })

  it.each(FATURA_CONTRAST_PAIRS)(
    'o par $label atinge ao menos 4.5:1',
    ({ fg, bg, label }) => {
      const razao = contrastRatio(fg, bg)
      expect(
        razao,
        `${label}: ${fg} sobre ${bg} = ${razao.toFixed(2)}:1 (piso ${PISO_AA}:1)`,
      ).toBeGreaterThanOrEqual(PISO_AA)
    },
  )

  it.each(FATURA_CONTRAST_PAIRS)(
    'o hex do par $label é o mesmo do CSS real (module × global.css/DS)',
    ({ fgToken, bgToken, fg, bg }) => {
      expect(TOKENS[fgToken], `token ${fgToken} não encontrado no CSS`).toBeDefined()
      expect(TOKENS[bgToken], `token ${bgToken} não encontrado no CSS`).toBeDefined()
      expect(TOKENS[fgToken]).toBe(fg.toLowerCase())
      expect(TOKENS[bgToken]).toBe(bg.toLowerCase())
    },
  )

  it('reprova um par fabricado abaixo do piso (controle positivo do detector)', () => {
    // `--color-warning-fg` sobre `--color-warning-bg` = 3.00:1 — o par oficial do DS
    // que motivou os tokens aditivos (AP-FRONTEND-018). Se este assert deixar de
    // valer, o cálculo virou inerte.
    const razao = contrastRatio('#e07600', '#fffbef')
    expect(razao).toBeLessThan(PISO_AA)
    expect(razao).toBeCloseTo(3.0, 1)
  })
})
