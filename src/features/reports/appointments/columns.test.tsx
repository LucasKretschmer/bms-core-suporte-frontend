import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { buildAppointmentsColumns } from './columns'
import type { TicketReportItemDto } from '../shared/types/reports'

function makeItem(overrides?: Partial<TicketReportItemDto>): TicketReportItemDto {
  return {
    ticketId: 1,
    hubspotTicketId: '1001',
    assunto: 'Erro no login',
    clienteNome: 'ACME',
    equipe: 'Relacionamento BR',
    ownerNome: 'Ana',
    status: 'Em atendimento (Relacionamento BR)',
    totalSeconds: 3600,
    apontamentosCount: 2,
    hubspotUrl: null,
    ...overrides,
  }
}

describe('buildAppointmentsColumns — coluna Status', () => {
  it('exibe o label de status vindo do backend como texto', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const { container } = render(<>{statusCol.accessor(makeItem())}</>)
    expect(container.textContent).toBe('Em atendimento (Relacionamento BR)')
  })

  it('trunca o label longo e expõe o valor completo via title (tooltip)', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const label = 'Em atendimento (Relacionamento BR)'
    const { getByLabelText } = render(<>{statusCol.accessor(makeItem({ status: label }))}</>)
    const badge = getByLabelText(label)
    expect(badge).toHaveAttribute('title', label)
    expect(badge.className).toContain('truncate')
  })

  it('exibe "—" quando o status é null', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const { container } = render(<>{statusCol.accessor(makeItem({ status: null }))}</>)
    expect(container.textContent).toBe('—')
  })

  it('exibe "—" quando o status é string vazia', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const { container } = render(<>{statusCol.accessor(makeItem({ status: '' }))}</>)
    expect(container.textContent).toBe('—')
  })

  it('mantém a coluna Status com largura de 160px (não estoura o layout)', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    expect(statusCol.width).toBe('160px')
  })
})

describe('buildAppointmentsColumns — ordenação (052)', () => {
  it('todas as colunas são ordenáveis', () => {
    const cols = buildAppointmentsColumns()
    expect(cols.every((c) => c.sortable === true)).toBe(true)
  })

  it('coluna Cliente é ordenável com sortKey "cliente"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'cliente')!
    expect(col.sortable).toBe(true)
    expect(col.sortKey).toBe('cliente')
  })

  it('coluna Equipe é ordenável com sortKey "equipe"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'equipe')!
    expect(col.sortable).toBe(true)
    expect(col.sortKey).toBe('equipe')
  })
})
