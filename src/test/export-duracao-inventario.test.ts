/**
 * 134/§9.4 · U12 — **INVENTÁRIO GLOBAL** das colunas de duração do export CSV/XLSX.
 *
 * Um lugar só, e é aqui, que afirma o mapa `superfície → conjunto literal de chaves de
 * duração`. Cada superfície já tem o seu assert de identidade no teste da própria tela; este
 * arquivo existe por dois motivos que nenhum deles cobre:
 *
 *  (a) **travar a identidade do inventário INTEIRO**, para que uma superfície nova não nasça
 *      fora dele — "menos parâmetros nunca é erro para o runner" (`AP-QA-019`);
 *  (b) **obrigar quem criar um export novo a passar por aqui**, escrevendo o veredito da
 *      superfície nova ao lado das outras.
 *
 * 🔴 **Identidade, nunca cardinalidade.** A asserção é sobre os NOMES por arquivo. Contagem
 * passa quando uma chave entra e outra sai — foi exatamente o que aconteceu com o número
 * "27" da §9.4, escrito quando `plan-consumption` tinha 6 colunas de duração e hoje tem 8.
 *
 * 🔴 **Total MEDIDO em 2026-09-09 pela U12: 29 chaves em 12 superfícies.** Derivado do código
 * (não herdado da spec, que dizia 27): 8+1+2+1+4+2+4+2+1+2+1+1. O número no teste é
 * conferência redundante — quem reprova de verdade é o mapa nominal.
 *
 * **Duas camadas, e a reconciliação entre elas é parte do teste:**
 *
 *  1. **Runtime** — importa os arrays/funções que a produção EXPORTA e deriva as chaves com
 *     `chavesDeDuracao` (o mesmo filtro `c.type === 'duration'` que o `exportTable` usa).
 *     Prova o VALOR real, não o texto do arquivo.
 *  2. **Fonte (AST)** — varre `src/` inteiro e deriva o mesmo mapa da declaração. Cobre as
 *     três superfícies cujo array é **module-private** (`ClientTicketsPanel`,
 *     `SupportPlanHealthSection`, `OnboardingTicketSection`) e, principalmente, **descobre
 *     superfície nova sem que ninguém precise lembrar de listá-la**.
 *
 * Nenhuma das duas basta sozinha: a 1ª só enxerga o que é exportado, a 2ª só enxerga texto.
 * Onde as duas alcançam o mesmo arquivo, o teste exige que **concordem** — duas fontes de
 * verdade sobre o mesmo conjunto, mantidas à mão, divergem; a única questão é quando.
 *
 * O detector da camada 2 tem **controle positivo e negativo com fontes fabricadas** (último
 * `describe`): sem eles, um detector quebrado devolveria `{}` e as asserções de identidade
 * ficariam satisfeitas pelo vazio (`rules/tests.md` § padrão 1).
 */

import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, URL as UrlDoNode } from 'node:url'
import { describe, expect, it } from 'vitest'

import { chavesDeDuracao } from './duracaoExport'
import { mapearChavesDeDuracaoNaFonte, type ResultadoDaVarredura } from './varreduraDeDuracao'

import { PLAN_CONSUMPTION_EXPORT_COLUMNS } from '../features/reports/plan-consumption/index'
import { CLIENT_REPORT_EXPORT_COLUMNS } from '../features/reports/client-report/utils/clientReportExportRows'
import { EXPORT_COLUMNS as COLUNAS_APONTAMENTOS_POR_TICKET } from '../features/reports/appointments/index'
import { EXPORT_COLUMNS as COLUNAS_APONTAMENTOS_POR_PROJETO } from '../features/reports/project-appointments/index'
import { PRODUCTIVITY_EXPORT_COLUMNS } from '../features/reports/productivity/exportRow'
import { LOGS_EXPORT_COLUMNS } from '../features/sincronizador/utils/logExportRow'
import { buildDrillExportColumns } from '../features/dashboards/shared/components/MetricDrillModal'
import {
  TICKET_DRILL_METRICS,
  ticketDrillColumns,
} from '../features/dashboards/shared/utils/ticketDrillColumns'
import { clienteDrillColumns } from '../features/dashboards/shared/utils/clienteDrillColumns'
import { apontamentoDrillColumns } from '../features/dashboards/shared/utils/apontamentoDrillColumns'

/**
 * Raiz de `src/`, ancorada no PRÓPRIO arquivo — nunca em `process.cwd()`, que muda conforme
 * de onde o runner é chamado. O `URL` do **Node** é obrigatório: sob jsdom o `URL` global é o
 * do DOM e resolve contra a base do documento, e `fileURLToPath` recusa o resultado.
 */
const RAIZ_SRC = fileURLToPath(new UrlDoNode('..', import.meta.url))

