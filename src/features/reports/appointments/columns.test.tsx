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
    totalSecondsAllTime: 3600,
    apontamentosCountAllTime: 2,
    statusNome: null,
    statusCategoria: null,
    categoriasTimer: [],
    ...overrides,
  }
}

describe('buildAppointmentsColumns — coluna Status (texto sempre presente)', () => {
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

describe('buildAppointmentsColumns — coluna Status: cor por statusCategoria (MELH-01/119)', () => {
  it.each([
    ['aberto', 'var(--color-status-aberto-fg)'],
    ['emandamento', 'var(--color-info-fg)'],
    ['fechado', 'var(--color-success-fg)'],
    ['cancelado', 'var(--color-status-cancelado-fg)'],
  ] as const)('categoria "%s" pinta o badge com a cor correspondente', (categoria, expectedColor) => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const label = 'Qualquer label'
    const { getByLabelText } = render(
      <>{statusCol.accessor(makeItem({ status: label, statusCategoria: categoria }))}</>,
    )
    const badge = getByLabelText(label)
    expect(badge.style.color).toBe(expectedColor)
    // o texto do status permanece sempre visível — nunca depende só da cor
    expect(badge.textContent).toBe(label)
  })

  it('categoria null cai no tom neutro (fallback, nunca quebra)', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const label = 'Stage antigo'
    const { getByLabelText } = render(
      <>{statusCol.accessor(makeItem({ status: label, statusCategoria: null }))}</>,
    )
    const badge = getByLabelText(label)
    expect(badge.style.color).toBe('var(--color-badge-neutro-fg)')
  })
})

describe('buildAppointmentsColumns — coluna Categoria (HubSpot) (renomeada, D6/119)', () => {
  it('existe uma coluna "Categoria (HubSpot)" com key "categoria"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'categoria')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Categoria (HubSpot)')
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

describe('buildAppointmentsColumns — coluna Categoria do atendimento (MELH-02/119)', () => {
  it('existe uma coluna "Categoria do atendimento" com key "categoriasTimer"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'categoriasTimer')
    expect(col).toBeDefined()
    expect(col!.header).toBe('Categoria do atendimento')
    expect(col!.sortable).toBe(false)
  })

  it('categoriasTimer vazio renderiza "—"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'categoriasTimer')!
    const { container } = render(<>{col.accessor(makeItem({ categoriasTimer: [] }))}</>)
    expect(container.textContent).toBe('—')
  })

  it('1–2 categorias: todas visíveis, sem chip "+N"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'categoriasTimer')!
    const { container, getByText } = render(
      <>{col.accessor(makeItem({ categoriasTimer: ['Consultoria', 'Plantão'] }))}</>,
    )
    expect(getByText('Consultoria')).toBeInTheDocument()
    expect(getByText('Plantão')).toBeInTheDocument()
    expect(container.textContent).not.toContain('+')
  })

  it('3+ categorias: 2 visíveis + chip "+N" com title listando as ocultas', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'categoriasTimer')!
    const { getByText, container } = render(
      <>{col.accessor(makeItem({ categoriasTimer: ['Consultoria', 'Plantão', 'Acesso Remoto'] }))}</>,
    )
    expect(getByText('Consultoria')).toBeInTheDocument()
    expect(getByText('Plantão')).toBeInTheDocument()
    const overflowChip = getByText('+1')
    expect(overflowChip).toHaveAttribute('title', 'Acesso Remoto')
    // container inteiro tem title com a lista completa
    expect(container.firstChild).toHaveAttribute(
      'title',
      'Consultoria, Plantão, Acesso Remoto',
    )
  })
})

describe('buildAppointmentsColumns — destaque tomato do Status (107/119)', () => {
  const INVOICY = 'Problema - Invoicy'

  it('pinta o badge de Status com a cor Invoicy quando categoria === "Problema - Invoicy"', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const label = 'Em atendimento (Relacionamento BR)'
    const { getByLabelText } = render(
      <>{statusCol.accessor(makeItem({ status: label, categoria: INVOICY }))}</>,
    )
    const badge = getByLabelText(label)
    expect(badge.style.color).toBe('rgb(179, 27, 0)')
  })

  it('o override Invoicy tem prioridade mesmo com statusCategoria "cancelado"', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const label = 'Cancelado'
    const { getByLabelText } = render(
      <>
        {statusCol.accessor(
          makeItem({ status: label, categoria: INVOICY, statusCategoria: 'cancelado' }),
        )}
      </>,
    )
    const badge = getByLabelText(label)
    expect(badge.style.color).toBe('rgb(179, 27, 0)')
  })

  it('NÃO usa a cor Invoicy quando a categoria é outra', () => {
    const cols = buildAppointmentsColumns()
    const statusCol = cols.find((c) => c.key === 'status')!
    const label = 'Concluído'
    const { getByLabelText } = render(
      <>{statusCol.accessor(makeItem({ status: label, categoria: 'Dúvida', statusCategoria: 'fechado' }))}</>,
    )
    const badge = getByLabelText(label)
    expect(badge.style.color).toBe('var(--color-success-fg)')
  })

  it('o destaque Invoicy fica só no Status — a coluna Categoria não recebe estilo inline', () => {
    const cols = buildAppointmentsColumns()
    const categoriaCol = cols.find((c) => c.key === 'categoria')!
    const { container } = render(
      <>{categoriaCol.accessor(makeItem({ categoria: INVOICY }))}</>,
    )
    expect(container.innerHTML).not.toContain('style=')
  })
})

