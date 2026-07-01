import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LogsTable } from './LogsTable'
import type { LogDto } from '../types/sincronizador'

function makeLog(overrides?: Partial<LogDto>): LogDto {
  return {
    logId: 1,
    tipo: 'tickets',
    status: 'concluido',
    disparo: 'automatico',
    iniciadoEm: '2026-06-19T10:00:00Z',
    finalizadoEm: '2026-06-19T10:00:05Z',
    duracaoMs: 5000,
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
    ...overrides,
  }
}

function renderTable(data: LogDto[]) {
  return render(
    <LogsTable data={data} sortBy="iniciadoEm" sortDirection="desc" onSort={vi.fn()} />,
  )
}

/** Retorna a <tr> que contém o texto informado. */
function rowByText(text: string): HTMLElement {
  const cell = screen.getByText(text)
  const row = cell.closest('tr')
  if (!row) throw new Error(`Linha não encontrada para "${text}"`)
  return row
}

describe('LogsTable', () => {
  it('renderiza a coluna Tipo', () => {
    renderTable([makeLog()])
    expect(screen.getByRole('columnheader', { name: /Tipo/i })).toBeInTheDocument()
  })

  it('linha de tickets mantém comportamento anterior (contadores de tickets/projetos e emp/cont)', () => {
    renderTable([makeLog({ tipo: 'tickets' })])

    const row = rowByText('Tickets')
    // Contadores de tickets/projetos
    expect(within(row).getByText(/3↑\s*1↷\s*\/\s*2↑\s*0↷/)).toBeInTheDocument()
    // Empresas/contatos resolvidos (formato antigo "4 / 5")
    expect(within(row).getByText('4 / 5')).toBeInTheDocument()
  })

  it('linha de empresas exibe criadas/atualizadas/desativadas e oculta contadores de tickets', () => {
    renderTable([
      makeLog({
        logId: 2,
        tipo: 'empresas',
        empresasCriadas: 7,
        empresasAtualizadas: 4,
        empresasDesativadas: 2,
      }),
    ])

    // Contadores de empresa no formato "7+ 4~ 2−"
    const contadores = screen.getByText(/7\+\s*4~\s*2−/)
    const row = contadores.closest('tr')!
    // A célula de Tipo da linha mostra "Empresas"
    expect(within(row).getByRole('cell', { name: 'Empresas' })).toBeInTheDocument()
    // Não deve renderizar os contadores de tickets/projetos nessa linha
    expect(within(row).queryByText(/↑.*↷/)).not.toBeInTheDocument()
  })

  it('trata log legado sem `tipo` como tickets', () => {
    const legado = makeLog()
    // Simula wire antigo sem o campo tipo
    delete (legado as Partial<LogDto>).tipo
    renderTable([legado])

    expect(screen.getByText('Tickets')).toBeInTheDocument()
    expect(screen.getByText(/3↑\s*1↷/)).toBeInTheDocument()
  })

  it('renderiza tickets e empresas na mesma tabela sem quebrar', () => {
    renderTable([
      makeLog({ logId: 1, tipo: 'tickets' }),
      makeLog({
        logId: 2,
        tipo: 'empresas',
        empresasCriadas: 1,
        empresasAtualizadas: 0,
        empresasDesativadas: 0,
      }),
    ])

    // Uma célula de Tipo "Tickets" e uma "Empresas" (além do header "Empresas").
    expect(screen.getByRole('cell', { name: 'Tickets' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Empresas' })).toBeInTheDocument()
    // Duas linhas de dados no corpo da tabela.
    const bodyRows = screen.getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(2)
  })
})
