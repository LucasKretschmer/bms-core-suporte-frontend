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
    /**
     * 🔴 **132/F1 — de 6 para 4, e a diferença é NOMINAL, não numérica.**
     *
     * Saíram os dois pares do card de exceções de faturamento (`título/contagem` e
     * `subtexto`), porque a 132/D7 apagou o card: com `TimeEntry.InicioEm` como
     * competência (D1), não existe mais "chamado fora de qualquer fatura" para conferir.
     * Com eles saíram os tokens `--color-excecao-fatura-fg/-bg` de `global.css` — e é
     * por isso que a remoção precisa acontecer **aqui no mesmo commit**: o caso
     * `it.each` seguinte exige que cada `fgToken`/`bgToken` deste inventário **exista no
     * CSS real**, então um par sobrevivente apontando para token apagado reprovaria
     * nomeando o token (comportamento correto do invariante).
     *
     * Os outros dois foram **reescritos, não removidos**: eles diziam "do modal", e o
     * modal era o de exceções. O par continua real; o rótulo é que envelheceu
     * (`AP-QA-044`). Ver o comentário ao lado deles em `faturamentoTheme.ts`.
     *
     * ✅ **132/F4b entrou: de 4 para 5.** O par novo é o `+2h` verde da coluna
     * "Qtde. Plano (h)" (`--color-success-fg` sobre `--color-card`). O aviso que a F1 deixou
     * aqui — *"quando ela entrar, esta lista vai a 5"* — foi cumprido **nominalmente**: é
     * este assert que obrigou a declarar o nome do par, em vez de deixá-lo entrar sem
     * medição. A razão medida está no controle de valor abaixo.
     */
    expect(new Set(FATURA_CONTRAST_PAIRS.map((p) => p.label))).toEqual(
      new Set([
        'badge "Na fatura: Sim"',
        'badge "Na fatura: Não"',
        'texto secundário e aba inativa (muted sobre card)',
        'aba ativa e link em tabela (primary sobre card)',
        'crédito de horas (+Xh) na coluna Qtde. Plano',
      ]),
    )
  })

  it('132/F4b — a razão MEDIDA do verde do crédito, com o número escrito à mão', () => {
    /**
     * `rules/frontend.md` § Contraste: **AA é piso inviolável e ele se MEDE.** O `it.each`
     * acima já reprovaria abaixo de 4,5:1, mas ele não deixa o NÚMERO registrado em lugar
     * nenhum — e "passou o piso" não é medição, é aprovação.
     *
     * Os dois valores abaixo são literais escritos à mão, medidos com este mesmo
     * `contrastRatio` no dia da entrega (2026-09-09):
     *  · `#008000` sobre `--color-card` (`#ffffff`)      → **5,14:1**  (a superfície real);
     *  · `#008000` sobre `--color-background` (`#f0f4f7`) → **4,65:1**  (medido também, porque
     *    §3.4 da análise manda medir o fundo da página caso a tabela caia sobre ele — hoje ela
     *    não cai, e mesmo se cair o par passa).
     *
     * O que deixa isto vermelho: escurecer/clarear `--color-success-fg` (aí o `it.each` do hex
     * também cai, nomeando o token) ou trocar o fundo da célula.
     */
    expect(contrastRatio('#008000', '#ffffff')).toBeCloseTo(5.14, 2)
    expect(contrastRatio('#008000', '#f0f4f7')).toBeCloseTo(4.65, 2)
    expect(contrastRatio('#008000', '#f0f4f7')).toBeGreaterThanOrEqual(PISO_AA)
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
    //
    // 🔴 132/F1 — `#fffbef` era TAMBÉM o valor de `--color-excecao-fatura-bg`, que este
    // commit apagou de `global.css`. O controle positivo NÃO quebra por isso, e não é
    // sorte: ele é `--color-warning-bg` (`global.css:33`, ainda lá) e está escrito como
    // literal justamente para não depender de token nenhum. Verificado antes de remover.
    const razao = contrastRatio('#e07600', '#fffbef')
    expect(razao).toBeLessThan(PISO_AA)
    expect(razao).toBeCloseTo(3.0, 1)
  })
})
