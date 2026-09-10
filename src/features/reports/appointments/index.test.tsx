/**
 * Teste da tela Apontamentos por Ticket (index.tsx).
 *
 * Foco: largura do filtro de Status (067).
 * O campo Status deve ter `min-w-[216px]` (180px × 1.2) e o campo Equipes
 * deve permanecer em `min-w-[180px]` — garante que a alteração de largura
 * atingiu apenas o Status, sem regredir o de Equipes.
 *
 * As dependências pesadas (hook de dados, permissões, router, toast) são
 * mockadas. Mantemos isLoading=true para renderizar apenas a barra de filtros
 * (a DataTable não é montada nesse estado), tornando o teste leve e estável.
 *
 * 134 — export calculável (S3): os dois últimos blocos cobrem as colunas de
 * duração (`tempo`, `tempoTotal`) saindo em SEGUNDOS CRUS, o arquivo CSV real
 * baixado pela tela, e o invariante de que a TELA continua em "2h 44m".
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

// ── Mocks de dependências ─────────────────────────────────────────────────────

vi.mock('./hooks/useAppointments', () => ({
  useAppointments: vi.fn(),
}))
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: vi.fn(),
}))
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))
vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}))
// Service usado pelos useQuery internos (status/equipes) — retornam vazio.
vi.mock('../shared/services/reportsService', () => ({
  getTicketStatuses: vi.fn().mockResolvedValue([]),
  getTicketCategories: vi.fn().mockResolvedValue([]),
  listServiceCategoryOptions: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
  listTicketsReport: vi.fn().mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  }),
}))

import AppointmentsPage, { EXPORT_COLUMNS, mapToExportRow } from './index'
import { useAppointments } from './hooks/useAppointments'
import { usePermissions } from '../../../hooks/usePermissions'
import { listTicketsReport } from '../shared/services/reportsService'
import { buildAppointmentsColumns } from './columns'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../test/duracaoExport'
import type { TicketReportItemDto } from '../shared/types/reports'

const mockedUseAppointments = vi.mocked(useAppointments)
const mockedUsePermissions = vi.mocked(usePermissions)

beforeEach(() => {
  vi.clearAllMocks()

  mockedUsePermissions.mockReturnValue({
    role: 'ATENDENTE',
    isCoordenadorOuAcima: false,
    isGerentePlus: false,
    isAtendente: true,
    isAuthenticated: true,
  })

  mockedUseAppointments.mockReturnValue({
    data: undefined,
    isLoading: true, // só a barra de filtros é renderizada
    isError: false,
    refetch: vi.fn(),
    sortBy: null,
    sortDirection: 'desc',
    filters: {
      scope: 'mine',
      search: '',
      status: [],
      teamId: [],
      categoria: [],
      serviceCategoryId: [],
      from: null,
      to: null,
    },
    page: 1,
    pageSize: 25,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
  } as unknown as ReturnType<typeof useAppointments>)
})

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

describe('AppointmentsPage — largura dos filtros multi-select (067/071)', () => {
  it('o filtro de Status usa min-w-[281px] (216 × 1.3 — 071)', () => {
    renderPage()
    // O className do MultiSelectCombobox vai para o container que envolve o label.
    const statusLabel = screen.getByText('Status')
    const statusContainer = statusLabel.closest('div')
    expect(statusContainer).not.toBeNull()
    expect(statusContainer).toHaveClass('min-w-[281px]')
    expect(statusContainer).not.toHaveClass('min-w-[216px]')
    expect(statusContainer).not.toHaveClass('min-w-[180px]')
  })

  it('o filtro de Equipes permanece em min-w-[180px] (não regrediu)', () => {
    renderPage()
    const teamsLabel = screen.getByText('Equipes')
    const teamsContainer = teamsLabel.closest('div')
    expect(teamsContainer).not.toBeNull()
    expect(teamsContainer).toHaveClass('min-w-[180px]')
    expect(teamsContainer).not.toHaveClass('min-w-[216px]')
  })
})

describe('AppointmentsPage — filtro de Categoria (HubSpot) (107/119 — rótulo renomeado, D6)', () => {
  it('renderiza o filtro "Categoria (HubSpot)" na barra de filtros', () => {
    renderPage()
    expect(screen.getByText('Categoria (HubSpot)')).toBeInTheDocument()
  })
})

describe('AppointmentsPage — filtro de Categoria do atendimento (MELH-02/119)', () => {
  it('renderiza o filtro "Categoria do atendimento" na barra de filtros', () => {
    renderPage()
    expect(screen.getByText('Categoria do atendimento')).toBeInTheDocument()
  })
})

describe('AppointmentsPage — export sem categoria HubSpot (107, privacidade)', () => {
  it('EXPORT_COLUMNS não inclui a coluna categoria (HubSpot)', () => {
    expect(EXPORT_COLUMNS.some((c) => c.key === 'categoria')).toBe(false)
  })

  it('EXPORT_COLUMNS inclui "categoriaAtendimento" e "tempoTotal" (D7/119)', () => {
    expect(EXPORT_COLUMNS.some((c) => c.key === 'categoriaAtendimento')).toBe(true)
    expect(EXPORT_COLUMNS.some((c) => c.key === 'tempoTotal')).toBe(true)
    expect(EXPORT_COLUMNS.some((c) => c.key === 'apontamentosTotal')).toBe(true)
  })

  it('mapToExportRow não expõe a categoria HubSpot na linha exportada', () => {
    const item: TicketReportItemDto = {
      ticketId: 1,
      hubspotTicketId: '1001',
      assunto: 'Erro',
      clienteNome: 'ACME',
      equipe: 'BR',
      ownerNome: 'Ana',
      status: 'Aberto',
      categoria: 'Problema - Invoicy',
      totalSeconds: 60,
      apontamentosCount: 1,
      hubspotUrl: null,
      totalSecondsAllTime: 60,
      apontamentosCountAllTime: 1,
      statusNome: null,
      statusCategoria: null,
      categoriasTimer: [],
    }
    const row = mapToExportRow(item)
    expect(row).not.toHaveProperty('categoria')
    expect(Object.values(row)).not.toContain('Problema - Invoicy')
  })

  it('mapToExportRow inclui categoriaAtendimento e tempoTotal (D7/119)', () => {
    const item: TicketReportItemDto = {
      ticketId: 1,
      hubspotTicketId: '1001',
      assunto: 'Erro',
      clienteNome: 'ACME',
      equipe: 'BR',
      ownerNome: 'Ana',
      status: 'Aberto',
      categoria: null,
      totalSeconds: 60,
      apontamentosCount: 1,
      hubspotUrl: null,
      totalSecondsAllTime: 1260,
      apontamentosCountAllTime: 2,
      statusNome: null,
      statusCategoria: null,
      categoriasTimer: ['Consultoria', 'Plantão'],
    }
    const row = mapToExportRow(item)
    expect(row.categoriaAtendimento).toBe('Consultoria; Plantão')
    // 134 — era `'0h 21m'`; agora a célula é o NÚMERO de segundos (1260 = 0h21m).
    expect(row.tempoTotal).toBe(1260)
    expect(row.apontamentosTotal).toBe(2)
  })
})

describe('AppointmentsPage — legenda de status (MELH-01/D5, 119)', () => {
  it('não renderiza a legenda em isLoading=true (tabela não está visível)', () => {
    // Neste mock, isLoading=true → children do ReportPageLayout não são renderizados
    // (nem a legenda, nem a DataTable) — comportamento correto do layout compartilhado.
    renderPage()
    expect(screen.queryByText('Legenda de status:')).not.toBeInTheDocument()
  })

  it('renderiza as 5 entradas fixas da legenda quando há dados, independente do conteúdo das linhas', () => {
    const item: TicketReportItemDto = {
      ticketId: 1,
      hubspotTicketId: '1001',
      assunto: 'Erro',
      clienteNome: 'ACME',
      equipe: 'BR',
      ownerNome: 'Ana',
      status: 'Novo (Pipeline)',
      categoria: null,
      totalSeconds: 60,
      apontamentosCount: 1,
      hubspotUrl: null,
      totalSecondsAllTime: 60,
      apontamentosCountAllTime: 1,
      statusNome: null,
      statusCategoria: 'aberto',
      categoriasTimer: [],
    }
    mockedUseAppointments.mockReturnValue({
      data: { items: [item], totalCount: 1, page: 1, pageSize: 25, totalPages: 1 },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      sortBy: null,
      sortDirection: 'desc',
      filters: {
        scope: 'mine',
        search: '',
        status: [],
        teamId: [],
        categoria: [],
        serviceCategoryId: [],
        from: null,
        to: null,
      },
      page: 1,
      pageSize: 25,
      setPage: vi.fn(),
      setPageSize: vi.fn(),
      setSort: vi.fn(),
      setFilters: vi.fn(),
    } as unknown as ReturnType<typeof useAppointments>)

    renderPage()

    expect(screen.getByText('Legenda de status:')).toBeInTheDocument()
    expect(screen.getByText('Aberto')).toBeInTheDocument()
    expect(screen.getByText('Em andamento')).toBeInTheDocument()
    expect(screen.getByText('Fechado')).toBeInTheDocument()
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
    expect(screen.getByText('Fora do consumo (Invoicy)')).toBeInTheDocument()
  })
})

// ── 134 · Horas calculáveis no export (S3) ───────────────────────────────────

/**
 * Fixture única desta fatia. Os literais de duração são escritos à mão e nunca
 * recalculados a partir da resposta (`rules/tests.md` § tautologia):
 * 9840 s = 2h44m · 95400 s = 26h30m (> 24 h) · 1260 s = 0h21m.
 */
