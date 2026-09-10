import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaginatedResponse } from '../../types/api'
import type {
  BillingPeriodComparisonItemDto,
  BillingPeriodDto,
} from './types/billingPeriod'

const {
  mockUsePermissions,
  mockUseBillingPeriods,
  mockUseComparacao,
  mockFecharMutate,
  mockReabrirMutate,
  mockRefetch,
} = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
  mockUseBillingPeriods: vi.fn(),
  mockUseComparacao: vi.fn(),
  mockFecharMutate: vi.fn(),
  mockReabrirMutate: vi.fn(),
  mockRefetch: vi.fn(),
}))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('./hooks/useBillingPeriods', () => ({
  useBillingPeriods: mockUseBillingPeriods,
  BILLING_PERIODS_QUERY_KEY: 'billing-periods',
}))
vi.mock('./hooks/useBillingPeriodComparison', () => ({
  useBillingPeriodComparison: mockUseComparacao,
  BILLING_PERIOD_COMPARISON_QUERY_KEY: 'billing-period-comparison',
}))
vi.mock('./hooks/useBillingPeriodMutations', () => ({
  useBillingPeriodMutations: () => ({
    fechar: { mutate: mockFecharMutate, isPending: false },
    reabrir: { mutate: mockReabrirMutate, isPending: false },
  }),
}))
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))
/** O combobox de cliente faz a própria query — fora do escopo desta tela. */
vi.mock('../reports/shared/components/ClientCombobox', () => ({
  ClientCombobox: ({ label }: { label?: string }) => <div>{label}</div>,
}))

import { razaoDoTexto, reprovacoesAA, varrer } from '../../test/medidor-de-contraste'
import CompetenciasPage from './index'

const FECHADA: BillingPeriodDto = {
  competencia: '2026-08',
  estado: 'fechada',
  fechadaEm: '2026-09-01T03:00:00Z',
  fechadaPorNome: null,
  versao: 1,
  totalClientes: 42,
  totalHorasAdicionais: 12.5,
}
const CORRENTE: BillingPeriodDto = {
  competencia: '2026-09',
  estado: 'corrente',
  fechadaEm: null,
  versao: null,
  totalClientes: null,
  totalHorasAdicionais: null,
}
const HISTORICA: BillingPeriodDto = { ...CORRENTE, competencia: '2026-05', estado: 'historica' }

function paginado<T>(items: T[]): PaginatedResponse<T> {
  return { items, totalCount: items.length, page: 1, pageSize: 25, totalPages: 1 }
}

function comLista(
  items: BillingPeriodDto[],
  extra: { isLoading?: boolean; isError?: boolean } = {},
) {
  mockUseBillingPeriods.mockReturnValue({
    data: extra.isLoading === true || extra.isError === true ? undefined : paginado(items),
    isLoading: extra.isLoading ?? false,
    isError: extra.isError ?? false,
    refetch: mockRefetch,
    page: 1,
    pageSize: 25,
    sortBy: null,
    sortDirection: 'desc',
    filters: {},
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
  })
}

function comComparacao(
  items: BillingPeriodComparisonItemDto[],
  extra: { isLoading?: boolean; isError?: boolean } = {},
) {
  mockUseComparacao.mockReturnValue({
    data: extra.isLoading === true || extra.isError === true ? undefined : paginado(items),
    isLoading: extra.isLoading ?? false,
    isError: extra.isError ?? false,
    refetch: vi.fn(),
    page: 1,
    pageSize: 25,
    sortBy: null,
    sortDirection: 'desc',
    filters: { competencia: '2026-08', clientId: null },
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
  })
}

