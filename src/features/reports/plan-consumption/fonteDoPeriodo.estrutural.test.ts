/**
 * 132/F4d · R-F4 — **o front NUNCA infere a fonte pela data.** Trava, não disciplina.
 *
 * `arquitetura.md:642-643`: só o backend sabe se **existe snapshot** para a competência. Um
 * front que olhasse `filters.from`/`filters.to` e concluísse "agosto já passou, logo é mês
 * fechado" afirmaria *"estes são os números que foram faturados"* sobre um cálculo ao vivo — e
 * erraria justamente no mês **reaberto**, que é quando alguém está conferindo dinheiro. Seria
 * uma segunda fonte de verdade sobre o que foi cobrado.
 *
 * Este arquivo varre a **AST** dos dois arquivos que decidem a exibição da fonte e reprova
 * qualquer leitura de relógio ou de filtro de data.
 *
 * Decisões de desenho (as mesmas de `src/test/superficies-de-export-sem-duracao.test.ts`):
 *
 *  1. **AST, nunca substring** (`rules/security.md` § invariante). `'new Date' in fonte` não
 *     distingue código de comentário, de string literal e de nome de teste — e o falso
 *     positivo aparece exatamente quando alguém **documenta a proibição**, que é o que os
 *     docblocks destes dois arquivos fazem. A varredura percorre a árvore **inteira**
 *     (`ts.forEachChild` recursivo; `arvore.statements` é raso e passaria vacuamente).
 *  2. **Identidade dos arquivos vigiados**, não cardinalidade: arquivo novo que decida fonte
 *     entra nesta lista no mesmo commit.
 *  3. **Controle positivo obrigatório**: uma fonte fabricada com `new Date()` e outra com
 *     `filters.from` **são detectadas** — sem isso, um detector quebrado devolveria conjunto
 *     vazio e todas as asserções abaixo ficariam verdes pelo vazio.
 *  4. **Controle NEGATIVO**: uma fonte fabricada que só MENCIONA a proibição em comentário e
 *     em string **não** é detectada — é a prova de que a varredura não é textual.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath, URL as UrlDoNode } from 'node:url'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Diretório deste arquivo, ancorado no PRÓPRIO módulo — nunca em `process.cwd()`, que muda
 * conforme de onde o runner é chamado. `URL` do **Node** é obrigatório: sob jsdom o `URL`
 * global é o do DOM e `fileURLToPath` recusa o resultado.
 */
const DIR = fileURLToPath(new UrlDoNode('.', import.meta.url))

/**
 * Os arquivos que decidem/exibem a fonte — allowlist NOMINAL, item a item, com o motivo.
 * Nunca padrão de nome (`*fonte*`): padrão de nome é regra sobre como o arquivo se parece,
 * não sobre o que ele faz.
 */
const VIGIADOS: { caminho: string; porque: string }[] = [
  {
    caminho: 'fonteDoPeriodoTextos.ts',
    porque:
      'É o dono de `normalizarFonte`/`derivarEstadoDoPeriodo`. Recebe SÓ o envelope — nem ' +
      '`from`/`to` estão na assinatura, o que torna a inferência impossível de escrever aqui.',
  },
  {
    caminho: 'components/FonteDoPeriodoAviso.tsx',
    porque:
      'É quem renderiza o selo. Ele formata datas VINDAS DO PAYLOAD (`competencia`, ' +
      '`competenciaFechadaEm`) — formatar é permitido; DECIDIR por data, não.',
  },
]

/**
 * O que é proibido, e por que cada item está na lista:
 *  · `new Date` / `Date.now`  → ler o relógio ⇒ "que mês é hoje?" ⇒ inferência;
 *  · `filters.from` / `filters.to` → ler o filtro da tela ⇒ inferência;
 *  · `defaultCurrentMonth*` → o helper de "mês atual" do projeto ⇒ inferência com outro nome.
 *
 * ⚠️ `formatDate`/`formatMonth` NÃO estão aqui: eles formatam um valor que o **servidor**
 * mandou. Proibir formatação de data tornaria o selo impossível de escrever, e é o tipo de
 * aperto que se afrouxa depois — o que cegaria a trava toda.
 */
const PROIBIDOS = [
  'new Date',
  'Date.now',
  'filters.from',
  'filters.to',
  'defaultCurrentMonth',
]

/**
 * Os padrões que aparecem como ACESSO A PROPRIEDADE — derivados de `PROIBIDOS`, nunca
 * redigitados: duas listas à mão sobre o mesmo conjunto divergem, e a única questão é quando
 * (`rules/security.md`).
 */
const PADROES_DE_ACESSO = PROIBIDOS.filter((p) => p.includes('.'))

type Achado = { arquivo: string; padrao: string; linha: number }

