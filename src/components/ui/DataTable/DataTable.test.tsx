import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from './DataTable'
import type { ColumnDef } from './types'

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

describe('DataTable', () => {
  it('renderiza o cabeçalho de ordenação como botão acessível', () => {
    render(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={vi.fn()}
      />,
    )
    const sortButton = screen.getByRole('button', { name: /ordenar por nome/i })
    expect(sortButton).toBeInTheDocument()
  })

  it('chama onSort com a sortKey ao clicar no cabeçalho ordenável', () => {
    const onSort = vi.fn()
    render(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={onSort}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /ordenar por nome/i }))
    expect(onSort).toHaveBeenCalledTimes(1)
    expect(onSort).toHaveBeenCalledWith('nome')
  })

  it('não permite arrastar colunas — cabeçalhos não são draggable (071)', () => {
    render(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={vi.fn()}
      />,
    )
    const headers = document.querySelectorAll('th')
    expect(headers.length).toBe(2)
    headers.forEach((th) => {
      // draggable removido: atributo ausente ou explicitamente "false"
      expect(th.getAttribute('draggable')).not.toBe('true')
    })
  })

  it('coluna sem sortable não renderiza botão de ordenação', () => {
    render(
      <DataTable
        tableId="t"
        columns={columns}
        data={rows}
        sortState={{ sortBy: null, sortDirection: 'desc' }}
        onSort={vi.fn()}
      />,
    )
    // Apenas a coluna "Nome" (sortable) tem botão
    expect(screen.getAllByRole('button', { name: /ordenar por/i })).toHaveLength(1)
  })
})