describe('buildAppointmentsColumns — coluna Tempo/Tempo total (CORR-05/D1/119)', () => {
  it('sem gap (allTime === período): coluna Tempo não exibe indicador', () => {
    const cols = buildAppointmentsColumns()
    const tempoCol = cols.find((c) => c.key === 'tempo')!
    const { container } = render(
      <>{tempoCol.accessor(makeItem({ totalSeconds: 3600, totalSecondsAllTime: 3600 }))}</>,
    )
    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).toBe('1h 0m')
  })

  it('com gap (allTime > período): coluna Tempo exibe indicador com o texto correto', () => {
    const cols = buildAppointmentsColumns()
    const tempoCol = cols.find((c) => c.key === 'tempo')!
    const { container } = render(
      <>{tempoCol.accessor(makeItem({ totalSeconds: 0, totalSecondsAllTime: 1260 }))}</>,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.textContent).toContain('Há apontamentos fora do período selecionado')
    expect(container.textContent).toContain('0h 21m')
  })

  it('coluna "Tempo total" sempre renderiza formatSeconds(totalSecondsAllTime)', () => {
    const cols = buildAppointmentsColumns()
    const tempoTotalCol = cols.find((c) => c.key === 'tempoTotal')!
    expect(tempoTotalCol.header).toBe('Tempo total')
    expect(tempoTotalCol.sortable).toBe(false)
    const { container } = render(
      <>{tempoTotalCol.accessor(makeItem({ totalSecondsAllTime: 1260 }))}</>,
    )
    expect(container.textContent).toBe('0h 21m')
  })
})

describe('buildAppointmentsColumns — coluna Apontamentos/Apontamentos (total) (CORR-05/D1/119)', () => {
  it('sem gap: coluna Apontamentos não exibe indicador', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'apontamentos')!
    const { container } = render(
      <>{col.accessor(makeItem({ apontamentosCount: 2, apontamentosCountAllTime: 2 }))}</>,
    )
    expect(container.querySelector('svg')).toBeNull()
  })

  it('com gap: coluna Apontamentos exibe indicador', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'apontamentos')!
    const { container } = render(
      <>{col.accessor(makeItem({ apontamentosCount: 0, apontamentosCountAllTime: 2 }))}</>,
    )
    expect(container.querySelector('svg')).not.toBeNull()
    expect(container.textContent).toContain('Total (sem recorte): 2')
  })

  it('coluna "Apontamentos (total)" sempre renderiza apontamentosCountAllTime', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'apontamentosTotal')!
    expect(col.header).toBe('Apontamentos (total)')
    expect(col.sortable).toBe(false)
    const { container } = render(<>{col.accessor(makeItem({ apontamentosCountAllTime: 2 }))}</>)
    expect(container.textContent).toBe('2')
  })
})

describe('buildAppointmentsColumns — caso de aceite do PRD (chamado 47209681051, via D10)', () => {
  it('totalSecondsAllTime=1260 (21min) + apontamentosCountAllTime=2 aparecem na listagem', () => {
    const cols = buildAppointmentsColumns()
    const item = makeItem({
      totalSeconds: 0,
      totalSecondsAllTime: 1260,
      apontamentosCount: 0,
      apontamentosCountAllTime: 2,
    })
    const tempoTotalCol = cols.find((c) => c.key === 'tempoTotal')!
    const apontamentosTotalCol = cols.find((c) => c.key === 'apontamentosTotal')!
    const { container: tempoContainer } = render(<>{tempoTotalCol.accessor(item)}</>)
    const { container: apontamentosContainer } = render(<>{apontamentosTotalCol.accessor(item)}</>)
    expect(tempoContainer.textContent).toBe('0h 21m')
    expect(apontamentosContainer.textContent).toBe('2')
  })
})

describe('buildAppointmentsColumns — coluna Cliente (D2/119, guarda string vazia)', () => {
  it('string vazia renderiza "—" (não branco)', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'cliente')!
    expect(col.accessor(makeItem({ clienteNome: '' }))).toBe('—')
  })

  it('string só com espaços renderiza "—"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'cliente')!
    expect(col.accessor(makeItem({ clienteNome: '   ' }))).toBe('—')
  })

  it('null renderiza "—"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'cliente')!
    expect(col.accessor(makeItem({ clienteNome: null }))).toBe('—')
  })

  it('nome válido não regride', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'cliente')!
    expect(col.accessor(makeItem({ clienteNome: 'ACME' }))).toBe('ACME')
  })
})

describe('buildAppointmentsColumns — headerInfo menciona "descartados" (120/D-1)', () => {
  it.each(['tempo', 'tempoTotal', 'apontamentos', 'apontamentosTotal'])(
    'coluna "%s" menciona apontamentos descartados no headerInfo',
    (key) => {
      const cols = buildAppointmentsColumns()
      const col = cols.find((c) => c.key === key)!
      expect(col.headerInfo).toContain('descartados')
    },
  )
})

describe('buildAppointmentsColumns — ordenação (052/119)', () => {
  it('colunas informativas (categoria, categoriasTimer, tempoTotal, apontamentosTotal) não são ordenáveis', () => {
    const cols = buildAppointmentsColumns()
    const naoOrdenaveis = ['categoria', 'categoriasTimer', 'tempoTotal', 'apontamentosTotal']
    for (const key of naoOrdenaveis) {
      const col = cols.find((c) => c.key === key)!
      expect(col.sortable).toBe(false)
    }
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

  it('coluna Tempo (período) continua ordenável com sortKey "tempo"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'tempo')!
    expect(col.sortable).toBe(true)
    expect(col.sortKey).toBe('tempo')
  })

  it('coluna Apontamentos (período) continua ordenável com sortKey "apontamentos"', () => {
    const cols = buildAppointmentsColumns()
    const col = cols.find((c) => c.key === 'apontamentos')!
    expect(col.sortable).toBe(true)
    expect(col.sortKey).toBe('apontamentos')
  })
})
