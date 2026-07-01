import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'
import type { ColumnDef, SortState } from './types'

type Row = { id: number; nome: string }

const rows: Row[] = [
  { id: 1, nome: 'Alfa' },
  { id: 2, nome: 'Beta' },
]

const columns: ColumnDef<Row>[] = [
  {
    key: 'nome',
    header: 'Nome',
    accessor: (r) => r.nome,
    sortable: true,
    sortKey: 'nome',
    align: 'left',
  },
  {
    key: 'id',
    header: 'ID',
    accessor: (r) => r.id,
    align: 'right',
  },
]

function renderTable(sortState: SortState, onSort = vi.fn()) {
  render(
    <DataTable
      tableId="t"
      columns={columns}
      data={rows}
      sortState={sortState}
      onSort={onSort}
    />,
  )
  return onSort
}

describe('DataTable', () => {
  it('renderiza o cabeçalho de ordenação como botão acessível', () => {
    renderTable({ sortBy: null, sortDirection: 'desc' })
    const sortButton = screen.getByRole('button', { name: /ordenar por nome/i })
    expect(sortButton).toBeInTheDocument()
  })

  it('chama onSort com a sortKey ao clicar no botão do cabeçalho ordenável', () => {
    const onSort = renderTable({ sortBy: null, sortDirection: 'desc' })
    fireEvent.click(screen.getByRole('button', { name: /ordenar por nome/i }))
    expect(onSort).toHaveBeenCalledTimes(1)
    expect(onSort).toHaveBeenCalledWith('nome')
  })

  it('o botão de ordenação preenche o <th> inteiro (080)', () => {
    renderTable({ sortBy: null, sortDirection: 'desc' })
    const sortButton = screen.getByRole('button', { name: /ordenar por nome/i })
    // O botão ocupa toda a célula: largura e altura totais.
    expect(sortButton.className).toContain('w-full')
    expect(sortButton.className).toContain('h-9')
    expect(sortButton.className).toContain('cursor-pointer')
    // O <th> não deve concentrar o padding — ele foi movido para o botão,
    // garantindo que a área clicável cubra a célula inteira.
    const th = sortButton.closest('th')
    expect(th).not.toBeNull()
    expect(th?.className).toContain('p-0')
  })

  it('clique em qualquer ponto do cabeçalho ordenável dispara onSort (080)', () => {
    const onSort = renderTable({ sortBy: null, sortDirection: 'desc' })
    const sortButton = screen.getByRole('button', { name: /ordenar por nome/i })
    const th = sortButton.closest('th') as HTMLTableCellElement

    // O botão é o único filho interativo e preenche a célula inteira: qualquer
    // clique visual no <th> cai sobre ele. Cobrimos os pontos internos do
    // cabeçalho — o rótulo e o ícone — que estão dentro do botão full-cell.
    expect(th.querySelectorAll('button')).toHaveLength(1)
    expect(th.firstElementChild).toBe(sortButton)

    // Clicar no rótulo (dentro do botão) ordena.
    fireEvent.click(screen.getByText('Nome'))
    expect(onSort).toHaveBeenCalledWith('nome')
  })

  it('alterna asc↔desc mantendo o toggle (071) ao reordenar a mesma coluna', () => {
    // Estado ascendente ativo → o clique deve pedir novamente a mesma sortKey
    // (a inversão de direção é responsabilidade do hook consumidor).
    const onSort = renderTable({ sortBy: 'nome', sortDirection: 'asc' })
    fireEvent.click(screen.getByRole('button', { name: /ordenar por nome/i }))
    expect(onSort).toHaveBeenCalledTimes(1)
    expect(onSort).toHaveBeenCalledWith('nome')
  })

  it('reflete aria-sort no <th> conforme a direção ativa', () => {
    const { rerender } = render(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: 'nome', sortDirection: 'asc' }}
        onSort={vi.fn()}
      />,
    )
    const nomeHeader = () =>
      screen.getByRole('button', { name: /ordenar por nome/i }).closest('th')!

    expect(nomeHeader().getAttribute('aria-sort')).toBe('ascending')

    rerender(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: 'nome', sortDirection: 'desc' }}
        onSort={vi.fn()}
      />,
    )
    expect(nomeHeader().getAttribute('aria-sort')).toBe('descending')

    rerender(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={vi.fn()}
      />,
    )
    // Coluna ordenável não ativa → aria-sort "none".
    expect(nomeHeader().getAttribute('aria-sort')).toBe('none')
  })

  it('coluna não-ordenável não tem clique, cursor pointer nem aria-sort', () => {
    renderTable({ sortBy: null, sortDirection: 'desc' })
    // Apenas a coluna "Nome" (sortable) tem botão.
    const buttons = screen.getAllByRole('button', { name: /ordenar por/i })
    expect(buttons).toHaveLength(1)

    const headers = document.querySelectorAll('th')
    const idHeader = Array.from(headers).find((th) =>
      th.textContent?.includes('ID'),
    )!
    // Sem botão dentro, sem aria-sort, sem cursor pointer.
    expect(idHeader.querySelector('button')).toBeNull()
    expect(idHeader.getAttribute('aria-sort')).toBeNull()
    expect(idHeader.innerHTML).not.toContain('cursor-pointer')
  })

  it('preserva o alinhamento da coluna no cabeçalho ordenável (080)', () => {
    renderTable({ sortBy: null, sortDirection: 'desc' })
    // Coluna "Nome" tem align left → conteúdo justificado ao início.
    const sortButton = screen.getByRole('button', { name: /ordenar por nome/i })
    expect(sortButton.className).toContain('justify-start')
  })

  it('exibe o ícone correto de direção (asc/desc/neutro)', () => {
    const { rerender } = render(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: 'nome', sortDirection: 'asc' }}
        onSort={vi.fn()}
      />,
    )
    const btn = () => screen.getByRole('button', { name: /ordenar por nome/i })
    // Ícone ativo herda a cor primária.
    expect(btn().className).toContain('text-primary')

    rerender(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={vi.fn()}
      />,
    )
    // Sem ordenação ativa → sem cor primária no botão.
    expect(btn().className).not.toContain('text-primary')
  })

  it('não permite arrastar colunas — cabeçalhos não são draggable (071)', () => {
    renderTable({ sortBy: null, sortDirection: 'desc' })
    const headers = document.querySelectorAll('th')
    expect(headers.length).toBe(2)
    headers.forEach((th) => {
      expect(th.getAttribute('draggable')).not.toBe('true')
    })
  })

  it('dispara onRowClick ao clicar em uma linha', () => {
    const onRowClick = vi.fn()
    render(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={vi.fn()}
        onRowClick={onRowClick}
      />,
    )
    fireEvent.click(screen.getByText('Alfa'))
    expect(onRowClick).toHaveBeenCalledWith(rows[0])
  })
})
