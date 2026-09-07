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
import { derivarCascataDeCssDoApp, lerTokensDeCor } from '../../../../utils/cssCascade'
import { FATURA_CONTRAST_PAIRS } from './faturamentoTheme'

const PISO_AA = 4.5

/**
 * 123/FE-FIX4 (`F-9`) — a cascata de CSS é **derivada** do grafo real de `@import`
 * (`index.html` → `src/main.tsx` → `global.css` → …), nunca digitada aqui.
 *
 * Esta era a SEGUNDA lista à mão dos mesmos arquivos de tema (a outra estava em
 * `utils/alertTokenContrast.test.ts`), e as duas tinham 2 dos 4 arquivos da cascata:
 * `tokens.css` do design system e o `index.css` do Tailwind ficavam de fora. Duas
 * fontes de verdade sobre o mesmo conjunto divergem — a única questão é quando.
 * O mecanismo da derivação tem prova própria em `utils/cssCascade.test.ts`.
 */
const lerDoDisco = (caminho: string): string => readFileSync(resolve(process.cwd(), caminho), 'utf8')

const TOKENS = lerTokensDeCor(derivarCascataDeCssDoApp(lerDoDisco), lerDoDisco)

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
    // Valor HISTÓRICO de `--color-warning-fg` sobre `--color-warning-bg` = 3.00:1 — o par
    // que motivou os tokens aditivos (AP-FRONTEND-018), escrito à mão como LITERAL. O
    // token foi escurecido para #a85800 em 125/FE-A11Y-3 e hoje mede 5.00:1; lê-lo da
    // cascata aqui deixaria este controle positivo inerte. Se este assert deixar de
    // valer, o cálculo virou inerte.
    const razao = contrastRatio('#e07600', '#fffbef')
    expect(razao).toBeLessThan(PISO_AA)
    expect(razao).toBeCloseTo(3.0, 1)
  })
})