function comoGerente() {
  mockUsePermissions.mockReturnValue({
    role: 'GERENTE',
    isCoordenadorOuAcima: true,
    isGerentePlus: true,
    isAtendente: false,
    isGestor: true,
    primaryTeamId: null,
    isAuthenticated: true,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  comoGerente()
  comLista([FECHADA, CORRENTE])
  comComparacao([])
})

describe('Tela de Competências — permissão (D10)', () => {
  it('COORDENADOR (não GerentePlus) vê o erro de permissão, e nenhuma competência', () => {
    mockUsePermissions.mockReturnValue({
      role: 'COORDENADOR',
      isCoordenadorOuAcima: true,
      isGerentePlus: false,
      isAtendente: false,
      isGestor: true,
      primaryTeamId: null,
      isAuthenticated: true,
    })
    render(<CompetenciasPage />)

    expect(screen.getByText(/não tem permissão/i)).toBeInTheDocument()
    expect(screen.queryByText('Agosto 2026')).not.toBeInTheDocument()
  })

  it('GERENTE vê a listagem — companheira positiva do caso acima', () => {
    render(<CompetenciasPage />)
    expect(screen.getByText('Agosto 2026')).toBeInTheDocument()
    expect(screen.queryByText(/não tem permissão/i)).not.toBeInTheDocument()
  })
})

describe('Tela de Competências — os três estados de UI', () => {
  it('carregando exibe skeleton', () => {
    comLista([], { isLoading: true })
    render(<CompetenciasPage />)
    expect(screen.getByLabelText('Carregando…')).toBeInTheDocument()
  })

  it('erro exibe ErrorState com retry funcional', async () => {
    const user = userEvent.setup()
    comLista([], { isError: true })
    render(<CompetenciasPage />)

    await user.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('lista vazia exibe EmptyState', () => {
    comLista([])
    render(<CompetenciasPage />)
    expect(screen.getByText('Nenhuma competência encontrada.')).toBeInTheDocument()
  })
})

describe('Tela de Competências — avisos vindos do ESTADO (C-6)', () => {
  /**
   * O aviso é buscado DENTRO da sua `<section aria-label>`, e não na tela toda: o mesmo
   * texto também aparece como motivo das ações bloqueadas da linha (o `sr-only` do
   * `BotaoDeAcao`), e uma busca global casaria os dois. Recorte fechado, dono único.
   */
  const avisoDe = (rotulo: string) => screen.queryByRole('region', { name: rotulo })

  it('com competência histórica na página, o aviso de C-6 aparece', () => {
    comLista([HISTORICA, FECHADA])
    render(<CompetenciasPage />)
    const aviso = avisoDe('Competências anteriores ao congelamento')
    expect(aviso).not.toBeNull()
    expect(aviso?.textContent).toMatch(/não existe snapshot dela/i)
  })

  it('sem competência histórica, o aviso NÃO aparece — e a tela continua montada', () => {
    // A companheira positiva impede que "não aparece" passe com a tela quebrada.
    comLista([FECHADA, CORRENTE])
    render(<CompetenciasPage />)
    expect(avisoDe('Competências anteriores ao congelamento')).toBeNull()
    expect(screen.getByText('Agosto 2026')).toBeInTheDocument()
  })

  it('estado que o painel não conhece produz aviso próprio — nunca silêncio', () => {
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => {})
    comLista([{ ...FECHADA, estado: 'mosaico' }])
    render(<CompetenciasPage />)
    const aviso = avisoDe('Competências com estado não reconhecido')
    expect(aviso?.textContent).toMatch(/não reconhece o estado desta competência/i)
    espiao.mockRestore()
  })

  it('sem estado desconhecido, esse aviso não aparece', () => {
    comLista([FECHADA, CORRENTE])
    render(<CompetenciasPage />)
    expect(avisoDe('Competências com estado não reconhecido')).toBeNull()
    expect(screen.getByText('Agosto 2026')).toBeInTheDocument()
  })
})

describe('Tela de Competências — fechar (D17)', () => {
  it('fechar uma competência ABERTA confirma antes e chama a mutation', async () => {
    const user = userEvent.setup()
    comLista([{ ...FECHADA, estado: 'aberta', fechadaEm: null }])
    render(<CompetenciasPage />)

    await user.click(screen.getByRole('button', { name: /^fechar competência Agosto 2026$/i }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText(/congela os números de todos os clientes/i)).toBeInTheDocument()

    await user.click(within(dialogo).getByRole('button', { name: 'Fechar competência' }))
    expect(mockFecharMutate).toHaveBeenCalledTimes(1)
    expect(mockFecharMutate.mock.calls[0][0]).toBe('2026-08')
  })

  it('numa competência REABERTA o diálogo fala de REFECHAR e de versão nova (§6.5)', async () => {
    const user = userEvent.setup()
    comLista([{ ...FECHADA, estado: 'reaberta', fechadaEm: null, reabertaEm: '2026-09-02T12:00:00Z' }])
    render(<CompetenciasPage />)

    await user.click(screen.getByRole('button', { name: /refechar competência Agosto 2026/i }))
    const dialogo = screen.getByRole('dialog')
    expect(within(dialogo).getByText(/nova versão do snapshot/i)).toBeInTheDocument()
    // 🔴 C-8: nem aqui a tela sugere correção automática de crédito.
    expect(within(dialogo).getByText(/apenas reportados/i)).toBeInTheDocument()
    expect(dialogo.textContent).not.toMatch(/corrigid[oa]s? automaticamente/i)
  })
})

describe('Tela de Competências — reabrir (C-8)', () => {
  it('abre o diálogo de impacto e envia a confirmação junto com o motivo', async () => {
    const user = userEvent.setup()
    render(<CompetenciasPage />)

    await user.click(screen.getByRole('button', { name: /reabrir competência Agosto 2026/i }))
    await user.type(screen.getByLabelText(/motivo da reabertura/i), 'Fatura reprocessada')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /^reabrir competência$/i }))

    await waitFor(() => expect(mockReabrirMutate).toHaveBeenCalledTimes(1))
    expect(mockReabrirMutate.mock.calls[0][0]).toEqual({
      competencia: '2026-08',
      motivo: 'Fatura reprocessada',
      confirmarImpactoEmCreditos: true,
    })
  })

  it('o 409 do servidor é renderizado DENTRO do diálogo, que continua aberto', async () => {
    // Estado de negócio, não toast: é o 409 que traz a contagem de créditos dependentes.
    const user = userEvent.setup()
    mockReabrirMutate.mockImplementation(
      (
        _vars: unknown,
        opcoes: { onError?: (erro: unknown) => void },
      ) => {
        opcoes.onError?.({
          isAxiosError: true,
          response: {
            status: 409,
            data: {
              error: {
                code: 'COMPETENCIA_COM_CREDITOS_DEPENDENTES',
                message: '3 créditos vivos dependem desta competência.',
              },
            },
          },
        })
      },
    )
    render(<CompetenciasPage />)

    await user.click(screen.getByRole('button', { name: /reabrir competência Agosto 2026/i }))
    await user.type(screen.getByLabelText(/motivo da reabertura/i), 'Fatura reprocessada')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /^reabrir competência$/i }))

    const alerta = await screen.findByRole('alert')
    expect(alerta).toHaveTextContent('3 créditos vivos dependem desta competência.')
    expect(alerta).toHaveTextContent('Marque a confirmação de impacto')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Tela de Competências — comparação de auditoria (D12)', () => {
  const ITEM: BillingPeriodComparisonItemDto = {
    clientId: 1,
    clienteNome: 'Acme',
    snapshot: { horasUsadas: 2.75, planoBaseHoras: 15, creditoHoras: 2, planoEfetivoHoras: 17 },
    aoVivo: { horasUsadas: 9.5, planoBaseHoras: 15, creditoHoras: 2, planoEfetivoHoras: 17 },
    temDivergencia: true,
    camposDivergentes: ['horasUsadas'],
  }

  it('a comparação só monta depois do clique em "comparar"', async () => {
    const user = userEvent.setup()
    comComparacao([ITEM])
    render(<CompetenciasPage />)

    expect(screen.queryByText(/Snapshot × cálculo atual/)).not.toBeInTheDocument()
    // Rótulo COMPLETO (com o mês): as duas linhas têm botão "comparar", e o da corrente
    // está bloqueado — clicar no errado provaria outra coisa.
    await user.click(
      screen.getByRole('button', {
        name: 'comparar snapshot e cálculo atual da competência Agosto 2026',
      }),
    )
    expect(screen.getByText(/Snapshot × cálculo atual — Agosto 2026/)).toBeInTheDocument()
  })

  it('`?competencia=2026-08&comparar=1` abre a comparação já montada (AP-FRONTEND-019)', () => {
    // O botão do Consumo de Planos navega para cá com estes parâmetros. Sem a leitura no
    // destino, ele "funcionaria" e a tela abriria como se nada tivesse sido pedido.
    comComparacao([ITEM])
    render(<CompetenciasPage competenciaInicial="2026-08" compararInicial />)
    expect(screen.getByText(/Snapshot × cálculo atual — Agosto 2026/)).toBeInTheDocument()
  })

  it('`?competencia` sem `comparar=1` NÃO abre a comparação', () => {
    comComparacao([ITEM])
    render(<CompetenciasPage competenciaInicial="2026-08" />)
    expect(screen.queryByText(/Snapshot × cálculo atual/)).not.toBeInTheDocument()
  })

  it('a célula divergente mostra os DOIS valores; as demais, só o do snapshot', async () => {
    const user = userEvent.setup()
    comComparacao([ITEM])
    render(<CompetenciasPage competenciaInicial="2026-08" compararInicial />)

    const divergente = screen.getByLabelText(
      'Horas usadas: 2h 45m no snapshot, 9h 30m no cálculo atual — divergente',
    )
    expect(divergente).toHaveAttribute('data-divergente', 'true')
    // Cardinalidade assimétrica: uma célula marcada, as outras não.
    expect(screen.getAllByText('15h 0m')).toHaveLength(1)
    expect(screen.queryAllByLabelText(/divergente$/)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: /fechar comparação/i }))
    expect(screen.queryByText(/Snapshot × cálculo atual/)).not.toBeInTheDocument()
  })

  it('campo `null` na comparação vira travessão na CÉLULA — nunca "0h 0m"', () => {
    // A companheira COMPORTAMENTAL do caso puro de `formatarCampoComparado`: prova que o
    // guard sobrevive até o DOM. Trocar `== null` por `=== undefined` faz esta célula
    // exibir "0h 0m" — afirmando ZERO sobre um valor que o servidor não informou
    // (`AP-FRONTEND-028`).
    comComparacao([
      {
        clientId: 1,
        clienteNome: 'Acme',
        snapshot: { planoBaseHoras: 15, horasUsadas: null, percentualPlano: null },
        aoVivo: { planoBaseHoras: 15, horasUsadas: null, percentualPlano: null },
        temDivergencia: false,
        camposDivergentes: [],
      },
    ])
    render(<CompetenciasPage competenciaInicial="2026-08" compararInicial />)

    const linha = screen.getByText('Acme').closest('tr')
    expect(linha).not.toBeNull()
    const celulas = Array.from(linha?.querySelectorAll('td') ?? []).map((td) => td.textContent)
    // Cliente, Divergência, e as nove colunas do contrato — literal escrito à mão.
    expect(celulas).toEqual([
      'Acme',
      'Não',
      '15h 0m',
      '—',
      '—',
      '—',
      '—',
      '—',
      '—',
      '—',
      '—',
    ])
  })

  it('comparação vazia mostra EmptyState próprio, não a tabela', () => {
    comComparacao([])
    render(<CompetenciasPage competenciaInicial="2026-08" compararInicial />)
    expect(screen.getByText(/Nenhum cliente para comparar/i)).toBeInTheDocument()
  })

  it('erro na comparação não derruba a listagem principal', () => {
    comComparacao([], { isError: true })
    render(<CompetenciasPage competenciaInicial="2026-08" compararInicial />)
    expect(screen.getByText(/Não foi possível carregar a comparação/i)).toBeInTheDocument()
    expect(screen.getByText('Agosto 2026')).toBeInTheDocument()
  })
})