// ── O inventário, escrito à mão, superfície por superfície ───────────────────

/**
 * `caminho relativo a src/` → chaves de duração, na ORDEM DE DECLARAÇÃO.
 * Cada linha é um veredito nominal com a superfície da análise §1.1 ao lado.
 * Superfície nova entra AQUI, no mesmo commit em que nasce.
 */
const INVENTARIO: Record<string, string[]> = {
  // S1 · Consumo de Planos — 8 (as 6 da 134 + `creditoHoras`/`qtdePlanoEfetivoHoras` da 132/F4).
  // `percentualPlano` (percentual) e `qtdeTickets` (contagem, 135/G1) NÃO entram.
  'features/reports/plan-consumption/index.tsx': [
    'qtdePlanoHoras',
    'creditoHoras',
    'qtdePlanoEfetivoHoras',
    'horasUsadas',
    'horasRestantes',
    'horasAdicionais',
    'horasFaturaveis',
    'horasAnalise',
  ],
  // S2 · Relatório do Cliente — 1 de 14 colunas.
  'features/reports/client-report/utils/clientReportExportRows.ts': ['tempo'],
  // S3 · Apontamentos por Ticket — 2. `apontamentos`/`apontamentosTotal` são CONTAGEM.
  'features/reports/appointments/index.tsx': ['tempo', 'tempoTotal'],
  // S4 · Apontamentos por Projeto — 1. `dataApontamento` é INSTANTE.
  'features/reports/project-appointments/index.tsx': ['tempo'],
  // S5 · Painel de tickets do cliente — 4 (o tempo do período + os 3 baldes de fatura).
  'features/client-tickets/components/ClientTicketsPanel.tsx': [
    'tempo',
    'baldePlano',
    'baldeFaturado',
    'baldeAnalise',
  ],
  // S6 · Dashboard · Saúde dos planos — 2 (origem em HORAS decimais).
  'features/dashboards/support/components/SupportPlanHealthSection.tsx': [
    'horasPlano',
    'horasUsadas',
  ],
  // S7 · Drill · família ticket — 4. `frSla`/`csat`/datas ficam fora.
  'features/dashboards/shared/utils/ticketDrillColumns.ts': [
    'frHoras',
    'frHorasUteis',
    'resHoras',
    'resHorasUteis',
  ],
  // S8 · Drill · família cliente — 2. `percentualConsumo` fica fora.
  'features/dashboards/shared/utils/clienteDrillColumns.ts': [
    'horasContratadas',
    'horasConsumidas',
  ],
  // S9 · Drill · família apontamento — 1.
  'features/dashboards/shared/utils/apontamentoDrillColumns.ts': ['totalSegundos'],
  // S10 · Produtividade por Analista — 2. `nAtendimentos`/`mediaPausas` ficam fora.
  'features/reports/productivity/exportRow.ts': ['totalSegundos', 'ahtSegundos'],
  // S11 · Dashboard Onboarding · tickets — 1. `atendimentos` é CONTAGEM.
  'features/dashboards/onboarding/components/OnboardingTicketSection.tsx': ['horas'],
  // S12 · Sincronizador · logs — 1, e a ORIGEM está em MILISSEGUNDOS.
  'features/sincronizador/utils/logExportRow.ts': ['duracao'],
}

/** Medido pela U12 em 2026-09-09 — conferência redundante do mapa acima. */
const TOTAL_MEDIDO_DE_CHAVES = 29
const TOTAL_MEDIDO_DE_SUPERFICIES = 12

/**
 * Único arquivo que declara `type: 'duration'` SEM `key` literal, e o motivo:
 * `buildDrillExportColumns` **projeta** a `ColumnDef` do drill para `ExportColumn`
 * (`...(c.durationSeconds ? { type: 'duration' } : {})`). Não é declaração de superfície —
 * as chaves do drill estão nos três `*DrillColumns.ts`, que o mapa acima já nomeia.
 */
const PROJECAO_SEM_CHAVE_LITERAL = ['features/dashboards/shared/components/MetricDrillModal.tsx']

/** Chaves que convivem com as de duração e NÃO podem virar duração. Exclusão nominal. */
const NUNCA_SAO_DURACAO = [
  'qtdeTickets', // 135/G1 — contagem de chamados; como duração, 12 sairia "00:00:12"
  'percentualPlano', // percentual
  'percentualConsumo', // percentual
  'apontamentos', // contagem
  'apontamentosTotal', // contagem
  'atendimentos', // contagem
  'nAtendimentos', // contagem
  'mediaPausas', // média de contagem
  'frSla', // indicador de SLA
  'dataApontamento', // instante
  'concluidoEm', // instante
  'iniciadoEm', // instante
]

// ── Camada 1 · runtime (o que a produção EXPORTA) ────────────────────────────