/**
 * Varredura por AST. Um achado é:
 *  · `new Date(...)`                          → `NewExpression` com callee `Date`;
 *  · `Date.now(...)` / `filters.from` / …     → `PropertyAccessExpression` cujo texto casa;
 *  · `defaultCurrentMonth…`                   → `Identifier` com esse prefixo de nome.
 *
 * Nenhum destes nós existe em comentário, em string literal ou em nome de teste — que é
 * exatamente a diferença entre isto e `padrao in fonte`.
 */
function varrer(arquivo: string, fonte: string): Achado[] {
  const arvore = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const achados: Achado[] = []

  const linhaDe = (no: ts.Node): number =>
    arvore.getLineAndCharacterOfPosition(no.getStart(arvore)).line + 1

  const visitar = (no: ts.Node): void => {
    if (ts.isNewExpression(no) && ts.isIdentifier(no.expression) && no.expression.text === 'Date') {
      achados.push({ arquivo, padrao: 'new Date', linha: linhaDe(no) })
    }
    if (ts.isPropertyAccessExpression(no)) {
      // Texto EXATO do acesso (`filters.from`), nunca sufixo (`x.from`): objeto que
      // coincidentemente tenha `.from` e não seja o filtro da tela não é infração.
      const texto = no.getText(arvore)
      const padrao = PADROES_DE_ACESSO.find((candidato) => candidato === texto)
      if (padrao !== undefined) achados.push({ arquivo, padrao, linha: linhaDe(no) })
    }
    if (ts.isIdentifier(no) && no.text.startsWith('defaultCurrentMonth')) {
      achados.push({ arquivo, padrao: 'defaultCurrentMonth', linha: linhaDe(no) })
    }
    ts.forEachChild(no, visitar)
  }

  // ⚠️ Percorre a árvore INTEIRA a partir do source file — `arvore.statements` seria raso e
  // deixaria de ver tudo dentro de função, JSX e classe, que é onde o defeito moraria.
  ts.forEachChild(arvore, visitar)
  return achados
}

describe('R-F4 — a fonte do período nunca é inferida pela data', () => {
  it('a lista de arquivos vigiados é nominalmente esta, e cada um traz o motivo', () => {
    // Identidade: arquivo novo que decida fonte entra aqui no mesmo commit. Cardinalidade
    // passaria com um entrando e outro saindo.
    expect(VIGIADOS.map((v) => v.caminho)).toEqual([
      'fonteDoPeriodoTextos.ts',
      'components/FonteDoPeriodoAviso.tsx',
    ])
    for (const v of VIGIADOS) {
      expect(v.porque.length, `${v.caminho} sem justificativa`).toBeGreaterThan(40)
    }
  })

  it('o conjunto de padrões proibidos é nominalmente este', () => {
    expect(PROIBIDOS).toEqual([
      'new Date',
      'Date.now',
      'filters.from',
      'filters.to',
      'defaultCurrentMonth',
    ])
  })

  it.each(VIGIADOS)('$caminho não lê relógio nem filtro de data', ({ caminho }) => {
    const fonte = readFileSync(join(DIR, caminho), 'utf8')

    // Anti-vacuidade: o arquivo foi lido de fato e tem conteúdo.
    expect(fonte.length).toBeGreaterThan(500)

    const achados = varrer(caminho, fonte)
    expect(
      achados,
      `${caminho} usa ${achados.map((a) => `${a.padrao}:${a.linha}`).join(', ')} — ` +
        'a fonte do período vem do PAYLOAD, nunca da data (arquitetura.md:642)',
    ).toEqual([])
  })

  it('🔴 controle POSITIVO: o detector pega as duas formas de inferência', () => {
    const comRelogio = `
      export function decidir(): string {
        const agora = new Date()
        return agora.getMonth() < 8 ? 'snapshot' : 'aovivo'
      }
    `
    const comFiltro = `
      type F = { from: string | null; to: string | null }
      export function decidir(filters: F): string {
        return filters.from === filters.to ? 'snapshot' : 'aovivo'
      }
    `
    expect(varrer('fabricado-relogio.ts', comRelogio).map((a) => a.padrao)).toEqual(['new Date'])
    expect(new Set(varrer('fabricado-filtro.ts', comFiltro).map((a) => a.padrao))).toEqual(
      new Set(['filters.from', 'filters.to']),
    )
  })

  it('🔴 controle NEGATIVO: menção em comentário e em string NÃO é achado', () => {
    // É a prova de que a varredura é sintática. Uma versão textual reprovaria justamente os
    // dois arquivos vigiados, cujos docblocks descrevem a proibição por extenso.
    const soMenciona = `
      /** Proibido usar new Date() ou filters.from aqui — ver arquitetura.md:642. */
      export const AVISO = 'nunca use new Date nem filters.to para decidir a fonte'
      export function ok(envelope: { fonte?: string | null }): string {
        return envelope.fonte ?? 'desconhecida'
      }
    `
    expect(varrer('fabricado-mencao.ts', soMenciona)).toEqual([])
  })
})