describe('Tela de Competências — contraste medido no DOM (AA é piso)', () => {
  it('nenhum texto da tela reprova 4,5:1 — e as frases-chave FORAM medidas', () => {
    // `reprovacoesAA([]) === []` passa por vacuidade quando a varredura não alcança a tela.
    // As duas travas contra isso: `pulados` vazio (nada foi pulado por não saber medir) e
    // `razaoDoTexto`, que **lança** quando a frase não é encontrada.
    //
    // ⚠️ `AP-FRONTEND-030`: o medidor TRUNCA o texto do nó em 60 caracteres. Os avisos
    // desta tela são longos, então cada asserção usa o **prefixo** — a frase inteira nunca
    // casaria, `classesDoTexto`/`fundoDoTexto` devolveriam `[]` em silêncio, e só
    // `razaoDoTexto` reprovaria. É ela que está aqui, de propósito.
    comLista([HISTORICA, FECHADA, { ...FECHADA, competencia: '2026-06', estado: 'reaberta' }])
    render(<CompetenciasPage />)

    const { medidas, pulados } = varrer(document.body)

    expect(pulados).toEqual([])
    expect(reprovacoesAA(medidas)).toEqual([])
    // Os números, frase a frase (prefixos dentro do limite de 60 do medidor).
    expect(razaoDoTexto(medidas, 'Competência anterior ao início do congelamento')).toBeGreaterThanOrEqual(4.5)
    expect(razaoDoTexto(medidas, 'Cada competência é um mês de faturamento')).toBeGreaterThanOrEqual(4.5)
    expect(razaoDoTexto(medidas, 'Agosto 2026')).toBeGreaterThanOrEqual(4.5)
    // O motivo de uma ação bloqueada é texto que o leitor de tela anuncia — mede junto.
    expect(razaoDoTexto(medidas, 'Esta competência já está fechada.')).toBeGreaterThanOrEqual(4.5)
    expect(
      razaoDoTexto(medidas, 'Só uma competência fechada pode ser reaberta'),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('a célula divergente da comparação é legível — e não comunica só por cor', () => {
    comComparacao([
      {
        clientId: 1,
        clienteNome: 'Acme',
        snapshot: { horasUsadas: 2.75 },
        aoVivo: { horasUsadas: 9.5 },
        temDivergencia: true,
        camposDivergentes: ['horasUsadas'],
      },
    ])
    render(<CompetenciasPage competenciaInicial="2026-08" compararInicial />)

    const { medidas, pulados } = varrer(document.body)
    expect(pulados).toEqual([])
    expect(reprovacoesAA(medidas)).toEqual([])
    // WCAG 1.4.1: a divergência não é comunicada só por cor. Os DOIS valores aparecem no
    // texto (e é esse texto que a medição alcança), e o glifo `≠` reforça visualmente —
    // ele é `aria-hidden` de propósito, porque quem carrega o significado para o leitor de
    // tela é o `aria-label` completo da célula. Por isso a medição é do texto, não do glifo.
    expect(razaoDoTexto(medidas, '2h 45m / 9h 30m')).toBeGreaterThanOrEqual(4.5)
    const celula = screen.getByText(/2h 45m \/ 9h 30m/).closest('[data-divergente]')
    expect(celula?.querySelector('[aria-hidden="true"]')?.textContent).toBe('≠')
  })
})
