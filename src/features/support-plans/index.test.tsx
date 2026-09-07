import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// 125/FE-A11Y-4 (`Q-2`): o medidor do repo é UM SÓ (`utils/contrasteDeTexto.ts`), servido
// pelo harness `test/medidor-de-contraste.ts`, que deriva o tema da cascata real de CSS.
import { TOKENS, reprovacoesAA, varrer } from '../../test/medidor-de-contraste'
import type { CalendarOptionDto, SupportPlanDto, UnmatchedPlanDto } from './types/supportPlan'

const {
  mockUsePermissions,
  mockUseSupportPlans,
  mockUseUnmatchedPlans,
  mockUsePlanCalendars,
  mockCreateAsync,
  mockUpdateAsync,
  mockRefetchPlans,
} = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
  mockUseSupportPlans: vi.fn(),
  mockUseUnmatchedPlans: vi.fn(),
  mockUsePlanCalendars: vi.fn(),
  mockCreateAsync: vi.fn(),
  mockUpdateAsync: vi.fn(),
  mockRefetchPlans: vi.fn(),
}))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('./hooks/useSupportPlans', () => ({
  useSupportPlans: mockUseSupportPlans,
  useUnmatchedPlans: mockUseUnmatchedPlans,
  usePlanCalendars: mockUsePlanCalendars,
  SUPPORT_PLANS_QUERY_KEY: ['support-plans'],
  UNMATCHED_PLANS_QUERY_KEY: ['support-plans', 'unmatched'],
  CALENDAR_OPTIONS_QUERY_KEY: ['calendars', 'options'],
}))
vi.mock('./hooks/useSupportPlanMutations', () => ({
  useSupportPlanMutations: () => ({
    create: { mutateAsync: mockCreateAsync, isPending: false },
    update: { mutateAsync: mockUpdateAsync, isPending: false },
  }),
}))
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

import SupportPlansPage from './index'

const calendarios: CalendarOptionDto[] = [{ id: 1, nome: 'Comercial', padrao: true }]

const planos: SupportPlanDto[] = [
  {
    id: 7,
    nome: 'Support Pro',
    horasMes: 40,
    precoHoraExtra: 250,
    moeda: 'BRL',
    isActive: true,
    hubspotValor: null,
    slaPrimeiroAtendimentoMinutos: null,
    slaIsento: false,
    calendarioId: null,
    clientesVinculados: 14,
  },
  {
    id: 9,
    nome: 'Support 24x7 (sem 1º atend.)',
    horasMes: 10,
    precoHoraExtra: null,
    moeda: 'BRL',
    isActive: true,
    hubspotValor: 'plano_24x7',
    slaPrimeiroAtendimentoMinutos: null,
    slaIsento: true,
    calendarioId: 1,
    clientesVinculados: 0,
  },
]

const naoCorrespondentes: UnmatchedPlanDto[] = [
  { valorHubspot: 'Support Gold', clientesAfetados: 9, exemploClienteId: 42 },
]

const GERENTE = { isCoordenadorOuAcima: true, isGerentePlus: true }
const COORDENADOR = { isCoordenadorOuAcima: true, isGerentePlus: false }
const ATENDENTE = { isCoordenadorOuAcima: false, isGerentePlus: false }

function comDados(
  overrides: {
    plans?: Partial<{ data: SupportPlanDto[] | undefined; isLoading: boolean; isError: boolean }>
    unmatched?: Partial<{ data: UnmatchedPlanDto[] | undefined; isLoading: boolean; isError: boolean }>
    calendars?: Partial<{ data: CalendarOptionDto[] | undefined; isLoading: boolean; isError: boolean }>
  } = {},
) {
  mockUseSupportPlans.mockReturnValue({
    data: planos,
    isLoading: false,
    isError: false,
    refetch: mockRefetchPlans,
    ...overrides.plans,
  })
  mockUseUnmatchedPlans.mockReturnValue({
    data: naoCorrespondentes,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides.unmatched,
  })
  mockUsePlanCalendars.mockReturnValue({
    data: calendarios,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides.calendars,
  })
}

