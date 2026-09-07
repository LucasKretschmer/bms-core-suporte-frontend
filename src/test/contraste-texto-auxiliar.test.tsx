import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PADROES,
  TOKENS,
  classesDoTexto,
  classesForeground,
  fundoDoTexto,
  razaoDoTexto,
  reprovacoesAA,
  reprovacoesDasFrases,
  varrer,
} from './medidor-de-contraste'

/**
 * 125/FE-A11Y-2 (escopo `F2` do PRD 125) — as ocorrências de `text-foreground/50` e `/60`
 * medidas **no DOM renderizado**, antes e depois.
 *
 * ## Por que a medição é no DOM, e não na classe escrita no JSX
 *
 * A família de defeitos que originou a demanda 125 atravessou três unidades da 124 porque
 * todo mundo revisou **a classe passada**, não **a classe renderizada**: quando o texto passa
 * por um componente compartilhado, a classe interna do filho vence o `className` de fora.
 * Aqui cada afirmação parte da árvore montada — a classe vem do DOM, o hex vem do CSS real e
 * o fundo vem da cadeia de ancestrais (ver `utils/contrasteDeTexto.ts`).
 *
 * ## O que cada teste afirma
 *
 * Não basta "não reprovou": cada ponto alterado afirma **a classe que venceu**, **o fundo
 * efetivo** e **o número**. Um medidor que morresse (0 medições) deixaria `reprovacoesAA`
 * vazio e passaria — o par com `razaoDoTexto`, que LANÇA quando a frase não foi medida, é o
 * que impede isso. O controle positivo do medidor vive em
 * `utils/contrasteDeTexto.test.ts` e roda na mesma suíte.
 */

// ── Mocks de hooks: as telas são montadas de verdade; só as fontes de dados são fabricadas ──

const {
  mockUsePermissions,
  mockUseAuth,
  mockUseGlobalRules,
  mockUseTeamsList,
  mockUseTeamRules,
  mockUseTeamMembers,
  mockUseSincronizadorStatus,
  mockUseSincronizadorLogs,
  mockUseServiceCategories,
} = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
  mockUseAuth: vi.fn(),
  mockUseGlobalRules: vi.fn(),
  mockUseTeamsList: vi.fn(),
  mockUseTeamRules: vi.fn(),
  mockUseTeamMembers: vi.fn(),
  mockUseSincronizadorStatus: vi.fn(),
  mockUseSincronizadorLogs: vi.fn(),
  mockUseServiceCategories: vi.fn(),
}))

