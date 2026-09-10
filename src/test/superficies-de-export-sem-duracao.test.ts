/**
 * 134 · U9 — a enumeração das superfícies de export é **DERIVADA**, não digitada.
 *
 * Os vereditos "sem duração" (análise §1.2) são travados superfície por superfície, cada um
 * no teste da sua tela. Mas um veredito por superfície só protege as superfícies que
 * **alguém lembrou de listar**: no dia em que nascer um export novo, ele nasce fora de toda
 * varredura, e "menos parâmetros nunca é erro para o runner" (`AP-QA-019`).
 *
 * Este arquivo fecha esse buraco. Ele **descobre em runtime**, na fonte real (o código em
 * `src/`), todos os arquivos que chamam `exportToCsv`/`exportToXlsx`, e exige que cada um
 * esteja declarado — nominalmente, com justificativa escrita ao lado — em uma de duas
 * listas: COM duração (coberta pelo assert de identidade da própria superfície) ou SEM
 * duração (coberta pelo veredito de U9). Arquivo que não esteja em nenhuma das duas
 * reprova, **nomeando** o arquivo.
 *
 * Decisões de desenho, e o porquê de cada uma:
 *
 * 1. **AST, nunca substring** (`rules/security.md` § invariante). `'exportToCsv(' in fonte`
 *    não distingue código de comentário, docstring, string literal e nome de teste — e o
 *    falso positivo aparece exatamente quando alguém **documenta** a chamada, que é o que
 *    os cabeçalhos desta demanda fazem o tempo todo. A varredura usa `ts.forEachChild` sobre
 *    a árvore inteira e só conta `CallExpression` cujo callee é o identificador.
 * 2. **Exclusão é allowlist NOMINAL, item por item** — nunca padrão de nome. Só o próprio
 *    `exportTable.ts` (que *declara* as funções) e os arquivos `*.test.*` ficam de fora, e
 *    ambos por motivo escrito.
 * 3. **Identidade, não cardinalidade** — a asserção é sobre o conjunto de caminhos literais.
 *    Cardinalidade passa quando um arquivo entra e outro sai.
 * 4. **Controle positivo do detector** — dois casos fabricados provam que ele acha o que
 *    tem de achar e ignora o que tem de ignorar. Sem eles, um detector quebrado devolveria
 *    conjunto vazio e as subtrações abaixo ficariam todas verdes pelo vazio
 *    (`rules/tests.md` § padrão 1).
 *
 * Escopo: este arquivo **não** afirma quais chaves de duração cada superfície tem — isso é
 * o inventário global de §9.4, da unidade de fechamento (U12), em arquivo próprio.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath, URL as UrlDoNode } from 'node:url'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Raiz de `src/`, ancorada no PRÓPRIO arquivo — nunca em `process.cwd()`, que muda conforme
 * de onde o runner é chamado. O `URL` do **Node** é obrigatório aqui: sob jsdom o `URL`
 * global é o do DOM, que resolve o caminho relativo contra a base do documento
 * (`http://localhost:3000/src`) e faz `fileURLToPath` recusar ("must be of scheme file").
 */
const RAIZ_SRC = fileURLToPath(new UrlDoNode('..', import.meta.url))

/** Nomes das funções de export. Um call site é qualquer chamada direta a uma delas. */
const FUNCOES_DE_EXPORT = new Set(['exportToCsv', 'exportToXlsx'])

/**
 * Allowlist NOMINAL de exclusão — dois itens, cada um com o motivo ao lado.
 * Nunca trocar por padrão de nome ("tudo que começa com…"): padrão de nome é regra sobre
 * como o arquivo **se parece**, não sobre o que ele **é**.
 */
const EXCLUSOES: { caminho: string; motivo: string }[] = [
  {
    caminho: 'features/reports/shared/utils/exportTable.ts',
    motivo:
      'É o módulo que DECLARA `exportToCsv`/`exportToXlsx` — não é uma superfície de export. ' +
      'Coberto por exportTable.test.ts e exportTable.duracao.test.ts (U0).',
  },
]

