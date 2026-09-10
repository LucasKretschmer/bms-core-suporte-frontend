/**
 * 129 — o EXPORT dos logs do sincronizador com a chave AUSENTE no wire.
 * 134 — a coluna `Duração` passa a sair CALCULÁVEL: célula numérica em SEGUNDOS,
 *       formatada pelo núcleo (`[h]:mm:ss` no XLSX, `H:mm:ss` sem módulo 24 no CSV).
 *
 * 🔴 A unidade de origem aqui é **MILISSEGUNDOS** (`LogDto.duracaoMs`, `long?` no
 * backend), e o helper correto é `durationCellFromMillis`. Usar `durationCell` (que
 * espera segundos) produziria um número **plausível e 1000× errado** numa planilha que o
 * gestor encaminha — o pior resultado possível (AP-FRONTEND-028: tela errada o gestor
 * recarrega, planilha errada ele encaminha).
 *
 * Por isso todo valor esperado abaixo é **literal escrito à mão** (nunca
 * `durationCellFromMillis(x)` dos dois lados — expectativa derivada da própria resposta
 * é tautologia, `rules/tests.md` § Prova de detecção).
 */

import { describe, expect, it } from 'vitest'
import { LOGS_EXPORT_COLUMNS, mapLogToExportRow } from './logExportRow'
import { formatDurationCsv } from '../../reports/shared/utils/exportTable'
import { formatDuration } from '../../../utils/formatDuration'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../test/duracaoExport'
import type { LogDto } from '../types/sincronizador'

/** Log completo — todas as chaves presentes. Serve de controle positivo. */
const logCompleto: LogDto = {
  logId: 1,
  tipo: 'tickets',
  status: 'concluido',
  disparo: 'manual',
  iniciadoEm: '2026-09-01T10:00:00Z',
  finalizadoEm: '2026-09-01T10:02:05Z',
  duracaoMs: 125_000,
  ticketsUpserted: 3,
  ticketsIgnorados: 1,
  projetosUpserted: 2,
  projetosIgnorados: 0,
  empresasResolvidas: 4,
  contatosResolvidos: 5,
  empresasCriadas: 0,
  empresasAtualizadas: 0,
  empresasDesativadas: 0,
  mensagemErro: null,
}

/**
 * O wire REAL de uma rodada ainda em execução: `finalizadoEm`, `duracaoMs` e
 * `mensagemErro` são `long?`/`string?` no backend e o serializador **omite a chave**
 * (`DefaultIgnoreCondition = WhenWritingNull`). Não vem `null` — a chave não vem.
 */
const logSemChaves: LogDto = {
  logId: 2,
  tipo: 'tickets',
  status: 'executando',
  disparo: 'automatico',
  iniciadoEm: '2026-09-01T11:00:00Z',
  ticketsUpserted: 0,
  ticketsIgnorados: 0,
  projetosUpserted: 0,
  projetosIgnorados: 0,
  empresasResolvidas: 0,
  contatosResolvidos: 0,
  empresasCriadas: 0,
  empresasAtualizadas: 0,
  empresasDesativadas: 0,
}

/** A OUTRA forma de ausente: a chave vem, com `null` explícito (AP-FRONTEND-028). */
const logDuracaoNula: LogDto = { ...logCompleto, logId: 3, duracaoMs: null }

/** Fábrica: só a duração muda. Mantém o resto do log idêntico ao controle positivo. */
function logCom(duracaoMs: number | null | undefined): LogDto {
  return { ...logCompleto, duracaoMs }
}

// ─────────────────────────────────────────────────────────────────────────────
// A · A forma do arquivo não muda — e a identidade das colunas de duração é
//     DERIVADA da declaração real, nunca mantida à mão (§9.3 da análise).
// ─────────────────────────────────────────────────────────────────────────────

