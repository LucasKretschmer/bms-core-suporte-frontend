/**
 * Testes da página Consumo de Planos (index.tsx) — foco na demanda 070:
 *  - o drawer (Modal) dos chamados do cliente usa 90% da largura (max-w-[90vw]/w-[90vw]);
 *  - clicar num chamado navega para /relatorios/tickets/$ticketId (por id interno),
 *    com from='consumo-planos'.
 *
 * O ClientTicketsPanel é stub-ado para expor um botão que dispara onTicketClick —
 * isolando a asserção no wiring da página (navegação + props do Modal). O
 * comportamento interno do painel/tabela é coberto por ClientTicketsPanel.test.tsx.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PlanConsumptionItemDto } from '../shared/types/reports'
import type { ClientTicketItemDto } from '../../client-tickets/types/clientTickets'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const navigateMock = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('./hooks/usePlanConsumption', () => ({
  usePlanConsumption: vi.fn(),
}))

/**
 * 121/A2 — a página passou a renderizar o card de exceções de faturamento, que faz
 * requisição própria. Mockar o serviço (e não o card) mantém o wiring real sob teste:
 * é assim que se prova que o card recebe o período da tela e que ele sobrevive aos
 * estados da LISTAGEM (§5.3 — o card não pode desaparecer quando a lista está vazia).
 */
vi.mock('../shared/services/reportsService', () => ({
  listPlanConsumption: vi.fn(),
  listSupportPlans: vi.fn().mockResolvedValue([]),
  listBillingExceptions: vi.fn(),
  getBillingExceptionsSummary: vi.fn(),
}))

// Stub do painel: expõe um botão que aciona onTicketClick com uma linha fixa.
const stubTicket: ClientTicketItemDto = {
  ticketId: 321,
  hubspotTicketId: '888',
  assunto: 'Assunto',
  clienteNome: 'Acme',
  equipe: 'Suporte',
  ownerNome: 'Ana',
  status: 'Aberto',
  totalSeconds: 60,
  apontamentosCount: 1,
  hubspotUrl: null,
  totalSecondsAllTime: 60,
  apontamentosCountAllTime: 1,
  statusNome: null,
  statusCategoria: null,
  categoriasTimer: [],
}
/**
 * O stub ANTES ignorava initialFrom/initialTo — foi por isso que o P4/C1 (filtro de
 * data sem efeito no detalhe) passou batido aqui. Agora ele publica o período recebido
 * no DOM (`period-recebido`) para que o repasse seja asseverado.
 */
vi.mock('../../client-tickets/components/ClientTicketsPanel', () => ({
  ClientTicketsPanel: ({
    onTicketClick,
    initialFrom = null,
    initialTo = null,
  }: {
    onTicketClick?: (row: ClientTicketItemDto) => void
    initialFrom?: string | null
    initialTo?: string | null
  }) => (
    <div>
      <span data-testid="period-recebido">{`${initialFrom ?? 'null'}..${initialTo ?? 'null'}`}</span>
      <button type="button" onClick={() => onTicketClick?.(stubTicket)}>
        abrir-ticket
      </button>
    </div>
  ),
}))

import PlanConsumptionPage from './index'
import { usePlanConsumption } from './hooks/usePlanConsumption'
import {
  getBillingExceptionsSummary,
  listBillingExceptions,
  listSupportPlans,
} from '../shared/services/reportsService'

const mockedUsePlanConsumption = vi.mocked(usePlanConsumption)
const mockedExcecoes = vi.mocked(listBillingExceptions)
const mockedResumoExcecoes = vi.mocked(getBillingExceptionsSummary)

const clientRow: PlanConsumptionItemDto = {
  clientId: 9,
  cnpj: '00.000.000/0001-00',
  nomeFantasia: 'Acme',
  razaoSocial: 'Acme LTDA',
  nomePlano: 'Plano X',
  qtdePlanoHoras: 10,
  horasUsadas: 5,
  horasRestantes: 5,
  horasAdicionais: 0,
  percentualPlano: 50,
  horasFaturaveis: 0,
  horasAnalise: 0,
} as unknown as PlanConsumptionItemDto

/**
 * Estado do hook da listagem, com o período (from/to) parametrizável.
 * `estado` permite exercitar os estados da LISTAGEM — usado para provar que o card de
 * exceções continua visível quando a listagem está vazia, carregando ou com erro.
 */
function mockListagem(
  periodo: { from: string | null; to: string | null },
  estado: { isLoading?: boolean; isError?: boolean; vazio?: boolean } = {},
) {
  mockedUsePlanConsumption.mockReturnValue({
    data: {
      items: estado.vazio ? [] : [clientRow],
      totalCount: estado.vazio ? 0 : 1,
      page: 1,
      pageSize: 25,
      totalPages: estado.vazio ? 0 : 1,
    },
    isLoading: estado.isLoading ?? false,
    isError: estado.isError ?? false,
    refetch: vi.fn(),
    sortBy: null,
    sortDirection: 'desc',
    filters: { search: '', planId: null, ...periodo },
    page: 1,
    pageSize: 25,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
  } as unknown as ReturnType<typeof usePlanConsumption>)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListagem({ from: null, to: null })
  vi.mocked(listSupportPlans).mockResolvedValue([])
  // Sem exceções por default: o card aparece no estado neutro e não polui as
  // asserções dos testes de drawer.
  mockedExcecoes.mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  })
  mockedResumoExcecoes.mockResolvedValue({
    anomaliasCount: 0,
    anomaliasSegundos: 0,
    postergadoCount: 0,
    postergadoSegundos: 0,
    naoClassificadosCount: 0,
  })
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PlanConsumptionPage />
    </QueryClientProvider>,
  )
}