/** Arquivos `*.test.ts(x)` também são excluídos: exercitam o export, não o expõem ao usuário. */
function ehArquivoDeTeste(caminhoRelativo: string): boolean {
  return /\.test\.tsx?$/.test(caminhoRelativo)
}

/**
 * Superfícies COM coluna de duração (análise §1.1). Cada uma tem, no teste da própria
 * superfície, o assert de IDENTIDADE literal do conjunto de chaves `type: 'duration'` —
 * por isso não precisam de nada aqui além de estarem declaradas.
 */
const COM_DURACAO: { caminho: string; superficie: string }[] = [
  { caminho: 'features/client-tickets/components/ClientTicketsPanel.tsx', superficie: 'S5 · Painel de tickets do cliente' },
  { caminho: 'features/dashboards/onboarding/components/OnboardingTicketSection.tsx', superficie: 'S11 · Onboarding · tickets' },
  { caminho: 'features/dashboards/shared/components/MetricDrillModal.tsx', superficie: 'S7/S8/S9 · Drill (ticket, cliente, apontamento). A 4ª família do mesmo modal — PROJETO — é SEM duração e tem veredito próprio em projetoDrillColumns.test.ts' },
  { caminho: 'features/dashboards/support/components/SupportPlanHealthSection.tsx', superficie: 'S6 · Saúde dos planos' },
  { caminho: 'features/reports/appointments/index.tsx', superficie: 'S3 · Apontamentos por ticket' },
  { caminho: 'features/reports/client-report/index.tsx', superficie: 'S2 · Relatório do cliente (colunas em utils/clientReportExportRows.ts)' },
  { caminho: 'features/reports/plan-consumption/index.tsx', superficie: 'S1 · Consumo de planos' },
  { caminho: 'features/reports/productivity/index.tsx', superficie: 'S10 · Produtividade (colunas em exportRow.ts)' },
  { caminho: 'features/reports/project-appointments/index.tsx', superficie: 'S4 · Apontamentos por projeto' },
  { caminho: 'features/sincronizador/index.tsx', superficie: 'S12 · Logs do sincronizador (colunas em utils/logExportRow.ts)' },
]

/**
 * Superfícies SEM coluna de duração (análise §1.2) — os vereditos de U9. Cada linha aponta
 * o teste que trava o veredito; nenhum deles pode ficar sem dono.
 */
const SEM_DURACAO: { caminho: string; veredito: string; testeQueTrava: string }[] = [
  {
    caminho: 'features/movimentacao-diaria/index.tsx',
    veredito: '`Quantidade` é contagem; `Data`/`Última atualização` são instantes',
    testeQueTrava: 'features/movimentacao-diaria/index.export.test.tsx',
  },
  {
    caminho: 'features/service-categories/index.tsx',
    veredito: 'Categoria · Situação · Cobrança fora do plano — nenhum campo de tempo',
    testeQueTrava: 'features/service-categories/index.test.tsx',
  },
  {
    caminho: 'features/sincronizador/components/ManutencaoRegistros.tsx',
    veredito: '`Criado em` é instante (`formatDate`), não duração',
    testeQueTrava: 'features/sincronizador/components/ManutencaoRegistros.test.tsx',
  },
  {
    caminho: 'features/teams/index.tsx',
    veredito: 'Atendente · E-mail · Equipes · Perfil — tudo texto',
    testeQueTrava: 'features/teams/index.export.test.tsx',
  },
]

/** O 5º veredito de U9 não é um call site: é uma das 4 famílias de coluna do MetricDrillModal. */
const VEREDITO_SEM_CALL_SITE = {
  caminho: 'features/dashboards/shared/utils/projetoDrillColumns.ts',
  veredito: 'Drill da família projeto: `iniciadoEm`/`concluidoEm` são instantes',
  testeQueTrava: 'features/dashboards/shared/utils/projetoDrillColumns.test.ts',
}

// ── Detector (AST) ─────────────────────────────────────────────────────────────

