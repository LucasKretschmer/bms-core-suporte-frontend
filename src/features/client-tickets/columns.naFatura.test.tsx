/**
 * 121/§4.4 — coluna "Na fatura" e o rótulo "Tempo no período".
 *
 * Arquivo `.tsx` separado de `columns.test.ts` (que é puro) porque os accessors
 * destas duas colunas rendem JSX.
 *
 * Asserções com literais escritos à mão ("Sim" / "Não" / "—"): expectativa derivada
 * do próprio dado seria tautologia e passaria com qualquer implementação.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildClientTicketsColumns, HEADER_TEMPO_NO_PERIODO } from './columns'
import type { ClientTicketItemDto } from './types/clientTickets'

function ticket(overrides: Partial<ClientTicketItemDto> = {}): ClientTicketItemDto {
  return {
    ticketId: 1,
    hubspotTicketId: '10001',
    assunto: 'Assunto',
    clienteNome: 'Acme',
    equipe: 'Suporte',
    ownerNome: 'Ana',
    status: 'Fechado',
    totalSeconds: 5400,
    apontamentosCount: 2,
    hubspotUrl: null,
    totalSecondsAllTime: 5400,
    apontamentosCountAllTime: 2,
    statusNome: 'Fechado',
    statusCategoria: 'fechado',
    categoriasTimer: [],
    ...overrides,
  }
}

function colunaNaFatura() {
  return buildClientTicketsColumns().find((c) => c.key === 'naFatura')!
}

describe('coluna "Tempo no período" (renomeada de "Tempo do plano")', () => {
  it('o rótulo antigo não existe em nenhuma coluna', () => {
    const headers = buildClientTicketsColumns().map((c) => c.header)
    expect(headers).not.toContain('Tempo do plano')
    expect(headers).toContain('Tempo no período')
    expect(HEADER_TEMPO_NO_PERIODO).toBe('Tempo no período')
  })

  it('o valor continua sendo totalSeconds do período (5400 → "1h 30m")', () => {
    const col = buildClientTicketsColumns().find((c) => c.key === 'tempo')!
    expect(col.accessor(ticket())).toBe('1h 30m')
  })

  it('o tooltip explica que o número inclui TODOS os tipos de faturamento', () => {
    const col = buildClientTicketsColumns().find((c) => c.key === 'tempo')!
    expect(col.headerInfo).toContain('todos os tipos de faturamento')
  })
})

describe('coluna "Na fatura" — três ramos, não dois', () => {
  it('existe, com o rótulo "Na fatura"', () => {
    expect(colunaNaFatura().header).toBe('Na fatura')
  })

  it('NÃO é sortável: "nafatura" não está na whitelist de sortBy de /reports/tickets', () => {
    const col = colunaNaFatura()
    expect(col.sortable).toBeUndefined()
    expect(col.sortKey).toBeUndefined()
  })

  it('entraNaFatura=true → "Sim"', () => {
    render(<>{colunaNaFatura().accessor(ticket({ entraNaFatura: true }))}</>)
    expect(screen.getByText('Sim')).toBeInTheDocument()
    expect(screen.queryByText('Não')).not.toBeInTheDocument()
  })

  it('entraNaFatura=false → "Não"', () => {
    render(<>{colunaNaFatura().accessor(ticket({ entraNaFatura: false }))}</>)
    expect(screen.getByText('Não')).toBeInTheDocument()
    expect(screen.queryByText('Sim')).not.toBeInTheDocument()
  })

  it('campo AUSENTE → "—", nunca "Não" (AP-FRONTEND-021: ausente ≠ vazio)', () => {
    // Estado real entre os deploys: front novo + backend sem FAT-3. Dizer "Não" aqui
    // afirmaria que o chamado está fora da fatura — uma afirmação que o backend não fez.
    render(<>{colunaNaFatura().accessor(ticket())}</>)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Não')).not.toBeInTheDocument()
    expect(screen.queryByText('Sim')).not.toBeInTheDocument()
  })

  it('entraNaFatura=null → "—" também: `null` é a OUTRA forma de ausente (121/F4)', () => {
    // Terceira face de AP-FRONTEND-021, e a pior: com o guard `=== undefined` este caso
    // caía no ramo `false` e a tela escrevia **"Não"** — afirmando que o chamado está
    // fora da fatura quando o backend não afirmou nada. Um `bool?` no DTO basta.
    render(<>{colunaNaFatura().accessor(ticket({ entraNaFatura: null }))}</>)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Não')).not.toBeInTheDocument()
    expect(screen.queryByText('Sim')).not.toBeInTheDocument()
  })

  it('os dois badges usam os tokens medidos de contraste (nunca warning/error-fg)', () => {
    const { container: sim } = render(
      <>{colunaNaFatura().accessor(ticket({ entraNaFatura: true }))}</>,
    )
    expect(sim.querySelector('.text-fatura-sim-fg')).not.toBeNull()
    expect(sim.querySelector('.bg-fatura-sim-bg')).not.toBeNull()

    const { container: nao } = render(
      <>{colunaNaFatura().accessor(ticket({ entraNaFatura: false }))}</>,
    )
    expect(nao.querySelector('.text-fatura-nao-fg')).not.toBeNull()
    expect(nao.querySelector('.bg-fatura-nao-bg')).not.toBeNull()
  })
})