function makeItem(overrides: Partial<TicketReportItemDto> = {}): TicketReportItemDto {
  return {
    ticketId: 1,
    hubspotTicketId: '1001',
    assunto: 'Erro',
    clienteNome: 'ACME',
    equipe: 'BR',
    ownerNome: 'Ana',
    status: 'Aberto',
    categoria: null,
    totalSeconds: 9840,
    apontamentosCount: 3,
    hubspotUrl: null,
    totalSecondsAllTime: 95400,
    apontamentosCountAllTime: 7,
    statusNome: null,
    statusCategoria: null,
    categoriasTimer: [],
    ...overrides,
  }
}

describe('AppointmentsPage — export calculável de duração (134/S3)', () => {
  it('as colunas de duração são EXATAMENTE {tempo, tempoTotal} (identidade, não cardinalidade)', () => {
    // Derivado da declaração real das colunas — nunca uma lista mantida à mão.
    // Vermelho se: tirarem `type: 'duration'` de uma das duas, renomearem a chave,
    // ou marcarem como duração uma coluna que é CONTAGEM.
    expect(new Set(chavesDeDuracao(EXPORT_COLUMNS))).toEqual(new Set(['tempo', 'tempoTotal']))
  })

  it('as colunas de CONTAGEM não são duração (nomeadas de propósito)', () => {
    expect(EXPORT_COLUMNS.find((c) => c.key === 'apontamentos')?.type).toBeUndefined()
    expect(EXPORT_COLUMNS.find((c) => c.key === 'apontamentosTotal')?.type).toBeUndefined()
    // Companheira positiva: as duas colunas existem mesmo (senão `find` → undefined
    // faria o assert acima passar pelo vazio).
    expect(EXPORT_COLUMNS.map((c) => c.key)).toEqual(
      expect.arrayContaining(['apontamentos', 'apontamentosTotal']),
    )
  })

  it('o mapper devolve number|null em toda chave derivada de duração', () => {
    // Vermelho se o mapper voltar a pré-formatar ('2h 44m') em qualquer das chaves.
    assertCelulasDeDuracaoSaoNumericas(EXPORT_COLUMNS, [mapToExportRow(makeItem())])
  })

  it('tempo e tempoTotal saem em SEGUNDOS CRUS', () => {
    const row = mapToExportRow(makeItem({ totalSeconds: 9840, totalSecondsAllTime: 1260 }))
    expect(row.tempo).toBe(9840)
    expect(row.tempoTotal).toBe(1260)
    // As contagens continuam contagens — vermelho se alguém converter tudo em bloco.
    expect(row.apontamentos).toBe(3)
    expect(row.apontamentosTotal).toBe(7)
  })

  it('0 legítimo é VALOR (0), nunca ausência', () => {
    // Companheira positiva do caso de ausência abaixo: separa o guard certo
    // (`== null`) da sobre-correção `if (!v) return null`.
    const row = mapToExportRow(makeItem({ totalSeconds: 0, totalSecondsAllTime: 0 }))
    expect(row.tempo).toBe(0)
    expect(row.tempoTotal).toBe(0)
  })

  it('ausência do wire (null EXPLÍCITO) vira célula vazia — nunca 0 (AP-FRONTEND-028)', () => {
    // O DTO declara `totalSeconds: number`, mas quem serializa é o outro lado da rede:
    // `null` chega. O cast existe para exercitar exatamente esse caso — é ele que
    // discrimina `== null` de `=== undefined` (o teste só com `undefined` passa nas duas).
    const comNull = mapToExportRow(
      makeItem({ totalSeconds: null as unknown as number, totalSecondsAllTime: 9840 }),
    )
    expect(comNull.tempo).toBeNull()
    // Positiva na MESMA linha: a linha existe e a coluna irmã traz o valor.
    expect(comNull.tempoTotal).toBe(9840)

    const comUndefined = mapToExportRow(
      makeItem({ totalSeconds: undefined as unknown as number, totalSecondsAllTime: 9840 }),
    )
    expect(comUndefined.tempo).toBeNull()
    expect(comUndefined.tempoTotal).toBe(9840)
  })
})