/** `true` se a fonte contém uma CHAMADA a `exportToCsv`/`exportToXlsx` (não menção). */
function chamaFuncaoDeExport(nomeArquivo: string, fonte: string): boolean {
  const arvore = ts.createSourceFile(nomeArquivo, fonte, ts.ScriptTarget.Latest, true)
  let achou = false

  const visitar = (no: ts.Node): void => {
    if (achou) return
    if (ts.isCallExpression(no)) {
      const alvo = no.expression
      const nome = ts.isIdentifier(alvo)
        ? alvo.text
        : ts.isPropertyAccessExpression(alvo)
          ? alvo.name.text
          : null
      if (nome !== null && FUNCOES_DE_EXPORT.has(nome)) {
        achou = true
        return
      }
    }
    ts.forEachChild(no, visitar)
  }

  ts.forEachChild(arvore, visitar)
  return achou
}

/**
 * Quantas vezes a fonte de um teste afirma `expect(chavesDeDuracao(…)).toEqual(…)`,
 * separando o **veredito** (`toEqual([])` — array literal vazio, escrito ali) da
 * **companheira positiva** (`toEqual` de qualquer outra coisa: array não vazio ou a
 * constante de chaves esperadas do próprio arquivo).
 *
 * Existe porque `testeQueTrava`, sozinho, é só uma **afirmação escrita à mão** sobre outro
 * arquivo — e afirmação à mão envelhece calada: bastaria alguém apagar o veredito lá para
 * este inventário continuar verde jurando que ele existe. Aqui a afirmação é **verificada na
 * fonte real**. Continua sendo AST e não substring: um `toEqual([])` citado num comentário
 * ou dentro de uma string não conta (`rules/security.md` § invariante sobre estrutura de
 * código vai na AST).
 */
function contarVereditosDeDuracao(
  nomeArquivo: string,
  fonte: string,
): { vazios: number; naoVazios: number } {
  const arvore = ts.createSourceFile(nomeArquivo, fonte, ts.ScriptTarget.Latest, true)
  let vazios = 0
  let naoVazios = 0

  /** `expect(chavesDeDuracao(…))` — a chamada de `expect` cujo argumento é o detector. */
  const ehExpectDoDetector = (no: ts.Node): boolean =>
    ts.isCallExpression(no) &&
    ts.isIdentifier(no.expression) &&
    no.expression.text === 'expect' &&
    no.arguments.length > 0 &&
    ts.isCallExpression(no.arguments[0]) &&
    ts.isIdentifier(no.arguments[0].expression) &&
    no.arguments[0].expression.text === 'chavesDeDuracao'

  const visitar = (no: ts.Node): void => {
    if (
      ts.isCallExpression(no) &&
      ts.isPropertyAccessExpression(no.expression) &&
      no.expression.name.text === 'toEqual' &&
      ehExpectDoDetector(no.expression.expression) &&
      no.arguments.length === 1
    ) {
      const esperado = no.arguments[0]
      const ehListaVazia = ts.isArrayLiteralExpression(esperado) && esperado.elements.length === 0
      if (ehListaVazia) vazios += 1
      else naoVazios += 1
    }
    ts.forEachChild(no, visitar)
  }

  ts.forEachChild(arvore, visitar)
  return { vazios, naoVazios }
}

function listarArquivosDeCodigo(diretorio: string, acumulador: string[] = []): string[] {
  for (const entrada of readdirSync(diretorio)) {
    const caminhoAbsoluto = join(diretorio, entrada)
    if (statSync(caminhoAbsoluto).isDirectory()) {
      listarArquivosDeCodigo(caminhoAbsoluto, acumulador)
      continue
    }
    if (/\.tsx?$/.test(entrada)) acumulador.push(caminhoAbsoluto)
  }
  return acumulador
}

/** Conjunto DERIVADO: todo arquivo de produção em `src/` que chama uma função de export. */
function descobrirCallSites(): string[] {
  const excluidos = new Set(EXCLUSOES.map((e) => e.caminho))
  const encontrados: string[] = []

  for (const absoluto of listarArquivosDeCodigo(RAIZ_SRC)) {
    const caminho = relative(RAIZ_SRC, absoluto).replaceAll('\\', '/')
    if (ehArquivoDeTeste(caminho) || excluidos.has(caminho)) continue
    if (chamaFuncaoDeExport(caminho, readFileSync(absoluto, 'utf8'))) encontrados.push(caminho)
  }

  return encontrados.sort()
}

