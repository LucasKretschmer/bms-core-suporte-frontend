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
    categoria: null,
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

describe('buildAppointmentsColumns — coluna Categoria (107)', () => {
  it('existe uma coluna "Categoria"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'categoria')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Categoria')
  })

  it('renderiza o valor da categoria quando presente', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'categoria')!
    const { container } = render(
      <>{col.accessor(makeItem({ categoria: 'Problema - Invoicy' }))}</>,
    )
    expect(container.textContent).toBe('Problema - Invoicy')
  })

  it('renderiza "—" quando a categoria é null/ausente', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'categoria')!
    const { container } = render(<>{col.accessor(makeItem({ categoria: null }))}</>)
    expect(container.textContent).toBe('—')
  })
})

describe('buildAppointmentsColumns — destaque tomato do Status (107)', () => {
  const INVOICY = 'Problema - Invoicy'

  it('pinta o badge de Status de tomato quando categoria === "Problema - Invoicy"', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const label = 'Em atendimento (Relacionamento BR)'
    const { getByLabelText } = render(
      <>{statusCol.accessor(makeItem({ status: label, categoria: INVOICY }))}</>,
    )
    const badge = getByLabelText(label)
    expect(badge.style.color).toBe('tomato')
  })

  it('NÃO pinta de tomato quando a categoria é outra', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const label = 'Concluído'
    const { getByLabelText } = render(
      <>{statusCol.accessor(makeItem({ status: label, categoria: 'Dúvida' }))}</>,
    )
    const badge = getByLabelText(label)
    expect(badge.style.color).toBe('')
  })

  it('o destaque tomato fica só no Status — a coluna Categoria não recebe cor tomato', () => {
    const cols = buildAppointmentsColumns()
    const categoriaCol = cols.find((c) => c.key === 'categoria')!
    const { container } = render(
      <>{categoriaCol.accessor(makeItem({ categoria: INVOICY }))}</>,
    )
    // A célula de categoria é texto puro, sem estilo inline de cor tomato.
    expect(container.innerHTML).not.toContain('tomato')
  })
})

describe('buildAppointmentsColumns — ordenação (052)', () => {
  it('todas as colunas são ordenáveis, exceto Categoria (sem sortBy no backend — 107)', () => {
    const cols = buildAppointmentsColumns()
    const sortable = cols.filter((c) => c.key !== 'categoria')
    expect(sortable.every((c) => c.sortable === true)).toBe(true)
    // Categoria é informativa: não ordenável (não está na whitelist de sortBy).
    const categoria = cols.find((c) => c.key === 'categoria')!
    expect(categoria.sortable).toBe(false)
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
