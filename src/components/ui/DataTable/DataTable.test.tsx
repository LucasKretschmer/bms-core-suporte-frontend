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

    // Sem ⓘ, o botão de ordenação é o único elemento interativo do cabeçalho e
    // preenche a célula inteira (wrapper w-full + botão w-full): qualquer clique
    // visual no <th> cai sobre ele. O botão vive dentro de um wrapper <div> que
    // ocupa toda a célula (necessário para posicionar o ⓘ como irmão, 098 r2).
    expect(th.querySelectorAll('button')).toHaveLength(1)
    const wrapper = th.firstElementChild as HTMLElement
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.className).toContain('w-full')
    expect(wrapper.firstElementChild).toBe(sortButton)
    expect(sortButton.className).toContain('w-full')

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

  it('cabeçalho não quebra linha: conteúdo do header ordenável usa whitespace-nowrap (098)', () => {
    renderTable({ sortBy: null, sortDirection: 'desc' })
    const sortButton = screen.getByRole('button', { name: /ordenar por nome/i })
    expect(sortButton.className).toContain('whitespace-nowrap')
  })

  it('cabeçalho não quebra linha: header não-ordenável usa whitespace-nowrap (098)', () => {
    renderTable({ sortBy: null, sortDirection: 'desc' })
    const headers = document.querySelectorAll('th')
    const idHeader = Array.from(headers).find((th) =>
      th.textContent?.includes('ID'),
    )!
    const content = idHeader.querySelector('div')!
    expect(content.className).toContain('whitespace-nowrap')
  })

  it('renderiza headerNode (ex.: rótulo + InfoIcon) no cabeçalho (098)', () => {
    const columnsWithNode: ColumnDef<Row>[] = [
      {
        key: 'nome',
        header: 'Nome',
        headerNode: <span data-testid="header-node">Horas Adicionais</span>,
        accessor: (r) => r.nome,
        sortable: true,
        sortKey: 'nome',
        align: 'right',
      },
    ]
    render(
      <DataTable
        tableId="t"
        columns={columnsWithNode}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={vi.fn()}
      />,
    )
    expect(screen.getByTestId('header-node')).toHaveTextContent('Horas Adicionais')
  })

  it('coluna sortable com ⓘ: clicar no ícone (i) NÃO ordena (098 r2)', () => {
    const onSort = vi.fn()
    const columnsWithInfo: ColumnDef<Row>[] = [
      {
        key: 'nome',
        header: 'Horas Adicionais',
        headerInfo: 'Horas consumidas além do plano.',
        accessor: (r) => r.nome,
        sortable: true,
        sortKey: 'nome',
        align: 'right',
      },
    ]
    render(
      <DataTable
        tableId="t"
        columns={columnsWithInfo}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={onSort}
      />,
    )
    // O botão do ⓘ é identificado pelo aria-label = texto do tooltip.
    const infoButton = screen.getByRole('button', {
      name: 'Horas consumidas além do plano.',
    })
    fireEvent.click(infoButton)
    // Clicar no (i) apenas exibe o tooltip — jamais ordena.
    expect(onSort).not.toHaveBeenCalled()

    // Clicar no rótulo (dentro do botão de ordenação) continua ordenando.
    fireEvent.click(screen.getByText('Horas Adicionais'))
    expect(onSort).toHaveBeenCalledTimes(1)
    expect(onSort).toHaveBeenCalledWith('nome')
  })

  it('coluna sortable com ⓘ: sem <button> dentro de <button> no <th> (098 r2)', () => {
    const columnsWithInfo: ColumnDef<Row>[] = [
      {
        key: 'nome',
        header: 'Horas Adicionais',
        headerInfo: 'Horas consumidas além do plano.',
        accessor: (r) => r.nome,
        sortable: true,
        sortKey: 'nome',
        align: 'right',
      },
    ]
    render(
      <DataTable
        tableId="t"
        columns={columnsWithInfo}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={vi.fn()}
      />,
    )
    const th = screen
      .getByRole('button', { name: /ordenar por/i })
      .closest('th') as HTMLTableCellElement

    // Há exatamente 2 botões (ordenar + ⓘ), ambos irmãos — nunca aninhados.
    const buttons = Array.from(th.querySelectorAll('button'))
    expect(buttons).toHaveLength(2)
    buttons.forEach((btn) => {
      // Nenhum botão contém outro botão...
      expect(btn.querySelector('button')).toBeNull()
      // ...e nenhum botão tem um <button> ancestral dentro do <th>.
      const ancestorButton = btn.parentElement?.closest('button')
      expect(ancestorButton).toBeNull()
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