const RUNTIME: Record<string, string[]> = {
  'features/reports/plan-consumption/index.tsx': chavesDeDuracao(PLAN_CONSUMPTION_EXPORT_COLUMNS),
  'features/reports/client-report/utils/clientReportExportRows.ts':
    chavesDeDuracao(CLIENT_REPORT_EXPORT_COLUMNS),
  'features/reports/appointments/index.tsx': chavesDeDuracao(COLUNAS_APONTAMENTOS_POR_TICKET),
  'features/reports/project-appointments/index.tsx': chavesDeDuracao(
    COLUNAS_APONTAMENTOS_POR_PROJETO,
  ),
  'features/reports/productivity/exportRow.ts': chavesDeDuracao(PRODUCTIVITY_EXPORT_COLUMNS),
  'features/sincronizador/utils/logExportRow.ts': chavesDeDuracao(LOGS_EXPORT_COLUMNS),
  // Drill: a projeção REAL do modal sobre a união DERIVADA de todas as métricas da família.
  'features/dashboards/shared/utils/ticketDrillColumns.ts': [
    ...new Set(
      TICKET_DRILL_METRICS.flatMap((m) =>
        chavesDeDuracao(buildDrillExportColumns(ticketDrillColumns(m))),
      ),
    ),
  ],
  'features/dashboards/shared/utils/clienteDrillColumns.ts': chavesDeDuracao(
    buildDrillExportColumns(clienteDrillColumns()),
  ),
  'features/dashboards/shared/utils/apontamentoDrillColumns.ts': chavesDeDuracao(
    buildDrillExportColumns(apontamentoDrillColumns()),
  ),
}

/**
 * As três superfícies cujo array é module-private — o inventário as alcança só pela camada 2.
 * Estão nomeadas aqui para que a diferença entre as duas camadas seja **declarada**, e não
 * um buraco silencioso: cada uma trava a identidade em runtime no teste da própria tela.
 */
const SO_PELA_FONTE: Record<string, string> = {
  'features/client-tickets/components/ClientTicketsPanel.tsx':
    'ClientTicketsPanel.competencia.test.tsx — identidade sobre as colunas que o componente passou ao export',
  'features/dashboards/support/components/SupportPlanHealthSection.tsx':
    'SupportPlanHealthSection.test.tsx e SupportPlanHealthSection.wire.test.tsx',
  'features/dashboards/onboarding/components/OnboardingTicketSection.tsx':
    'OnboardingTicketSection.test.tsx — identidade no CSV e no XLSX',
}

function ordenar(mapa: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.keys(mapa)
      .sort()
      .map((k) => [k, [...mapa[k]].sort()]),
  )
}

// ── Os testes ────────────────────────────────────────────────────────────────

describe('134/§9.4 · inventário global das colunas de duração', () => {
  const fonte = mapearChavesDeDuracaoNaFonte(RAIZ_SRC)

  it('a varredura da fonte é VIVA (controle de liveness antes de qualquer subtração)', () => {
    // Sem isto, uma raiz errada devolveria `{}` e as asserções seguintes seriam satisfeitas
    // pelo vazio (`rules/tests.md` § padrão 1).
    expect(fonte.arquivosVarridos).toBeGreaterThan(200)
    expect(Object.keys(fonte.porArquivo).length).toBe(TOTAL_MEDIDO_DE_SUPERFICIES)
  })

  it('🔴 IDENTIDADE do mapa superfície → chaves de duração (derivado da FONTE)', () => {
    expect(ordenar(fonte.porArquivo)).toEqual(ordenar(INVENTARIO))
  })

  it('🔴 IDENTIDADE do mapa, derivado dos VALORES que a produção exporta', () => {
    const esperadoDoRuntime = Object.fromEntries(
      Object.entries(INVENTARIO).filter(([arquivo]) => !(arquivo in SO_PELA_FONTE)),
    )
    expect(ordenar(RUNTIME)).toEqual(ordenar(esperadoDoRuntime))
  })

  it('as duas camadas CONCORDAM em cada arquivo que ambas alcançam', () => {
    const alcancadosPelasDuas = Object.keys(RUNTIME)
    // Positiva primeiro: interseção vazia faria o laço abaixo não afirmar nada.
    expect(alcancadosPelasDuas.length).toBe(9)
    for (const arquivo of alcancadosPelasDuas) {
      expect([...RUNTIME[arquivo]].sort(), `divergência em ${arquivo}`).toEqual(
        [...(fonte.porArquivo[arquivo] ?? [])].sort(),
      )
    }
  })

  it('as 3 superfícies module-private estão DECLARADAS, com o teste que trava cada uma', () => {
    const soPelaFonte = Object.keys(INVENTARIO).filter((arquivo) => !(arquivo in RUNTIME))
    expect(soPelaFonte.sort()).toEqual(Object.keys(SO_PELA_FONTE).sort())
    for (const arquivo of soPelaFonte) {
      expect(SO_PELA_FONTE[arquivo].length, arquivo).toBeGreaterThan(0)
    }
  })

  it('total MEDIDO: 29 chaves em 12 superfícies (conferência do mapa nominal)', () => {
    expect(Object.values(fonte.porArquivo).flat().length).toBe(TOTAL_MEDIDO_DE_CHAVES)
    expect(Object.keys(fonte.porArquivo).length).toBe(TOTAL_MEDIDO_DE_SUPERFICIES)
  })

  it('a projeção do drill é o ÚNICO objeto de duração sem `key` literal (allowlist nominal)', () => {
    expect(fonte.semChaveLiteral).toEqual(PROJECAO_SEM_CHAVE_LITERAL)
  })

  it('contagem, percentual e instante NUNCA entram no conjunto de duração', () => {
    const todas = new Set(Object.values(fonte.porArquivo).flat())
    // Positiva primeiro (a negativa abaixo seria satisfeita pelo vazio).
    expect(todas.has('horasUsadas')).toBe(true)
    for (const chave of NUNCA_SAO_DURACAO) {
      expect(todas.has(chave), `"${chave}" não é duração`).toBe(false)
    }
  })
})

