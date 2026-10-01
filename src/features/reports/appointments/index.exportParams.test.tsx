/**
 * A exportação da tela Apontamentos por Ticket pede ao backend exatamente os mesmos
 * params da lista, em todas as páginas. Hook real (sem mock): o que se compara é o
 * que chega em listTicketsReport pela tabela e pelo botão de export.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: 'COORDENADOR',
    isCoordenadorOuAcima: true,
    isGerentePlus: false,
    isAtendente: false,
    isGestor: true,
    primaryTeamId: null,
    isAuthenticated: true,
  }),
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))
vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}))
vi.mock('../shared/services/reportsService', () => ({
  getTicketStatuses: vi.fn().mockResolvedValue([]),
  getTicketCategories: vi.fn().mockResolvedValue([]),
  listServiceCategoryOptions: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
  listTicketsReport: vi.fn(),
}))
vi.mock('../shared/utils/exportTable', async (importOriginal) => {
  const original = await importOriginal<typeof import('../shared/utils/exportTable')>()
  return { ...original, exportToCsv: vi.fn() }
})

import AppointmentsPage from './index'
import { listTicketsReport } from '../shared/services/reportsService'
import { exportToCsv } from '../shared/utils/exportTable'
import type { TicketsReportParams } from '../shared/services/reportsService'
import type { TicketReportItemDto } from '../shared/types/reports'

const mockedList = vi.mocked(listTicketsReport)
const EXPORT_PAGE_SIZE = 200

function item(ticketId: number): TicketReportItemDto {
  return {
    ticketId,
    hubspotTicketId: String(1000 + ticketId),
    assunto: 'Erro',
    clienteNome: 'ACME',
    equipe: 'BR',
    ownerNome: 'Ana',
    status: 'Aberto',
    categoria: null,
    totalSeconds: 60,
    apontamentosCount: 1,
    hubspotUrl: null,
    totalSecondsAllTime: 60,
    apontamentosCountAllTime: 1,
    statusNome: null,
    statusCategoria: null,
    categoriasTimer: [],
  }
}

/** Zera a paginação para comparar só filtros, período, recortes e ordenação. */
function semPaginacao(params: TicketsReportParams): TicketsReportParams {
  return { ...params, page: 0, pageSize: 0 }
}

function chamadas(): TicketsReportParams[] {
  return mockedList.mock.calls.map((call) => call[0])
}

function chamadasDaLista(): TicketsReportParams[] {
  return chamadas().filter((p) => p.pageSize !== EXPORT_PAGE_SIZE)
}

function chamadasDoExport(): TicketsReportParams[] {
  return chamadas().filter((p) => p.pageSize === EXPORT_PAGE_SIZE)
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AppointmentsPage />
    </QueryClientProvider>,
  )
}

async function exportarCsv() {
  vi.mocked(exportToCsv).mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
  await waitFor(() => expect(exportToCsv).toHaveBeenCalledTimes(1))
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  // Período de agosto, como no relato do QA.
  sessionStorage.setItem(
    'report-filters:appointments',
    JSON.stringify({ from: '2026-08-01', to: '2026-08-31' }),
  )
  // Duas páginas no export: prova que o param não se perde da página 2 em diante.
  mockedList.mockImplementation((params) =>
    Promise.resolve({
      items: [item(params.page)],
      totalCount: 2,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: params.pageSize === EXPORT_PAGE_SIZE ? 2 : 1,
    }),
  )
})

describe('AppointmentsPage: lista e exportação com os mesmos params', () => {
  it('todas as páginas do export levam os params da lista, com somenteComApontamento=true', async () => {
    renderPage()
    await waitFor(() => expect(chamadasDaLista()).toHaveLength(1))
    const lista = chamadasDaLista()[0]

    expect(lista).toMatchObject({
      from: '2026-08-01',
      to: '2026-08-31',
      somenteComApontamento: true,
    })

    await exportarCsv()

    const exportadas = chamadasDoExport()
    expect(exportadas.map((p) => p.page)).toEqual([1, 2])
    for (const params of exportadas) {
      expect(semPaginacao(params)).toEqual(semPaginacao(lista))
    }
  })

  it('toggle "Incluir chamados sem apontamento no período" remove o param da lista e do export', async () => {
    renderPage()
    await waitFor(() => expect(chamadasDaLista()).toHaveLength(1))

    fireEvent.click(
      screen.getByRole('switch', { name: 'Incluir chamados sem apontamento no período' }),
    )
    await waitFor(() => expect(chamadasDaLista()).toHaveLength(2))
    const listaComToggle = chamadasDaLista()[1]
    expect(listaComToggle.somenteComApontamento).toBeUndefined()

    await exportarCsv()

    const exportadas = chamadasDoExport()
    expect(exportadas).toHaveLength(2)
    for (const params of exportadas) {
      expect(params.somenteComApontamento).toBeUndefined()
      expect(semPaginacao(params)).toEqual(semPaginacao(listaComToggle))
    }
  })
})