// ── Testes ─────────────────────────────────────────────────────────────────────

describe('detector de call site de export (controle positivo)', () => {
  it('ACHA uma chamada real', () => {
    // Sem este caso, um detector quebrado devolveria `[]` e TODAS as asserções derivadas
    // abaixo ficariam verdes pelo vazio.
    const fonte = `
      import { exportToCsv } from './exportTable'
      export function baixar() { exportToCsv('arquivo', [], []) }
    `
    expect(chamaFuncaoDeExport('fake.ts', fonte)).toBe(true)
  })

  it('IGNORA menção em comentário, em string e no nome de uma variável', () => {
    // É a precisão que uma varredura por substring não tem — e o falso positivo apareceria
    // justamente nos cabeçalhos que documentam a demanda.
    const fonte = `
      /** Esta tela usa exportToCsv(...) e exportToXlsx(...) — só na documentação. */
      const rotulo = 'exportToCsv(nome, colunas, linhas)'
      const exportToCsvHabilitado = true
      export function nada() { return rotulo.length + Number(exportToCsvHabilitado) }
    `
    expect(chamaFuncaoDeExport('fake.ts', fonte)).toBe(false)
  })

  it('a varredura enxerga a árvore de arquivos real (não um diretório vazio)', () => {
    // Controle positivo do caminhamento: se `RAIZ_SRC` apontasse para o lugar errado, a
    // lista viria vazia e o `toEqual([])` do veredito passaria por acidente.
    const arquivos = listarArquivosDeCodigo(RAIZ_SRC)
    expect(arquivos.length).toBeGreaterThan(200)
    expect(
      arquivos.some((a) =>
        a.replaceAll('\\', '/').endsWith('features/reports/shared/utils/exportTable.ts'),
      ),
    ).toBe(true)
  })
})

describe('detector de veredito em arquivo de teste (controle positivo)', () => {
  it('distingue veredito, companheira positiva e menção', () => {
    // Sem estes dois casos, um detector quebrado devolveria sempre `{0,0}` (e o teste de
    // `testeQueTrava` reprovaria tudo) ou sempre `{1,1}` (e ele não provaria nada).
    const comVeredito = `
      it('veredito', () => {
        expect(chavesDeDuracao(marcadas)).toEqual(['nome', 'situacao'])
        expect(chavesDeDuracao(colunasCsv)).toEqual([])
      })
    `
    expect(contarVereditosDeDuracao('fake.test.ts', comVeredito)).toEqual({
      vazios: 1,
      naoVazios: 1,
    })

    const soMencao = `
      /** Este arquivo teria \`expect(chavesDeDuracao(cols)).toEqual([])\` se fosse veredito. */
      const lembrete = 'expect(chavesDeDuracao(cols)).toEqual([])'
      it('outra coisa', () => { expect(cols).toEqual([]) })
    `
    expect(contarVereditosDeDuracao('fake.test.ts', soMencao)).toEqual({
      vazios: 0,
      naoVazios: 0,
    })
  })
})