// ── Poder de detecção do detector (fontes FABRICADAS, árvore intocada) ───────

describe('o detector da fonte discrimina — controles positivo e negativo', () => {
  function varrerFabricado(arquivos: Record<string, string>): ResultadoDaVarredura {
    const raiz = mkdtempSync(join(tmpdir(), 'u12-varredura-'))
    for (const [nome, conteudo] of Object.entries(arquivos)) {
      const destino = join(raiz, nome)
      mkdirSync(dirname(destino), { recursive: true })
      writeFileSync(destino, conteudo, 'utf8')
    }
    return mapearChavesDeDuracaoNaFonte(raiz)
  }

  it('acha `type: duration` e `durationSeconds`, cada um com a sua chave', () => {
    const r = varrerFabricado({
      'tela.ts': [
        'const c = [',
        "  { header: 'A', key: 'aa', type: 'duration' },",
        "  { header: 'B', key: 'bb' },",
        ']',
      ].join('\n'),
      'drill.ts': "const c = [{ key: 'cc', header: 'C', durationSeconds: (r) => r.x }]",
    })
    expect(r.porArquivo).toEqual({ 'tela.ts': ['aa'], 'drill.ts': ['cc'] })
  })

  it('🔴 tirar o `type` de UMA coluna some com a chave — e o arquivo continua nomeado', () => {
    const comUma = varrerFabricado({
      'tela.ts': "const c = [{ key: 'aa', type: 'duration' }, { key: 'bb' }]",
    })
    const comDuas = varrerFabricado({
      'tela.ts': "const c = [{ key: 'aa', type: 'duration' }, { key: 'bb', type: 'duration' }]",
    })
    expect(comUma.porArquivo['tela.ts']).toEqual(['aa'])
    expect(comDuas.porArquivo['tela.ts']).toEqual(['aa', 'bb'])
  })

  it('NÃO conta menção em comentário, docstring nem string literal', () => {
    const r = varrerFabricado({
      'prosa.ts': [
        "/** { header: 'X', key: 'xx', type: 'duration' } — só documentação */",
        'const aviso = "{ key: \'yy\', type: \'duration\' }"',
        "// { key: 'zz', type: 'duration' }",
        'export const nada = aviso',
      ].join('\n'),
    })
    expect(r.porArquivo).toEqual({})
    // O arquivo FOI lido — a ausência acima não vem do vazio.
    expect(r.arquivosVarridos).toBe(1)
  })

  it('aceita `as const` e registra duração sem `key` literal em `semChaveLiteral`', () => {
    const r = varrerFabricado({
      'const.ts': "const c = { key: 'kk', type: 'duration' as const }",
      'projecao.ts':
        "const p = cols.map((c) => ({ ...(c.d ? { type: 'duration' as const } : {}) }))",
    })
    expect(r.porArquivo).toEqual({ 'const.ts': ['kk'] })
    expect(r.semChaveLiteral).toEqual(['projecao.ts'])
  })

  it('ignora `*.test.ts(x)` — fixtures fabricam colunas; o motivo está escrito no helper', () => {
    const r = varrerFabricado({
      'algo.test.ts': "const c = [{ key: 'aa', type: 'duration' }]",
      'algo.ts': "const c = [{ key: 'bb', type: 'duration' }]",
    })
    expect(r.porArquivo).toEqual({ 'algo.ts': ['bb'] })
  })
})