vi.mock('../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('../hooks/useAuth', () => ({ useAuth: mockUseAuth }))
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))
vi.mock('../features/business-rules/hooks/useBusinessRules', () => ({
  useGlobalRules: mockUseGlobalRules,
  useTeamsList: mockUseTeamsList,
  useTeamRules: mockUseTeamRules,
}))
vi.mock('../features/business-rules/hooks/useRuleMutations', () => ({
  useRuleMutations: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../features/teams/hooks/useTeamMembers', () => ({ useTeamMembers: mockUseTeamMembers }))
vi.mock('../features/teams/hooks/useUpdateAgentRole', () => ({
  useUpdateAgentRole: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../features/sincronizador/hooks/useSincronizadorStatus', () => ({
  useSincronizadorStatus: mockUseSincronizadorStatus,
}))
vi.mock('../features/sincronizador/hooks/useSincronizadorLogs', () => ({
  useSincronizadorLogs: mockUseSincronizadorLogs,
}))
vi.mock('../features/sincronizador/hooks/useRunSincronizador', () => ({
  useRunSincronizador: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('../features/service-categories/hooks/useServiceCategories', () => ({
  useServiceCategories: mockUseServiceCategories,
  SERVICE_CATEGORIES_QUERY_KEY: ['service-categories', { includeInactive: true }],
}))
vi.mock('../features/service-categories/hooks/useCategoryMutations', () => ({
  useCategoryMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
    toggleActive: { mutate: vi.fn(), isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
  }),
}))
vi.mock('../features/ticket-detail/hooks/useTimeEntryMutations', () => ({
  useTimeEntryMutations: () => ({
    create: { mutateAsync: vi.fn(), isPending: false },
    update: { mutateAsync: vi.fn(), isPending: false },
  }),
}))
vi.mock('../features/auth/hooks/useLogin', () => ({
  useLogin: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@tanstack/react-router', async (original) => ({
  ...(await original<typeof import('@tanstack/react-router')>()),
  useNavigate: () => vi.fn(),
}))

import { Breadcrumb } from '../components/layout/Breadcrumb'
import { ExternalLinkIcon } from '../components/ui/ExternalLinkIcon'
import LoginPage from '../features/auth/index'
import BusinessRulesPage from '../features/business-rules/index'
import { OnboardingNpsCard } from '../features/dashboards/onboarding/components/OnboardingNpsCard'
import { ClientReportHeader } from '../features/reports/client-report/components/ClientReportHeader'
import ServiceCategoriesPage from '../features/service-categories/index'
import { DurationLabel } from '../features/sincronizador/components/DurationLabel'
import SincronizadorPage from '../features/sincronizador/index'
import { AgentRoleCell } from '../features/teams/components/AgentRoleCell'
import TeamsPage from '../features/teams/index'
import { TicketDetailHeader } from '../features/ticket-detail/components/TicketDetailHeader'
import { TimeEntryCard } from '../features/ticket-detail/components/TimeEntryCard'
import { TimeEntryModal } from '../features/ticket-detail/components/TimeEntryModal'
import type { ClientReportDto } from '../features/reports/shared/types/reports'
import type { AgentDto } from '../features/teams/types/team'
import type { TicketHeaderDto, TicketTimeEntryDto } from '../features/ticket-detail/types/ticketDetail'

const CARD = TOKENS['--color-card']
const PAGINA = TOKENS['--color-background']

/**
 * Render com `QueryClientProvider` real: telas montadas de verdade têm filhos que abrem
 * `useMutation` própria (ex.: `SyncTeamsButton`) e quebrariam sem o client.
 */
function renderComQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

/** Varre a árvore montada e devolve as medições, já exigindo que nada tenha sido pulado. */
function medirTela(raiz: Element = document.body) {
  const { medidas, pulados } = varrer(raiz)
  // `pulados` não é decorativo: um medidor que descarta em silêncio devolve "0 reprovações".
  expect(pulados).toEqual([])
  return medidas
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUsePermissions.mockReturnValue({ isCoordenadorOuAcima: true, isGerentePlus: true })
  mockUseAuth.mockReturnValue({
    user: { id: 1, nome: 'Ana Suporte' },
    isAuthenticated: false,
    logout: vi.fn(),
  })
})

describe('Breadcrumb — a cor está no <nav>, o texto está nos filhos', () => {
  it('o item do meio HERDA a cor do nav e mede 5,20:1 sobre a página (era 3,88:1 com /60)', () => {
    const { container } = render(
      <Breadcrumb items={[{ label: 'Administração' }, { label: 'Configurações' }]} />,
    )
    const medidas = medirTela(container)

    // A classe vem do DOM: é a do <nav>, herdada pelo <span> que tem o texto.
    expect(classesDoTexto(medidas, 'Administração')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, 'Administração')).toEqual([PAGINA])
    expect(razaoDoTexto(medidas, 'Administração').toFixed(2)).toBe('5.20')
    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

describe('ClientReportHeader — dois fundos diferentes no MESMO componente', () => {
  const report: ClientReportDto = {
    client: {
      id: 1,
      hubspotCompanyId: 10,
      cnpj: null,
      razaoSocial: 'Cliente Teste LTDA',
      nomeFantasia: 'Cliente Teste',
      supportPlan: null,
      horasOverride: null,
      horasEfetivas: null,
    },
    plano: { id: 2, nome: 'Plano 20h', horasMes: 20, precoHoraExtra: null, moeda: 'BRL', isActive: true },
    competencia: '2026-06',
    totalApontamentos: 3,
    totalSegundos: 7200,
    horasPlanoSegundos: 72000,
    horasFaturadoSegundos: 3600,
    horasNaoFaturadoSegundos: 3600,
    items: null,
  }

  it('rótulos do cabeçalho (sobre o card) e do KPI (sobre a página) passam AA', () => {
    const { container } = render(<ClientReportHeader report={report} />)
    const medidas = medirTela(container)

    // "Cliente"/"Plano contratado"/"Competência" ficam sobre `bg-card` — 5,47:1.
    expect(classesDoTexto(medidas, 'Plano contratado')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, 'Plano contratado')).toEqual([CARD])
    expect(razaoDoTexto(medidas, 'Plano contratado').toFixed(2)).toBe('5.47')

    // O rótulo do KpiCard fica sobre `bg-background` — mesmo token, número menor (5,20:1).
    // Era o par que mais reprovava: /60 sobre a página mede 3,88:1.
    expect(fundoDoTexto(medidas, 'Apontamentos')).toEqual([PAGINA])
    expect(razaoDoTexto(medidas, 'Apontamentos').toFixed(2)).toBe('5.20')

    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

describe('DurationLabel — duas classes de cor no MESMO elemento (clsx não desempata)', () => {
  it('a classe interna e a passada de fora coexistem, e as DUAS passam AA', () => {
    // `clsx('text-xs text-foreground/60', className)` não remove a classe conflitante: o
    // elemento renderiza `text-foreground/70` E `text-foreground`. Qual vence depende da
    // ordem no CSS gerado, então o teste exige que as duas possibilidades passem.
    const { container } = render(
      <div className="bg-card">
        <DurationLabel duracaoMs={65_000} className="text-sm text-foreground font-medium" />
      </div>,
    )
    const medidas = medirTela(container)

    expect(classesDoTexto(medidas, '1m 5s').sort()).toEqual(['text-foreground', 'text-foreground/70'])
    expect(razaoDoTexto(medidas, '1m 5s').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

describe('TimeEntryCard — o cancelado recua por SUPERFÍCIE, e o veredito muda com ela', () => {
  function entry(overrides: Partial<TicketTimeEntryDto> = {}): TicketTimeEntryDto {
    return {
      id: 1,
      userId: 1,
      agenteNome: 'Maria',
      serviceCategoryId: 2,
      categorizacaoNome: 'Consultoria',
      billableOutsidePlan: false,
      status: 'COMPLETED',
      startTime: '2026-06-19T11:00:00Z',
      endTime: '2026-06-19T12:00:00Z',
      totalSeconds: 3600,
      note: null,
      pendingCategory: false,
      canceladoPorUserId: null,
      canceladoPorNome: null,
      segments: [
        { id: 10, type: 'WORK', segmentStart: '2026-06-19T11:00:00Z', segmentEnd: '2026-06-19T12:00:00Z' },
      ],
      ...overrides,
    }
  }

  it('apontamento ATIVO: a meta usa /70 sobre o card e mede 5,47:1', () => {
    const { container } = render(
      <TimeEntryCard entry={entry()} canEdit={false} onEdit={vi.fn()} />,
    )
    const medidas = medirTela(container)

    expect(classesDoTexto(medidas, 'sem pausa')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, 'sem pausa')).toEqual([CARD])
    expect(razaoDoTexto(medidas, 'sem pausa').toFixed(2)).toBe('5.47')
    expect(reprovacoesDasFrases(medidas, ['sem pausa'])).toEqual([])
    // Identidade da família: nada de /50 ou /60 sobrou, e o /70 está lá (companheira
    // positiva). ATUALIZADO em 125/FE-A11Y-3: o `text-foreground/40` da lista de
    // segmentos (2,34:1 aqui, 1,78:1 no cancelado) era a reprovação pré-existente que
    // esta unidade relatou como `A-1`; ela foi corrigida, então a classe sumiu da
    // identidade. Se alguém reintroduzir um alfa baixo neste card, ele reaparece aqui.
    expect(classesForeground(medidas)).toEqual(['text-foreground', 'text-foreground/70'])
  })

  // REESCRITO em 125/`Q-1`: enquanto havia `opacity-70` no card, `/70` media 3,00:1 e o
  // ponto usava o token CHEIO (5,59:1). O grupo saiu — o card cancelado é `bg-background`
  // opaco — e o `/70` volta a valer nos dois estados, medindo 5,20:1 aqui e 5,47:1 no ativo.
  it('apontamento CANCELADO: o mesmo /70 do ativo, sobre o fundo próprio, mede 5,20:1', () => {
    const { container } = render(
      <TimeEntryCard entry={entry({ status: 'CANCELLED' })} canEdit={false} onEdit={vi.fn()} />,
    )
    const medidas = medirTela(container)

    expect(classesDoTexto(medidas, 'sem pausa')).toEqual(['text-foreground/70'])
    // O fundo continua NÃO sendo o card — mas agora porque o card cancelado tem fundo
    // próprio e opaco, e não porque um grupo compõe o branco sobre a página.
    expect(fundoDoTexto(medidas, 'sem pausa')).not.toEqual([CARD])
    expect(fundoDoTexto(medidas, 'sem pausa')).toEqual([TOKENS['--color-background']])
    expect(razaoDoTexto(medidas, 'sem pausa').toFixed(2)).toBe('5.20')
    expect(reprovacoesDasFrases(medidas, ['sem pausa'])).toEqual([])
  })
})

describe('TicketDetailHeader — linha de meta do ticket', () => {
  const ticket: TicketHeaderDto = {
    id: 1,
    hubspotTicketId: '4321',
    assunto: 'Erro ao emitir nota',
    categoria: 'Dúvida',
    pipelineStage: 'Em atendimento',
    owner: null,
    client: { id: 5, hubspotCompanyId: 9, cnpj: null, razaoSocial: 'ACME SA', nomeFantasia: 'ACME' },
    requester: null,
    hubspotUrl: null,
    conteudo: null,
    hsCriadoEm: null,
  }

  it('a meta (cliente · categoria) passa a medir 5,47:1 sobre o card', () => {
    const { container } = render(
      <TicketDetailHeader ticket={ticket} canCreate={false} onAddAppointment={vi.fn()} />,
    )
    const medidas = medirTela(container)

    expect(classesDoTexto(medidas, 'Categoria: Dúvida')).toEqual(['text-foreground/70'])
    expect(razaoDoTexto(medidas, 'Categoria: Dúvida').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

describe('OnboardingNpsCard — badge com FUNDO próprio (bg-border/50)', () => {
  it('o fundo do badge não é o card: /70 sobre ele mede 4,92:1 (e /60 mediria 3,72:1)', () => {
    const { container } = render(
      <div className="bg-card">
        <OnboardingNpsCard />
      </div>,
    )
    const medidas = medirTela(container)

    expect(classesDoTexto(medidas, 'Em breve')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, 'Em breve')).not.toEqual([CARD])
    expect(razaoDoTexto(medidas, 'Em breve').toFixed(2)).toBe('4.92')
    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

describe('AgentRoleCell — aviso de troca do próprio perfil', () => {
  const agent: AgentDto = {
    userId: 1,
    nome: 'Ana',
    email: 'ana@migrate.info',
    equipeId: 5,
    equipeNome: 'Suporte',
    papel: 'ATENDENTE',
    equipes: [{ id: 5, nome: 'Suporte', isPrimary: true }],
  }

  it('o aviso passa a medir 5,47:1 sobre o card da tabela', () => {
    const { container } = render(
      <div className="bg-card">
        <AgentRoleCell agent={agent} canEdit isSelf />
      </div>,
    )
    const medidas = medirTela(container)

    expect(classesDoTexto(medidas, 'só vale após novo login')).toEqual(['text-foreground/70'])
    expect(razaoDoTexto(medidas, 'só vale após novo login').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

describe('TimeEntryModal — 6 textos auxiliares dentro do modal', () => {
  it('rótulos, dicas e legend do modal passam AA (5,47:1 sobre o painel branco)', () => {
    render(
      <TimeEntryModal
        isOpen
        mode="create"
        ticketId={1}
        ticketLabel="#4321 — Erro ao emitir nota"
        agentOptions={[{ value: '1', label: 'Ana' }]}
        categoryOptions={[{ value: '2', label: 'Consultoria' }]}
        canChangeAgent
        currentUserId={1}
        canManage={false}
        onClose={vi.fn()}
        onRequestCancel={vi.fn()}
        onSubmitted={vi.fn()}
      />,
    )
    // O painel vai para um portal em `document.body` — varrer só o container perderia tudo.
    const medidas = medirTela()

    const frasesDoModal = [
      '#4321 — Erro ao emitir nota',
      'Marca este apontamento',
      'Edite os horários ou adicione um apontamento',
      'Apontamento 1',
      'Início',
      'Fim',
    ]
    for (const frase of frasesDoModal) {
      expect(classesDoTexto(medidas, frase)).toContain('text-foreground/70')
      expect(razaoDoTexto(medidas, frase).toFixed(2)).toBe('5.47')
    }
    expect(reprovacoesDasFrases(medidas, frasesDoModal)).toEqual([])
    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

describe('Telas inteiras — o parágrafo de apoio de cada página', () => {
  it('Configurações (business-rules): parágrafo sobre a página + dica dentro do card', () => {
    mockUseGlobalRules.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() })
    mockUseTeamsList.mockReturnValue({
      data: [{ id: 1, nome: 'Suporte', gerencia: null }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseTeamRules.mockReturnValue({ 1: { rules: [], isLoading: false, isError: false } })

    renderComQuery(<BusinessRulesPage />)
    const medidas = medirTela()

    expect(classesDoTexto(medidas, 'Regras de negócio aplicadas')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, 'Regras de negócio aplicadas')).toEqual([PAGINA])
    expect(razaoDoTexto(medidas, 'Regras de negócio aplicadas').toFixed(2)).toBe('5.20')

    // A dica do campo (`GlobalRulesCard`) e a descrição de cada toggle (`TeamRulesCard`)
    // ficam dentro do card branco — 5,47:1.
    expect(classesDoTexto(medidas, 'Entre 1 e 60 minutos')).toEqual(['text-foreground/70'])
    expect(razaoDoTexto(medidas, 'Entre 1 e 60 minutos').toFixed(2)).toBe('5.47')
    expect(classesDoTexto(medidas, 'Permite apenas um timer ativo')).toEqual([
      'text-foreground/70',
    ])
    expect(razaoDoTexto(medidas, 'Permite apenas um timer ativo').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('Equipes: parágrafo, contagem de membros do card e marcador "(principal)"', () => {
    mockUseTeamMembers.mockReturnValue({
      data: [
        {
          userId: 1,
          nome: 'Ana',
          email: 'ana@migrate.info',
          equipeId: 5,
          equipeNome: 'Suporte',
          papel: 'ATENDENTE',
          equipes: [{ id: 5, nome: 'Suporte', isPrimary: true }],
        },
      ] satisfies AgentDto[],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderComQuery(<TeamsPage />)
    const medidas = medirTela()

    expect(classesDoTexto(medidas, 'Equipes e owners vêm do HubSpot')).toEqual([
      'text-foreground/70',
    ])
    expect(razaoDoTexto(medidas, 'Equipes e owners vêm do HubSpot').toFixed(2)).toBe('5.20')
    // Contagem de membros do card da equipe e marcador "(principal)" da lista — os dois
    // ficam sobre `bg-card`.
    expect(razaoDoTexto(medidas, '1 membro').toFixed(2)).toBe('5.47')
    expect(classesDoTexto(medidas, '(principal)')).toEqual(['text-foreground/70'])
    expect(razaoDoTexto(medidas, '(principal)').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('Sincronizador: parágrafo da página e "Nunca executado." dentro do card', () => {
    mockUseSincronizadorStatus.mockReturnValue({
      data: {
        statusSistema: 'OK',
        ultimaExecucao: null,
        intervaloMinutos: 0,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseSincronizadorLogs.mockReturnValue({
      query: { data: undefined, isLoading: true, isError: false, isFetching: false, refetch: vi.fn() },
      page: 1,
      pageSize: 25,
      statusFilter: undefined,
      sortBy: 'iniciadoEm',
      sortDirection: 'desc',
      setPage: vi.fn(),
      setPageSize: vi.fn(),
      handleSort: vi.fn(),
      handleStatusFilter: vi.fn(),
    })

    renderComQuery(<SincronizadorPage />)
    const medidas = medirTela()

    expect(razaoDoTexto(medidas, 'Monitoramento e controle').toFixed(2)).toBe('5.20')
    expect(classesDoTexto(medidas, 'Nunca executado')).toEqual(['text-foreground/70'])
    expect(razaoDoTexto(medidas, 'Nunca executado').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('Categorias do Atendimento: parágrafo e o nome da categoria INATIVA na tabela', () => {
    mockUseServiceCategories.mockReturnValue({
      data: [
        { id: 7, nome: 'Consultoria', isActive: true },
        { id: 9, nome: 'Plantão', isActive: false },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderComQuery(<ServiceCategoriesPage />)
    const medidas = medirTela()

    expect(razaoDoTexto(medidas, 'Usada no encerramento do timer').toFixed(2)).toBe('5.20')
    // Categoria inativa: o nome é esmaecido de propósito — mas AA é piso, não preferência.
    expect(classesDoTexto(medidas, 'Plantão')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, 'Plantão')).toEqual([CARD])
    expect(razaoDoTexto(medidas, 'Plantão').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('Login: subtítulo do cartão de acesso', () => {
    renderComQuery(<LoginPage />)
    const medidas = medirTela()

    expect(classesDoTexto(medidas, 'Acesso restrito')).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, 'Acesso restrito')).toEqual([CARD])
    expect(razaoDoTexto(medidas, 'Acesso restrito').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })
})

describe('As ocorrências que NÃO são texto — por que continuam em /50 e /60', () => {
  it('ExternalLinkIcon é `aria-hidden` e não tem nó de texto: nada a medir como texto', () => {
    const { container } = render(
      <div className="bg-card">
        <a href="https://exemplo.invalid" target="_blank" rel="noopener noreferrer">
          Abrir no HubSpot
          <ExternalLinkIcon />
        </a>
      </div>,
    )
    const { medidas, pulados } = varrer(container)

    // O ícone não aparece em NENHUMA medição — o critério é semântico (aria-hidden lido do
    // DOM), não "parece decorativo". O texto do link continua sendo medido: sem esse par,
    // a regra poderia estar engolindo a árvore inteira e o teste ficaria verde igual.
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(medidas.map((m) => m.texto)).toEqual(['Abrir no HubSpot'])
    expect(pulados).toEqual([])
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('o padrão do body é o esperado — a base de toda medição desta suíte', () => {
    expect(PADROES.cor).toBe(TOKENS['--color-foreground'])
    expect(PADROES.fundo).toBe(PAGINA)
  })
})