describe('AppointmentsPage — o arquivo CSV que a tela baixa (134/S3, ponta a ponta)', () => {
  /**
   * Clica em "Baixar CSV" na tela real e devolve o conteúdo do Blob produzido.
   * Prova a corrente inteira — `EXPORT_COLUMNS` + `mapToExportRow` + núcleo —, e não
   * apenas o mapper isolado: se a página passar outras colunas ao `exportToCsv`, o
   * mapper pode estar certo e o arquivo, errado.
   */
  async function baixarCsvDaTela(items: TicketReportItemDto[]): Promise<string> {
    vi.mocked(listTicketsReport).mockResolvedValue({
      items,
      totalCount: items.length,
      page: 1,
      pageSize: 200,
      totalPages: 1,
    })

    const capturados: string[] = []
    const OriginalBlob = Blob
    vi.stubGlobal('Blob', function (parts: BlobPart[], options?: BlobPropertyBag) {
      if (parts && typeof parts[0] === 'string') capturados.push(parts[0])
      return new OriginalBlob(parts, options)
    })
    const criarUrlOriginal = URL.createObjectURL
    const revogarUrlOriginal = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    const cliqueDoAncora = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    try {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
      // Controle positivo do capturador: sem ele, todo assert de conteúdo abaixo
      // seria satisfeito pelo vazio (`rules/tests.md` § padrão 1).
      await waitFor(() => expect(capturados).toHaveLength(1))
    } finally {
      cliqueDoAncora.mockRestore()
      URL.createObjectURL = criarUrlOriginal
      URL.revokeObjectURL = revogarUrlOriginal
      vi.unstubAllGlobals()
    }

    return capturados[0]
  }

  it('escreve H:mm:ss (sem módulo 24) nas colunas de tempo e deixa as contagens cruas', async () => {
    const csv = await baixarCsvDaTela([
      makeItem({ hubspotTicketId: '1001', totalSeconds: 9840, totalSecondsAllTime: 95400 }),
    ])

    // Cabeçalho intacto — positiva que ancora a ordem das colunas.
    expect(csv).toContain('"Tempo (período)","Tempo total","Apontamentos (período)"')
    // Linha inteira, literal e na ordem: 9840 → 02:44:00, 95400 → 26:30:00 (26, não 02),
    // e as contagens 3 e 7 saindo como número, não como duração.
    expect(csv).toContain(
      '"#1001","Erro","ACME","BR","Ana","","Aberto","02:44:00","26:30:00","3","7"',
    )
    expect(csv).not.toContain('2h 44m')
    expect(csv).not.toContain('26h 30m')
  })

  it('ausência vira campo VAZIO e 0 vira 00:00:00 na mesma linha', async () => {
    const csv = await baixarCsvDaTela([
      makeItem({
        hubspotTicketId: '1002',
        assunto: 'Sem tempo',
        totalSeconds: null as unknown as number,
        totalSecondsAllTime: 0,
        apontamentosCount: 0,
        apontamentosCountAllTime: 0,
      }),
    ])

    // Ordem literal: ausência → `""` (nunca `—`, nunca `0`); zero legítimo → `00:00:00`.
    expect(csv).toContain('"#1002","Sem tempo","ACME","BR","Ana","","Aberto","","00:00:00","0","0"')
    expect(csv).not.toContain('"—"')
  })
})

describe('AppointmentsPage — a TELA não muda (134/S3)', () => {
  it('a coluna visível "Tempo total" continua exibindo "2h 44m"', () => {
    const coluna = buildAppointmentsColumns().find((c) => c.key === 'tempoTotal')
    if (!coluna) throw new Error('coluna "tempoTotal" sumiu da tabela da tela')
    expect(coluna.accessor(makeItem({ totalSecondsAllTime: 9840 }))).toBe('2h 44m')
  })

  it('a coluna visível "Tempo" continua exibindo "2h 44m"', () => {
    const coluna = buildAppointmentsColumns().find((c) => c.key === 'tempo')
    if (!coluna) throw new Error('coluna "tempo" sumiu da tabela da tela')
    const { container } = render(
      <>{coluna.accessor(makeItem({ totalSeconds: 9840, totalSecondsAllTime: 9840 }))}</>,
    )
    expect(container.textContent).toBe('2h 44m')
  })
})