describe('LOGS_EXPORT_COLUMNS — identidade, não cardinalidade', () => {
  it('mantém cabeçalhos, chaves e ordem — a 134 não acrescenta nem remove coluna', () => {
    expect(LOGS_EXPORT_COLUMNS.map((c) => c.header)).toEqual([
      'Status',
      'Disparo',
      'Tipo',
      'Iniciado em',
      'Duração',
      'Tickets / Projetos',
      'Empresas',
      'Erro',
    ])
    expect(LOGS_EXPORT_COLUMNS.map((c) => c.key)).toEqual([
      'status',
      'disparo',
      'tipo',
      'iniciadoEm',
      'duracao',
      'contadores',
      'empresas',
      'mensagemErro',
    ])
  })

  it('exatamente UMA coluna de duração: {duracao}', () => {
    // Identidade literal do conjunto derivado. Fica VERMELHO se alguém tirar o
    // `type: 'duration'` de `duracao`, renomear a chave, ou marcar como duração uma
    // coluna que não é — `iniciadoEm` é um INSTANTE (PRD §2.4), não uma duração.
    expect(new Set(chavesDeDuracao(LOGS_EXPORT_COLUMNS))).toEqual(new Set(['duracao']))
  })

  it('nenhuma coluna de texto foi marcada como duração', () => {
    const naoDuracao = LOGS_EXPORT_COLUMNS.filter((c) => c.type !== 'duration').map((c) => c.key)
    expect(naoDuracao).toEqual([
      'status',
      'disparo',
      'tipo',
      'iniciadoEm',
      'contadores',
      'empresas',
      'mensagemErro',
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// B · A UNIDADE. Origem = milissegundos; célula = segundos.
// ─────────────────────────────────────────────────────────────────────────────

describe('mapLogToExportRow — `duracaoMs` está em MILISSEGUNDOS', () => {
  it.each([
    // ms de origem | segundos esperados na célula (literal à mão) | o que representa
    [45_000, 45, '45 s'],
    [125_000, 125, '2 min 5 s'],
    [9_840_000, 9840, '2 h 44 min'],
    [95_400_000, 95_400, '26 h 30 min — passa de 24 h'],
    [86_400_000, 86_400, 'exatamente 24 h'],
  ])('%i ms vira %i s (%s)', (ms, segundos) => {
    // VERMELHO se o call site usar `durationCell` (esqueceu o /1000): 45_000 ms viraria
    // 45000 s = 12h30 na planilha — número plausível e mil vezes errado.
    expect(mapLogToExportRow(logCom(ms as number)).duracao).toBe(segundos)
  })

  it('arredonda ao segundo (Math.round), não trunca', () => {
    expect(mapLogToExportRow(logCom(499)).duracao).toBe(0)
    expect(mapLogToExportRow(logCom(500)).duracao).toBe(1)
    expect(mapLogToExportRow(logCom(1_500)).duracao).toBe(2)
  })

  it('a célula é NÚMERO, nunca o texto pré-formatado "2min 5s"', () => {
    const linha = mapLogToExportRow(logCompleto)
    expect(typeof linha.duracao).toBe('number')
    expect(linha.duracao).not.toBe('2min 5s')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// C · O que o usuário vê na planilha — composição real com o núcleo, literais à mão.
// ─────────────────────────────────────────────────────────────────────────────

describe('a célula, formatada pelo núcleo, é a hora certa', () => {
  it.each([
    [9_840_000, '02:44:00'],
    [95_400_000, '26:30:00'], // sem módulo 24 — VERMELHO se o núcleo aplicar `% 24` ('02:30:00')
    [45_000, '00:00:45'],
    [0, '00:00:00'],
  ])('%i ms vira "%s" no CSV', (ms, esperado) => {
    const celula = mapLogToExportRow(logCom(ms as number)).duracao
    expect(typeof celula).toBe('number')
    expect(formatDurationCsv(celula as number)).toBe(esperado)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// D · Ausência ⇒ célula VAZIA (null). E o `0` é valor, não ausência.
// ─────────────────────────────────────────────────────────────────────────────

describe('ausência de duração — as DUAS formas, com companheira positiva', () => {
  it('discrimina os fixtures: um tem a chave `duracaoMs`, o outro NÃO', () => {
    expect(Object.hasOwn(logCompleto, 'duracaoMs')).toBe(true)
    expect(Object.hasOwn(logSemChaves, 'duracaoMs')).toBe(false)
    expect(Object.hasOwn(logDuracaoNula, 'duracaoMs')).toBe(true)
    expect(logDuracaoNula.duracaoMs).toBeNull()
  })

  it('chave AUSENTE no wire vira célula vazia (null), nunca 0, "—" ou NaN', () => {
    const linha = mapLogToExportRow(logSemChaves)
    expect(linha.duracao).toBeNull()
  })

  it('chave presente com `null` EXPLÍCITO vira célula vazia (null)', () => {
    // É ESTE o caso que discrimina `== null` de `=== undefined` (AP-FRONTEND-028).
    // Com o guard errado, `null` atravessaria e a planilha afirmaria 0 — uma mentira.
    expect(mapLogToExportRow(logDuracaoNula).duracao).toBeNull()
  })

  it('`0 ms` é VALOR, não ausência: célula 0 (companheira positiva, mesma execução)', () => {
    // VERMELHO com a sobre-correção `if (!v) return null`.
    expect(mapLogToExportRow(logCom(0)).duracao).toBe(0)
    expect(mapLogToExportRow(logCom(0)).duracao).not.toBeNull()
  })

  it('NaN é desconhecido, não zero: célula vazia (nunca "#VALOR!" na planilha)', () => {
    expect(mapLogToExportRow(logCom(Number.NaN)).duracao).toBeNull()
  })

  it('duração negativa (relógio torto) é clampada em 0 — o Excel não exibe tempo negativo', () => {
    expect(mapLogToExportRow(logCom(-5_000)).duracao).toBe(0)
  })

  it('invariante derivado: toda chave de duração devolve number | null', () => {
    assertCelulasDeDuracaoSaoNumericas(LOGS_EXPORT_COLUMNS, [
      mapLogToExportRow(logCompleto),
      mapLogToExportRow(logSemChaves),
      mapLogToExportRow(logDuracaoNula),
      mapLogToExportRow(logCom(0)),
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// E · Não-regressão: nenhuma outra célula da linha muda.
// ─────────────────────────────────────────────────────────────────────────────

describe('mapLogToExportRow — as colunas de TEXTO continuam idênticas', () => {
  it('linha completa (tickets): só a duração mudou de forma', () => {
    const linha = mapLogToExportRow(logCompleto)
    expect(linha).toMatchObject({
      status: 'Concluído',
      disparo: 'Manual',
      tipo: 'Tickets',
      contadores: '3↑ 1↷ / 2↑ 0↷',
      empresas: '4 / 5',
      mensagemErro: '—',
    })
    // `iniciadoEm` é um INSTANTE e depende do fuso da máquina — trava-se a FORMA.
    expect(linha.iniciadoEm).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)
  })

  it('rodada em execução: o "—" continua nas colunas de TEXTO', () => {
    const linha = mapLogToExportRow(logSemChaves)
    expect(linha.mensagemErro).toBe('—')
    expect(linha.status).toBe('Executando')
    expect(linha.disparo).toBe('Automático')
    expect(String(linha.duracao)).not.toContain('NaN')
  })

  it('rodada de empresas: contadores próprios, duração igual (ms para s)', () => {
    const linha = mapLogToExportRow({
      ...logCompleto,
      tipo: 'empresas',
      empresasCriadas: 7,
      empresasAtualizadas: 2,
      empresasDesativadas: 1,
      duracaoMs: 9_840_000,
    })
    expect(linha.tipo).toBe('Empresas')
    expect(linha.contadores).toBe('—')
    expect(linha.empresas).toBe('7+ 2~ 1−')
    expect(linha.duracao).toBe(9840)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F · A TELA NÃO MUDA (invariante da demanda).
// ─────────────────────────────────────────────────────────────────────────────

describe('a tela do sincronizador continua exibindo duração humana', () => {
  it('o rótulo da LogsTable/card (`formatDuration`, em ms) segue igual', () => {
    // VERMELHO se alguém "resolver" a demanda mudando o formatador DA TELA —
    // `DurationLabel` (LogsTable:124 e index.tsx:156) usa esta função, não o export.
    expect(formatDuration(125_000)).toBe('2m 5s')
    expect(formatDuration(45_000)).toBe('45.0s')
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
  })

  /**
   * 134/U12 — o caso de `formatDuracao` saiu junto com a função: depois que a 134 trocou a
   * célula do export por número, ela ficou sem consumidor de produção (a tela usa
   * `formatDuration`, asseverado acima). Testar função morta é travar dívida como contrato.
   * A não-regressão que importa continua aqui: o rótulo DA TELA não mudou.
   */
})
