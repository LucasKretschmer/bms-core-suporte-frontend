/**
 * 121/A2 — colunas do relatório de exceções: ordenação restrita à whitelist do
 * backend (§5.2) e nenhuma coluna de categoria do HubSpot (AP-SECURITY-001).
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  BILLING_EXCEPTIONS_SORT_WHITELIST,
  buildBillingExceptionsColumns,
} from './billingExceptionsColumns'
import type { BillingExceptionItemDto } from '../../shared/types/reports'

const row: BillingExceptionItemDto = {
  ticketId: 1,
  hubspotTicketId: '70001',
  assunto: 'Assunto',
  clientId: 1,
  clienteNome: 'Acme',
  equipe: 'Suporte',
  ownerNome: 'Ana',
  status: 'Fechado',
  statusNome: 'Fechado',
  statusCategoria: 'fechado',
  ultimaAtividadeEm: null,
  segundosPlano: 0,
  segundosFaturado: 0,
  segundosAnalise: 0,
  segundosTotais: 0,
  hubspotUrl: 'https://app.hubspot.com/ticket/70001',
}

describe('buildBillingExceptionsColumns', () => {
  it('a whitelist é exatamente a de §5.2 (identidade, não cardinalidade)', () => {
    expect(new Set(BILLING_EXCEPTIONS_SORT_WHITELIST)).toEqual(
      new Set([
        'hubspotticketid',
        'cliente',
        'equipe',
        'owner',
        'status',
        'ultimaatividade',
        'segundos',
      ]),
    )
  })

  it('todo sortKey declarado está na whitelist do backend', () => {
    for (const col of buildBillingExceptionsColumns('anomalia')) {
      if (col.sortKey) {
        expect(BILLING_EXCEPTIONS_SORT_WHITELIST).toContain(
          col.sortKey as (typeof BILLING_EXCEPTIONS_SORT_WHITELIST)[number],
        )
      }
    }
  })

  it('coluna sem suporte de ordenação no backend NÃO é sortável (a seta mentiria)', () => {
    const assunto = buildBillingExceptionsColumns('anomalia').find((c) => c.key === 'assunto')!
    expect(assunto.sortable).toBeUndefined()
    expect(assunto.sortKey).toBeUndefined()
  })

  it('nenhuma coluna expõe a categoria do HubSpot', () => {
    const headers = buildBillingExceptionsColumns('anomalia').map((c) => c.header)
    expect(headers.some((h) => /categoria/i.test(h))).toBe(false)
  })

  it('link do HubSpot abre em nova aba com rel="noopener noreferrer"', () => {
    const ticket = buildBillingExceptionsColumns('anomalia').find((c) => c.key === 'ticket')!
    render(<>{ticket.accessor(row)}</>)

    const link = screen.getByRole('link', { name: /70001/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  /**
   * 121/F7 — o CONJUNTO de colunas é o mesmo nas duas seções (é o desenho), mas o
   * cabeçalho de horas afirma o destino delas, e o destino é justamente o que separa as
   * duas. Literais escritos à mão: comparar com `TEXTO_COLUNA_HORAS` seria tautologia.
   */
  it('o conjunto de colunas é idêntico nas duas seções, exceto a copy das horas', () => {
    const anomalia = buildBillingExceptionsColumns('anomalia')
    const postergado = buildBillingExceptionsColumns('postergado')

    expect(postergado.map((c) => c.key)).toEqual(anomalia.map((c) => c.key))
    expect(postergado.map((c) => c.sortKey)).toEqual(anomalia.map((c) => c.sortKey))

    const horasAnomalia = anomalia.find((c) => c.key === 'segundos')!
    const horasPostergado = postergado.find((c) => c.key === 'segundos')!
    expect(horasAnomalia.header).toBe('Horas presas')
    expect(horasPostergado.header).toBe('Horas do chamado')
  })

  it('a seção informativa não herda o tom de alerta em NENHUM texto da coluna', () => {
    const horas = buildBillingExceptionsColumns('postergado').find(
      (c) => c.key === 'segundos',
    )!

    expect(horas.header).not.toMatch(/presa/i)
    expect(horas.headerInfo).not.toMatch(/presa/i)
    expect(horas.headerInfo).not.toMatch(/fora de qualquer fatura/i)
    // Companheira POSITIVA: a explicação existe e diz o destino real das horas — sem
    // isto, "não é alarmista" passaria com `headerInfo` vazio.
    expect(horas.headerInfo).toContain(
      'Entram na fatura da competência em que o chamado for concluído',
    )
    // …e nenhum prazo é afirmado (AP-FRONTEND-022): por D1 pode ser dali a meses.
    expect(horas.headerInfo).not.toMatch(/próxim|mensal|em até|30 dias/i)
  })

  it('a seção acionável MANTÉM o tom de alerta — é a informação dela (decisão D14)', () => {
    const horas = buildBillingExceptionsColumns('anomalia').find(
      (c) => c.key === 'segundos',
    )!

    expect(horas.header).toBe('Horas presas')
    expect(horas.headerInfo).toContain('fica fora de qualquer fatura')
  })

  it('"Última atividade" nula rende "—", nunca uma data fabricada', () => {
    const col = buildBillingExceptionsColumns('anomalia').find((c) => c.key === 'ultimaAtividade')!
    expect(col.accessor(row)).toBe('—')
    expect(col.accessor({ ...row, ultimaAtividadeEm: '2026-07-10T14:00:00Z' })).toBe(
      // 14:00Z → 11:00 em America/Sao_Paulo (formato do Intl pt-BR, com vírgula).
      '10/07/2026, 11:00',
    )
  })
})