describe('134 · inventário DERIVADO das superfícies de export', () => {
  const derivadas = descobrirCallSites()

  it('identidade literal do conjunto de call sites (não a cardinalidade)', () => {
    // Vermelho quando nasce um export novo em qualquer canto de `src/`, e vermelho quando
    // um dos atuais some. Cardinalidade passaria com um entrando e outro saindo.
    expect(derivadas).toEqual(
      [...COM_DURACAO.map((s) => s.caminho), ...SEM_DURACAO.map((s) => s.caminho)].sort(),
    )
  })

  it('todo call site está declarado COM ou SEM duração — nenhum fica órfão', () => {
    const declarados = new Set([
      ...COM_DURACAO.map((s) => s.caminho),
      ...SEM_DURACAO.map((s) => s.caminho),
    ])
    const orfaos = derivadas.filter((c) => !declarados.has(c))

    // A mensagem nomeia o arquivo: quem criar um export novo lê o que precisa fazer.
    expect(
      orfaos,
      `Superfície de export não declarada no inventário da demanda 134. Para cada arquivo ` +
        `abaixo, decida se a superfície TEM coluna de duração (marque \`type: 'duration'\` e ` +
        `trave a identidade das chaves no teste dela) ou NÃO TEM (acrescente o veredito com ` +
        `\`expect(chavesDeDuracao(...)).toEqual([])\`), e declare-a aqui:`,
    ).toEqual([])
  })

  it('as duas listas são disjuntas e cada superfície SEM duração aponta o teste que a trava', () => {
    const comDuracao = new Set(COM_DURACAO.map((s) => s.caminho))
    expect(SEM_DURACAO.filter((s) => comDuracao.has(s.caminho))).toEqual([])

    // Positiva pareada: as 4 estão de fato entre as derivadas (não é lista de arquivo morto).
    for (const superficie of SEM_DURACAO) {
      expect(derivadas).toContain(superficie.caminho)
    }
  })

  it('cada `testeQueTrava` EXISTE e contém de fato o veredito + a companheira positiva', () => {
    // `testeQueTrava` era, até aqui, uma afirmação escrita à mão sobre outro arquivo — e a
    // única verificação que tinha era o formato do NOME (`/\.test\.tsx?$/`), que é regra
    // sobre como o caminho se parece, não sobre o que o arquivo faz (`rules/security.md`:
    // exclusão/afirmação por padrão de nome nunca). Apagar o veredito lá deixava este
    // inventário verde jurando que ele existia. Agora a afirmação é lida na fonte real.
    for (const superficie of [...SEM_DURACAO, VEREDITO_SEM_CALL_SITE]) {
      const absoluto = join(RAIZ_SRC, superficie.testeQueTrava)
      expect(
        existsSync(absoluto),
        `O inventário afirma que "${superficie.caminho}" é travado por ` +
          `"${superficie.testeQueTrava}", e esse arquivo NÃO EXISTE.`,
      ).toBe(true)

      const uso = contarVereditosDeDuracao(
        superficie.testeQueTrava,
        readFileSync(absoluto, 'utf8'),
      )

      expect(
        uso.vazios,
        `"${superficie.testeQueTrava}" deveria travar o veredito de "${superficie.caminho}" ` +
          `(${superficie.veredito}) com \`expect(chavesDeDuracao(…)).toEqual([])\` — e não tem ` +
          `nenhum. Se a superfície passou a TER duração, mova-a para COM_DURACAO e trave a ` +
          `identidade das chaves; se não, devolva o veredito.`,
      ).toBeGreaterThan(0)

      expect(
        uso.naoVazios,
        `"${superficie.testeQueTrava}" tem o veredito \`toEqual([])\` mas NENHUMA companheira ` +
          `positiva sobre o mesmo detector — asserção negativa é satisfeita pelo vazio ` +
          `(rules/tests.md § padrão 1). Acrescente o caso em que \`chavesDeDuracao\` devolve ` +
          `não-vazio, na mesma execução.`,
      ).toBeGreaterThan(0)
    }
  })

  it('os 5 vereditos "sem duração" da §1.2 estão todos com dono', () => {
    // 4 são call sites; o 5º (drill de projeto) é uma família de colunas dentro do
    // MetricDrillModal e por isso não aparece na varredura — está aqui, nominalmente.
    const vereditos = [...SEM_DURACAO, VEREDITO_SEM_CALL_SITE].map((s) => s.caminho).sort()
    expect(vereditos).toEqual([
      'features/dashboards/shared/utils/projetoDrillColumns.ts',
      'features/movimentacao-diaria/index.tsx',
      'features/service-categories/index.tsx',
      'features/sincronizador/components/ManutencaoRegistros.tsx',
      'features/teams/index.tsx',
    ])
  })
})