describe('SupportPlansPage — permissões (UX; o backend é a fonte de verdade)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    comDados()
  })

  it('ATENDENTE é barrado antes de ver a tabela — GET exige CoordenadorPlus', () => {
    mockUsePermissions.mockReturnValue(ATENDENTE)
    render(<SupportPlansPage />)

    expect(screen.getByText('Você não tem permissão para acessar esta área.')).toBeInTheDocument()
    expect(screen.queryByText('Support Pro')).toBeNull()
  })

  it('COORDENADOR vê os planos e NÃO vê as ações de escrita (PUT/POST exigem GerentePlus)', () => {
    mockUsePermissions.mockReturnValue(COORDENADOR)
    render(<SupportPlansPage />)

    expect(screen.getByText('Support Pro')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo plano' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Editar plano/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Criar plano para o valor/ })).toBeNull()
  })

  it('GERENTE vê editar em todas as linhas e o botão de novo plano — companheira positiva', () => {
    mockUsePermissions.mockReturnValue(GERENTE)
    render(<SupportPlansPage />)

    expect(screen.getByRole('button', { name: 'Editar plano Support Pro' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Editar plano Support 24x7 (sem 1º atend.)' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo plano' })).toBeInTheDocument()
  })
})

describe('SupportPlansPage — estados da lista', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GERENTE)
  })

  it('loading mostra skeleton, sem tabela nem estado vazio', () => {
    comDados({ plans: { data: undefined, isLoading: true } })
    render(<SupportPlansPage />)

    expect(screen.getByLabelText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum plano de suporte cadastrado.')).toBeNull()
  })

  it('erro mostra mensagem com retry — e o retry chama refetch', async () => {
    comDados({ plans: { data: undefined, isError: true } })
    render(<SupportPlansPage />)

    expect(screen.getByText('Não foi possível carregar os planos de suporte.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(mockRefetchPlans).toHaveBeenCalledTimes(1)
  })

  it('lista vazia mostra estado vazio, não tabela em branco', () => {
    comDados({ plans: { data: [] } })
    render(<SupportPlansPage />)

    expect(screen.getByText('Nenhum plano de suporte cadastrado.')).toBeInTheDocument()
  })
})

describe('SupportPlansPage — colunas de 124', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GERENTE)
    comDados()
  })

  it('marca o plano com vínculo frágil e NÃO marca o que tem identificador (R-1)', () => {
    render(<SupportPlansPage />)

    // "Support Pro": sem identificador e com 14 clientes → marcação.
    expect(screen.getByText('Não preenchido')).toBeInTheDocument()
    // "Support 24x7": identificador preenchido → exibe o valor, sem marcação.
    expect(screen.getByText('plano_24x7')).toBeInTheDocument()
    expect(screen.getAllByText('Não preenchido')).toHaveLength(1)
  })

  it('exibe os três estados da meta de SLA e o calendário resolvido por nome', () => {
    render(<SupportPlansPage />)

    expect(screen.getByText('Padrão do calendário')).toBeInTheDocument()
    expect(screen.getByText('Isento')).toBeInTheDocument()
    expect(screen.getByText('Calendário padrão')).toBeInTheDocument()
    expect(screen.getByText('Comercial')).toBeInTheDocument()
  })
})

describe('SupportPlansPage — fluxo do card de não correspondentes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GERENTE)
    comDados()
  })

  it('"Criar plano" abre o formulário com o identificador do HubSpot já preenchido', async () => {
    const user = userEvent.setup()
    render(<SupportPlansPage />)

    await user.click(screen.getByRole('button', { name: 'Criar plano para o valor Support Gold' }))

    expect(await screen.findByText('Novo plano de suporte')).toBeInTheDocument()
    expect(screen.getByLabelText(/Identificador do HubSpot/)).toHaveValue('Support Gold')
  })

  it('editar abre o formulário com os dados da LINHA clicada e chama update com o id dela', async () => {
    const user = userEvent.setup()
    mockUpdateAsync.mockResolvedValue({})
    render(<SupportPlansPage />)

    await user.click(screen.getByRole('button', { name: 'Editar plano Support 24x7 (sem 1º atend.)' }))

    expect(await screen.findByText('Editar plano de suporte')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do plano/)).toHaveValue('Support 24x7 (sem 1º atend.)')

    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(mockUpdateAsync).toHaveBeenCalled())
    expect(mockUpdateAsync.mock.calls[0]?.[0]?.id).toBe(9)
    expect(mockCreateAsync).not.toHaveBeenCalled()
  })

  it('novo plano chama create, nunca update', async () => {
    const user = userEvent.setup()
    mockCreateAsync.mockResolvedValue({})
    render(<SupportPlansPage />)

    await user.click(screen.getByRole('button', { name: 'Novo plano' }))
    await user.type(await screen.findByLabelText(/Nome do plano/), 'Support Gold')
    await user.type(screen.getByLabelText(/Horas por mês/), '20')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(mockCreateAsync).toHaveBeenCalled())
    expect(mockUpdateAsync).not.toHaveBeenCalled()
  })
})