function openDrawer() {
  // Clica na linha da tabela (nome fantasia) para abrir o drawer inline.
  fireEvent.click(screen.getByText('Acme'))
}

describe('PlanConsumptionPage — drawer de chamados (070)', () => {
  it('o Modal do drawer usa 90% da largura (max-w-[90vw] w-[90vw])', () => {
    renderPage()
    openDrawer()
    const dialog = screen.getByRole('dialog')
    const content = dialog.querySelector('.max-w-\\[90vw\\]')
    expect(content).not.toBeNull()
    expect(content).toHaveClass('w-[90vw]')
  })

  it('clicar no chamado navega para /relatorios/tickets/$ticketId com id interno e from=consumo-planos', () => {
    renderPage()
    openDrawer()
    fireEvent.click(screen.getByText('abrir-ticket'))
    expect(navigateMock).toHaveBeenCalledTimes(1)
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: '321' },
      search: { from: 'consumo-planos' },
    })
  })
})

describe('PlanConsumptionPage — repasse do período ao drawer (121/C1)', () => {
  it('repassa o período FILTRADO na listagem ao painel do detalhe', () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()
    openDrawer()
    expect(screen.getByTestId('period-recebido')).toHaveTextContent(
      '2026-07-01..2026-07-31',
    )
  })

  it('repassa outro período quando o filtro muda (dois períodos distintos, não um valor fixo)', () => {
    mockListagem({ from: '2026-05-10', to: '2026-05-20' })
    renderPage()
    openDrawer()
    expect(screen.getByTestId('period-recebido')).toHaveTextContent(
      '2026-05-10..2026-05-20',
    )
  })

  it('repassa null quando não há período filtrado', () => {
    renderPage()
    openDrawer()
    expect(screen.getByTestId('period-recebido')).toHaveTextContent('null..null')
  })
})

/**
 * 121/A2 (§5.3) — o card de exceções vive NESTA tela, acima da tabela, porque a
 * conferência acontece enquanto o gestor olha os números da fatura.
 *
 * O ponto mais importante deste bloco: `ReportPageLayout` só renderiza `children` no
 * estado "com dados" — um card posto ali desapareceria exatamente quando a listagem
 * ficasse vazia ou falhasse, que é o silêncio que D2 combate. Por isso ele vai no slot
 * `banner`, e por isso estes 3 casos existem.
 */
describe('PlanConsumptionPage — card de exceções de faturamento (121/A2)', () => {
  function cardDeExcecoes() {
    return screen.getByRole('region', { name: 'Exceções de faturamento' })
  }

  it('recebe o MESMO período da listagem', async () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()

    await waitFor(() => expect(mockedResumoExcecoes).toHaveBeenCalled())
    expect(mockedResumoExcecoes.mock.calls[0][0]).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    })
  })

  it('continua visível quando a LISTAGEM está VAZIA', async () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' }, { vazio: true })
    renderPage()

    expect(
      screen.getByText('Nenhum cliente com plano encontrado para os filtros selecionados.'),
    ).toBeInTheDocument()
    await waitFor(() => expect(cardDeExcecoes()).toBeInTheDocument())
  })

  it('continua visível quando a LISTAGEM está em erro', async () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' }, { isError: true })
    renderPage()

    await waitFor(() => expect(cardDeExcecoes()).toBeInTheDocument())
  })

  it('continua visível quando a LISTAGEM está carregando', async () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' }, { isLoading: true })
    renderPage()

    await waitFor(() => expect(cardDeExcecoes()).toBeInTheDocument())
  })

  it('mostra as DUAS seções acima da tabela, com os números do resumo', async () => {
    mockedResumoExcecoes.mockResolvedValue({
      anomaliasCount: 3,
      anomaliasSegundos: 6300, // 1h 45m
      postergadoCount: 12,
      postergadoSegundos: 54000, // 15h 0m
      naoClassificadosCount: 0,
    })
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()

    const anomalias = await screen.findByTestId('excecoes-anomalias')
    expect(anomalias).toHaveTextContent(
      'Precisa ação: 3 chamados fechados sem data de conclusão · 1h 45m fora de qualquer fatura',
    )
    expect(screen.getByTestId('excecoes-postergado')).toHaveTextContent(
      'Postergado: 12 chamados ainda abertos · 15h 0m entram na fatura de quando o chamado fechar (não exige ação).',
    )
  })
})
