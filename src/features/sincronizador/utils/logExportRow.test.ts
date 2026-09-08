/**
 * 129 — o EXPORT dos logs do sincronizador com a chave AUSENTE no wire.
 *
 * Este arquivo existe porque o export era o único dos quatro lugares de `duracaoMs`
 * (coluna da tabela, rótulo do card de status, tooltip e export) **sem teste nenhum** —
 * e é o pior deles: tela errada o gestor recarrega, planilha errada ele encaminha
 * (AP-FRONTEND-028).
 */

import { describe, expect, it } from 'vitest'
import { formatDuracao, mapLogToExportRow } from './logExportRow'
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

describe('formatDuracao — as DUAS formas de ausente', () => {
  it('discrimina os fixtures: um tem a chave `duracaoMs`, o outro NÃO', () => {
    expect(Object.hasOwn(logCompleto, 'duracaoMs')).toBe(true)
    expect(Object.hasOwn(logSemChaves, 'duracaoMs')).toBe(false)
  })

  it('chave AUSENTE vira "—", nunca "NaNs"', () => {
    expect(formatDuracao(undefined)).toBe('—')
  })

  it('chave NULA vira "—" (irmão que passa nos dois mundos, na mesma execução)', () => {
    expect(formatDuracao(null)).toBe('—')
  })

  it('controle positivo: valor presente continua formatado', () => {
    expect(formatDuracao(125_000)).toBe('2min 5s')
    expect(formatDuracao(45_000)).toBe('45s')
  })
})

describe('mapLogToExportRow — a planilha nunca sai com NaN', () => {
  it('linha de rodada em execução (chaves ausentes) traz "—", não "NaNs"', () => {
    const linha = mapLogToExportRow(logSemChaves)
    expect(linha.duracao).toBe('—')
    expect(String(linha.duracao)).not.toContain('NaN')
    expect(linha.mensagemErro).toBe('—')
  })

  it('controle positivo: linha completa traz a duração formatada', () => {
    const linha = mapLogToExportRow(logCompleto)
    expect(linha.duracao).toBe('2min 5s')
  })
})