/**
 * 124/FE-FIX2 · `D-2` e `D-3` — contraste medido NO DOM RENDERIZADO.
 *
 * A classe medida é a que o elemento de fato carrega (lida da árvore montada), e os hexes
 * vêm da cascata real de CSS. O medidor tem controle positivo próprio em
 * `utils/contrasteDeTexto.test.ts`: lá ele é obrigado a REPROVAR `/30`, `/50` e `/60`.
 */

function medirTela(container: HTMLElement) {
  // O conteúdo da página fica sobre `--color-background` (lido da regra `body` do CSS); o
  // medidor sobrescreve isso sozinho nos trechos que estão dentro de um `bg-card`.
  const { medidas, pulados } = varrer(container)
  // Recusa do medidor (fundo que ele não sabe modelar) reprova aqui em vez de virar
  // fallback silencioso — 125/FE-A11Y-4, `Q-3`.
  expect(pulados).toEqual([])
  return medidas
}

describe('SupportPlansPage — contraste AA (D-2 e D-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GERENTE)
  })

  it('o estado vazio usa o `EmptyState` corrigido (125/FE-A11Y-1) e passa AA', () => {
    comDados({ plans: { data: [] } })
    const { container } = render(<SupportPlansPage />)

    const mensagem = screen.getByText('Nenhum plano de suporte cadastrado.')
    // O `<p>` INTERNO do DS saía em `text-xs italic text-primary/30` e o `className` do
    // wrapper não o alcançava — por isso a asserção é sobre o elemento RENDERIZADO, e
    // não sobre a prop passada. Desde 125/FE-A11Y-1 quem renderiza a mensagem é o
    // wrapper local, em `text-foreground`.
    expect(mensagem.className).toContain('text-foreground')
    expect(mensagem.className).not.toContain('text-primary/30')
    expect(mensagem.className).not.toContain('italic')

    expect(reprovacoesAA(medirTela(container))).toEqual([])
  })

  it('a explicação do vazio está em /70 (5,47:1 sobre o card), não em /50', () => {
    comDados({ plans: { data: [] } })
    const { container } = render(<SupportPlansPage />)

    const explicacao = screen.getByText(/Cadastre os planos para definir/)
    expect(explicacao.className).toContain('text-foreground/70')

    const medida = medirTela(container).find((m) => m.texto.startsWith('Cadastre os planos'))
    expect(medida?.razao.toFixed(2)).toBe('5.47')
  })

  it('a tela com dados não tem NENHUM texto abaixo de 4,5:1', () => {
    comDados()
    const { container } = render(<SupportPlansPage />)

    const medidas = medirTela(container)
    // Companheira positiva: a varredura mediu de fato (senão `[]` passaria vazio).
    expect(medidas.length).toBeGreaterThan(5)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('o parágrafo que explica a tela está em /70 sobre o fundo da página (5,20:1)', () => {
    comDados()
    const { container } = render(<SupportPlansPage />)

    const paragrafo = screen.getByText(/Horas contratadas, meta de 1º atendimento/)
    expect(paragrafo.className).toContain('text-foreground/70')

    const medida = medirTela(container).find((m) => m.texto.startsWith('Horas contratadas'))
    expect(medida?.fundo).toBe(TOKENS['--color-background'])
    expect(medida?.razao.toFixed(2)).toBe('5.20')
  })
})
