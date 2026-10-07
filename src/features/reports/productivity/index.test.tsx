import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../../components/ui/Toast'
import type { PaginatedResponse } from '../../../types/api'
import type {
  AppointmentReportItemDto,
  ProductivityReportItemDto,
  ProductivitySummaryDto,
} from '../shared/types/reports'

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('./hooks/useProductivity', () => ({
  useProductivity: vi.fn(),
}))

vi.mock('../shared/services/reportsService', () => ({
  listTeams: vi.fn().mockResolvedValue([]),
  listProductivity: vi.fn(),
  listAppointmentsReport: vi.fn(),
  getProductivitySummary: vi.fn(),
}))

import ProductivityPage from './index'
import { useProductivity } from './hooks/useProductivity'
import {
  getProductivitySummary,
  listAppointmentsReport,
} from '../shared/services/reportsService'

const analista: ProductivityReportItemDto = {
  userId: 42,
  nome: 'Ana Lima',
  equipe: 'Suporte',
  nAtendimentos: 3,
  totalSegundos: 7200,
  ahtSegundos: 2400,
  mediaPausas: 0,
  ticketsAtendidos: 2,
  mediaTicketsUltimos3Meses: 1,
  mediaResolvidosPorDia: 0.2,
  mediaSegundosPorTicket: 3600,
  diasUteis: 5,
  horasUteisSegundos: 144000,
  mediaOciosoSegundosPorDia: 27360,
  extrapolouJornada: false,
}

const apontamentoLongo: AppointmentReportItemDto = {
  timeEntryId: 1,
  ticketId: 321,
  hubspotTicketId: '9001',
  assunto: 'Erro na nota',
  clienteNome: 'Acme',
  atendente: 'Ana Lima',
  faturamento: 'Plano de Suporte',
  dataApontamento: '2026-10-02T12:00:00Z',
  totalSegundos: 18000,
  acimaDoLimite: true,
}

const apontamentoCurto: AppointmentReportItemDto = {
  ...apontamentoLongo,
  timeEntryId: 2,
  ticketId: 322,
  hubspotTicketId: '9002',
  assunto: 'Dúvida',
  totalSegundos: 600,
  acimaDoLimite: false,
}

const resumo: ProductivitySummaryDto = {
  totalSegundos: 7200,
  totalAtendentes: 1,
  totalAtendimentos: 3,
  mediaAtendimentosPorAtendente: 3,
  medianaAtendimentosPorAtendente: 3,
  totalTickets: 2,
  mediaSegundosPorTicket: 3600,
  medianaSegundosPorTicket: 3600,
}

function pagina<T>(items: T[]): PaginatedResponse<T> {
  return { items, totalCount: items.length, page: 1, pageSize: 25, totalPages: items.length ? 1 : 0 }
}

function mockListagem() {
  vi.mocked(useProductivity).mockReturnValue({
    data: pagina([analista]),
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    page: 1,
    pageSize: 25,
    sortBy: 'totalsegundos',
    sortDirection: 'desc',
    filters: { from: '2026-10-01', to: '2026-10-07', teamId: '3' },
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
  })
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ProductivityPage />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

function linhaDoAnalista(): HTMLElement {
  const linha = screen.getByText('Ana Lima').closest('tr')
  if (!linha) throw new Error('linha não encontrada')
  return linha
}

describe('ProductivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListagem()
    vi.mocked(getProductivitySummary).mockResolvedValue(resumo)
    vi.mocked(listAppointmentsReport).mockResolvedValue(
      pagina([apontamentoLongo, apontamentoCurto]),
    )
  })

  it('cards globais chamam o resumo com os filtros da tela, sem userId', async () => {
    renderPage()

    await waitFor(() =>
      expect(getProductivitySummary).toHaveBeenCalledWith({
        from: '2026-10-01',
        to: '2026-10-07',
        teamId: '3',
      }),
    )
  })

  it('Enter na linha abre o drill e busca os apontamentos do analista, maior primeiro', async () => {
    renderPage()
    fireEvent.keyDown(linhaDoAnalista(), { key: 'Enter' })

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Apontamentos de Ana Lima')).toBeInTheDocument()

    await waitFor(() =>
      expect(listAppointmentsReport).toHaveBeenCalledWith({
        userId: 42,
        from: '2026-10-01',
        to: '2026-10-07',
        sortBy: 'totalsegundos',
        sortDirection: 'desc',
        page: 1,
        pageSize: 25,
      }),
    )
    expect(getProductivitySummary).toHaveBeenCalledWith({
      from: '2026-10-01',
      to: '2026-10-07',
      userId: 42,
    })
  })

  it('apontamento acima do limite tem destaque com texto; o outro não', async () => {
    renderPage()
    fireEvent.click(screen.getByText('Ana Lima'))

    const dialog = await screen.findByRole('dialog')
    const longo = (await within(dialog).findByText('#9001')).closest('tr')
    const curto = within(dialog).getByText('#9002').closest('tr')

    expect(longo).toHaveClass('bg-error-bg')
    expect(within(longo as HTMLElement).getByText('Acima do limite')).toBeInTheDocument()
    expect(curto).not.toHaveClass('bg-error-bg')
    expect(within(curto as HTMLElement).queryByText('Acima do limite')).not.toBeInTheDocument()
  })

  it('clique no apontamento navega ao ticket pelo id interno', async () => {
    renderPage()
    fireEvent.click(screen.getByText('Ana Lima'))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(await within(dialog).findByText('#9001'))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: '321' },
    })
  })

  it('fechar o drill devolve o foco à linha', async () => {
    renderPage()
    const linha = linhaDoAnalista()
    linha.focus()
    fireEvent.keyDown(linha, { key: 'Enter' })

    await screen.findByRole('dialog')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(linhaDoAnalista()).toHaveFocus())
  })

  it('drill sem apontamentos mostra o vazio; com erro, o ErrorState', async () => {
    vi.mocked(listAppointmentsReport).mockResolvedValueOnce(pagina([]))
    const { unmount } = renderPage()
    fireEvent.click(screen.getByText('Ana Lima'))
    expect(
      await screen.findByText('Nenhum apontamento do analista no período selecionado.'),
    ).toBeInTheDocument()
    unmount()

    vi.mocked(listAppointmentsReport).mockRejectedValueOnce(new Error('falhou'))
    renderPage()
    fireEvent.click(screen.getByText('Ana Lima'))
    expect(
      await screen.findByText('Não foi possível carregar os apontamentos do analista.'),
    ).toBeInTheDocument()
  })
})
