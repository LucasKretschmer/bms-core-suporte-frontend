/**
 * Detalhe do cliente (Consumo de Planos): só chamados com apontamento, coluna
 * "Tempo total", indicador "Em andamento" e combo "Atendente" por quem apontou.
 *
 * Hooks reais; só a camada de serviço é fake. As asserções olham a requisição
 * (params de listClientTickets e listTicketApontadores), não o estado do componente.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

vi.mock('../services/clientTicketsService', () => ({
  getClientKpis: vi.fn().mockResolvedValue(null),
  listClientTickets: vi.fn(),
  listTicketApontadores: vi.fn(),
}))
vi.mock('../../reports/shared/services/reportsService', () => ({
  getTicketStatuses: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../reports/shared/utils/exportTable', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../reports/shared/utils/exportTable')>()),
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { ClientTicketsPanel } from './ClientTicketsPanel'
import { ToastProvider } from '../../../components/ui/Toast'
import { listClientTickets, listTicketApontadores } from '../services/clientTicketsService'
import { exportToCsv } from '../../reports/shared/utils/exportTable'
import type { ListClientTicketsParams } from '../services/clientTicketsService'
import type { ClientTicketItemDto } from '../types/clientTickets'

const mockedTickets = vi.mocked(listClientTickets)
const mockedApontadores = vi.mocked(listTicketApontadores)
const mockedExportCsv = vi.mocked(exportToCsv)

const CLIENT_ID = 42
const FROM = '2026-08-01'
const TO = '2026-08-31'
const EXPORT_PAGE_SIZE = 200

function ticket(overrides: Partial<ClientTicketItemDto> = {}): ClientTicketItemDto {
  return {
    ticketId: 1,
    hubspotTicketId: '10001',
    assunto: 'Chamado A',
    clienteNome: 'Acme',
    equipe: 'Suporte',
    ownerNome: 'Ana',
    status: 'Aberto',
    totalSeconds: 1500,
    apontamentosCount: 1,
    hubspotUrl: null,
    totalSecondsAllTime: 9840,
    apontamentosCountAllTime: 4,
    statusNome: 'Aberto',
    statusCategoria: 'aberto',
    categoriasTimer: [],
    ...overrides,
  }
}

function renderPanel(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
  return render(ui, { wrapper })
}

function renderDetalhe() {
  return renderPanel(
    <ClientTicketsPanel clientId={CLIENT_ID} initialFrom={FROM} initialTo={TO} />,
  )
}

function chamadas(): ListClientTicketsParams[] {
  return mockedTickets.mock.calls.map((call) => call[0])
}

function ultimaChamadaDaTabela(): ListClientTicketsParams {
  const daTabela = chamadas().filter((p) => p.pageSize !== EXPORT_PAGE_SIZE)
  return daTabela[daTabela.length - 1]
}

/** Zera a paginação para comparar só filtros, período, recortes e ordenação. */
function semPaginacao(params: ListClientTicketsParams): ListClientTicketsParams {
  return { ...params, page: 0, pageSize: 0 }
}

function linhaDoTicket(hubspotTicketId: string): HTMLElement {
  const row = screen.getByText(`#${hubspotTicketId}`).closest('tr')
  if (!row) throw new Error(`linha do ticket #${hubspotTicketId} não encontrada`)
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedApontadores.mockResolvedValue([
    { value: 7, label: 'Ana Silva' },
    { value: 9, label: 'Bruno Costa' },
  ])
  mockedTickets.mockImplementation((params) =>
    Promise.resolve({
      items: [
        ticket({ ticketId: 1, hubspotTicketId: '10001', temApontamentoEmAndamento: true }),
        ticket({ ticketId: 2, hubspotTicketId: '10002' }),
      ],
      totalCount: 2,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: params.pageSize === EXPORT_PAGE_SIZE ? 2 : 1,
    }),
  )
})

describe('ClientTicketsPanel: somente chamados com apontamento', () => {
  it('a tabela e todas as páginas do export enviam somenteComApontamento=true com os mesmos params', async () => {
    renderDetalhe()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    const daTabela = ultimaChamadaDaTabela()
    expect(daTabela).toMatchObject({
      clientId: CLIENT_ID,
      scope: 'all',
      somenteComApontamento: true,
      from: FROM,
      to: TO,
    })

    await userEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await waitFor(() => expect(mockedExportCsv).toHaveBeenCalledTimes(1))

    const doExport = chamadas().filter((p) => p.pageSize === EXPORT_PAGE_SIZE)
    expect(doExport.map((p) => p.page)).toEqual([1, 2])
    for (const params of doExport) {
      expect(semPaginacao(params)).toEqual(semPaginacao(daTabela))
    }
  })
})

describe('ClientTicketsPanel: coluna "Tempo total" e indicador "Em andamento"', () => {
  it('mostra "Tempo total" ao lado de "Tempo no período" com totalSecondsAllTime', async () => {
    renderDetalhe()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent ?? '')
    const idxPeriodo = headers.findIndex((h) => h.includes('Tempo no período'))
    expect(idxPeriodo).toBeGreaterThanOrEqual(0)
    expect(headers[idxPeriodo + 1]).toContain('Tempo total')

    // 1500 s = 0h 25m no período; 9840 s = 2h 44m no histórico.
    const linha = within(linhaDoTicket('10002'))
    expect(linha.getByText('0h 25m')).toBeInTheDocument()
    expect(linha.getByText('2h 44m')).toBeInTheDocument()
  })

  it('marca "Em andamento" só na linha com temApontamentoEmAndamento=true; chave ausente não marca', async () => {
    renderDetalhe()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    expect(within(linhaDoTicket('10001')).getByText('Em andamento')).toBeInTheDocument()
    expect(within(linhaDoTicket('10002')).queryByText('Em andamento')).not.toBeInTheDocument()
  })
})

describe('ClientTicketsPanel: combo "Atendente" por quem apontou', () => {
  it('busca as opções em /apontadores com o scope da tabela e o clientId do cliente aberto', async () => {
    renderDetalhe()
    await waitFor(() => expect(mockedApontadores).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    expect(mockedApontadores).toHaveBeenCalledWith({
      scope: ultimaChamadaDaTabela().scope,
      clientId: CLIENT_ID,
    })
    expect(ultimaChamadaDaTabela().scope).toBe('all')
  })

  it('selecionar um atendente envia apontadoPor e nunca owner', async () => {
    renderDetalhe()
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    await waitFor(() => expect(mockedApontadores).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('button', { name: 'Atendente' }))
    await userEvent.click(await screen.findByRole('option', { name: /Bruno Costa/ }))

    await waitFor(() => expect(ultimaChamadaDaTabela().apontadoPor).toEqual([9]))
    expect(ultimaChamadaDaTabela()).not.toHaveProperty('owner')
    expect(ultimaChamadaDaTabela().somenteComApontamento).toBe(true)
  })
})
