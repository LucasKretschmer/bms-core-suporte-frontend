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
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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
 * 🔴 **132/F1 (D7)** — este mock tinha DUAS entradas a mais (`listBillingExceptions` e
 * `getBillingExceptionsSummary`), porque a página renderizava o card de exceções de
 * faturamento, que fazia requisição própria. O card foi removido: com
 * `TimeEntry.InicioEm` como competência (D1), a hora é faturada no mês em que foi
 * apontada — chamado aberto ou fechado —, logo "chamado fora de qualquer fatura" deixou
 * de ser um conjunto.
 *
 * O que **sobreviveu** da 121/A2 é o motivo do slot (§5.3): a ajuda vai em `banner`, e
 * não em `children`, para não desaparecer quando a listagem volta vazia, falha ou está
 * carregando. É o único invariante daquele bloco que a 132 não revoga, e ele continua
 * travado abaixo — agora medido pela NOTA, que é o que o `(?)` ainda hospeda.
 */
vi.mock('../shared/services/reportsService', () => ({
  listPlanConsumption: vi.fn(),
  listSupportPlans: vi.fn().mockResolvedValue([]),
}))

/**
 * 🔴 **132/F4c — mock PARCIAL, e o parcial é o ponto.**
 *
 * Só `exportToCsv`/`exportToXlsx` são espionados; `durationCellFromHours` e o resto do módulo
 * seguem **reais** (`importOriginal`). Mockar o módulo inteiro faria o helper de conversão
 * devolver `undefined` e o teste passaria a medir o mock, não o mapper — o defeito clássico de
 * expectativa derivada da própria resposta.
 */
vi.mock('../shared/utils/exportTable', async (importOriginal) => {
  const real = await importOriginal<typeof import('../shared/utils/exportTable')>()
  return { ...real, exportToCsv: vi.fn(), exportToXlsx: vi.fn() }
})

/** Permissões: o botão "Comparar com o cálculo atual" é `GerentePlus` (D12). */
const permissoes = { isGerentePlus: true, isAtendente: false, isGestor: true, primaryTeamId: null }
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => permissoes,
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
import {
  PLAN_CONSUMPTION_EXPORT_COLUMNS,
  nomeDoArquivoDeExport,
} from './index'
import { TEXTO_COMPETENCIA_VS_SAUDE_PLANOS } from '../shared/utils/competenciaTexts'
import {
  LABEL_FILTRO_USO_DO_PLANO,
  LABEL_USO_DO_PLANO_DENTRO,
  LABEL_USO_DO_PLANO_FORA,
  LABEL_USO_DO_PLANO_RISCO,
  LABEL_USO_DO_PLANO_TODOS,
  TOOLTIP_FILTRO_USO_DO_PLANO,
} from './usoDoPlanoTextos'
import type { FaixaUsoDoPlano } from './usoDoPlanoTextos'
import { usePlanConsumption } from './hooks/usePlanConsumption'
import { listPlanConsumption, listSupportPlans } from '../shared/services/reportsService'
import { exportToCsv } from '../shared/utils/exportTable'

const mockedUsePlanConsumption = vi.mocked(usePlanConsumption)

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
/**
 * 🔴 **132/F4d — `envelope` existe para que a TELA nunca decida a fonte.**
 * O teste mocka **payloads diferentes**; se alguém escrever a inferência por data no front, é
 * o teste estrutural `fonteDoPeriodo.estrutural.test.ts` que reprova, não este.
 */
type EnvelopeDeTeste = {
  fonte?: string | null
  competencia?: string | null
  competenciaFechadaEm?: string | null
  competenciaVersao?: number | null
  avisoPeriodoNaoMensal?: boolean | null
  avisoAnteriorAoCongelamento?: boolean | null
}

function mockListagem(
  periodo: { from: string | null; to: string | null },
  estado: {
    isLoading?: boolean
    isError?: boolean
    vazio?: boolean
    envelope?: EnvelopeDeTeste
    linha?: PlanConsumptionItemDto
    /**
     * 🔴 **135/G5 — a seleção do filtro "Uso do plano", e ela é o ESTADO ANTERIOR.**
     *
     * `[]` (o default) significa "todos". É este valor que a tela passa como `anterior` a
     * `normalizarSelecaoUsoDoPlano` — e é só por ele que os dois cliques de G2 se
     * distinguem, porque o combobox devolve o mesmo CONTEÚDO nos dois casos.
     */
    usoPlano?: FaixaUsoDoPlano[]
  } = {},
) {
  // Devolvido ao caso de teste: é onde a decisão do filtro (G2) fica observável, já que o
  // hook está mockado e o estado não volta para cá.
  const setFilters = vi.fn()

  mockedUsePlanConsumption.mockReturnValue({
    data: {
      items: estado.vazio ? [] : [estado.linha ?? clientRow],
      totalCount: estado.vazio ? 0 : 1,
      page: 1,
      pageSize: 25,
      totalPages: estado.vazio ? 0 : 1,
      ...(estado.envelope ?? {}),
    },
    isLoading: estado.isLoading ?? false,
    isError: estado.isError ?? false,
    refetch: vi.fn(),
    sortBy: null,
    sortDirection: 'desc',
    /**
     * 🔴 **`usoPlano` é OBRIGATÓRIO aqui, e o cast acima é justamente o que deixa este
     * mock mentir sem erro de tipo** (`135/analise-frontend.md` §7.4). Sem o campo,
     * `valorExibidoUsoDoPlano(undefined)` estoura em `.length` na 1ª render e **todos** os
     * casos deste arquivo morrem no `render`. A correção é o MOCK — tornar a função
     * tolerante a `undefined` para "os testes passarem" seria afrouxar produção para
     * acomodar fixture errado.
     */
    filters: { search: '', planId: null, usoPlano: estado.usoPlano ?? [], ...periodo },
    page: 1,
    pageSize: 25,
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters,
    resetFilters: vi.fn(),
  } as unknown as ReturnType<typeof usePlanConsumption>)

  return { setFilters }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListagem({ from: null, to: null })
  vi.mocked(listSupportPlans).mockResolvedValue([])
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
 * ⚠️ **REESCRITO DUAS VEZES, e as duas por decisão registrada.**
 *
 * 1. **127/FE-AJUDA (08/09/2026)** — a nota de competência e o card de exceções, que
 *    ocupavam o topo da tela, passaram a ficar **recolhidos atrás do `(?)`** (decisão do
 *    usuário, olhando a tela): os dois juntos empurravam a tabela para baixo.
 * 2. 🔴 **132/F1 (D7, 09/09/2026)** — o **card de exceções foi removido**. Com
 *    `TimeEntry.InicioEm` como competência (132/D1), a hora é faturada no mês em que foi
 *    apontada, chamado aberto ou fechado, e "chamado fora de qualquer fatura" deixou de
 *    ser um conjunto. Saíram com ele os 6 casos que asseveravam o **indicador** do
 *    gatilho (`data-estado`, o selo, e os nomes acessíveis dos quatro estados).
 *
 * ## O que sobrou aqui, e por que este bloco não foi apagado inteiro
 *
 * Um invariante só, e é o da §5.3 da análise da 121/A2, que a 132 **não** revoga: **a
 * ajuda vive no slot `banner`, nunca em `children`.** `ReportPageLayout` só renderiza
 * `children` no estado "com dados", então o `(?)` desapareceria justamente quando a
 * listagem voltasse vazia, falhasse ou estivesse carregando — que é exatamente o momento
 * em que o usuário quer saber QUAL período a tela está contando.
 *
 * ⚠️ **A companheira positiva é obrigatória e está dentro de cada caso:** não basta "o
 * gatilho existe" (isso passaria com um botão inerte), é preciso **abrir** e ver a nota.
 * A prova detalhada do disclosure é de `PlanConsumptionHelp.test.tsx`; aqui o sujeito é a
 * PÁGINA — que ela escolheu o slot certo.
 */
describe('PlanConsumptionPage — a ajuda sobrevive aos estados da LISTAGEM (§5.3)', () => {
  function gatilhoDaAjuda(): HTMLElement {
    return screen.getByTestId('ajuda-gatilho')
  }

  it('FECHADO por padrão — é o que devolve o espaço à tabela', async () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()

    await waitFor(() => expect(gatilhoDaAjuda()).toBeInTheDocument())
    expect(gatilhoDaAjuda()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Como o período é contado aqui')).not.toBeInTheDocument()
  })

  it('🔴 não sobrou nada do card de exceções na página (132/D7)', async () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()

    await waitFor(() => expect(gatilhoDaAjuda()).toBeInTheDocument())
    fireEvent.click(gatilhoDaAjuda())

    // Companheira POSITIVA primeiro: o painel abriu de verdade. Sem ela, as três
    // negativas abaixo seriam satisfeitas por um disclosure que não renderizou nada
    // (`rules/tests.md` § padrão 1 — asserção negativa é satisfeita pelo vazio).
    expect(screen.getByText('Como o período é contado aqui')).toBeInTheDocument()

    expect(
      screen.queryByRole('region', { name: 'Exceções de faturamento' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conferir/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('ajuda-selo')).not.toBeInTheDocument()
  })

  it.each([
    ['VAZIA', { vazio: true }],
    ['em ERRO', { isError: true }],
    ['CARREGANDO', { isLoading: true }],
  ])(
    'com a listagem %s o (?) continua na tela E a nota continua a um clique',
    async (_estado, flags) => {
      mockListagem({ from: '2026-07-01', to: '2026-07-31' }, flags)
      renderPage()

      // (1) o gatilho sobrevive ao estado da listagem (slot `banner`, não `children`)…
      await waitFor(() => expect(gatilhoDaAjuda()).toBeInTheDocument())
      // (2) …e abrir revela a explicação, que é o conteúdo que ele ainda hospeda.
      fireEvent.click(gatilhoDaAjuda())
      expect(
        screen.getByText('Mostrando as horas apontadas entre 01/07/2026 e 31/07/2026.'),
      ).toBeInTheDocument()
    },
  )

  /**
   * 🔴 **Reescrito pela 135/§5.3 — a frase anterior ficou FALSA, não obsoleta.**
   * Ela dizia *"Nenhum cliente **com plano** encontrado…"*, e "Fora do Plano" inclui, por
   * G3, o cliente **sem plano**: a tela afirmaria o oposto do recorte pedido. O caso não
   * foi apagado — a asserção agora afirma o texto novo.
   */
  it('com a listagem VAZIA, a mensagem de vazio e o (?) convivem', async () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' }, { vazio: true })
    renderPage()

    expect(
      screen.getByText('Nenhum cliente encontrado para os filtros selecionados.'),
    ).toBeInTheDocument()
    // A afirmação falsa não voltou por outro caminho (ex.: default do layout).
    expect(screen.queryByText(/cliente com plano/i)).not.toBeInTheDocument()
    await waitFor(() => expect(gatilhoDaAjuda()).toBeInTheDocument())
  })
})

// ── 123/FAT-1 — nota de competência na tela ──────────────────────────────────

/**
 * O relato B2 ("o apontamento correto do consumo aparece apenas fora da tela") é o recorte
 * por data de CONCLUSÃO, vigente desde a 121, sem nada na UI declarando-o. A nota existe
 * para fechar essa lacuna, e precisa de duas propriedades:
 *  1. usar o período REAL da tela (a mesma fonte da tabela e do export), não um congelado;
 *  2. sobreviver aos estados da LISTAGEM — a lista volta zerada justamente quando o chamado
 *     fechou em outra competência, que é o momento em que a explicação é necessária.
 *
 * ⚠️ **REESCRITO EM 127/FE-AJUDA.** A propriedade 2 dizia, até aqui, "a nota fica **visível**
 * em vazio/erro/loading". Ela passou a ficar **recolhida atrás do `(?)`** (decisão do
 * usuário): o que sobrevive aos estados da listagem é o **gatilho**, e a nota está a um
 * clique dele em todos eles — que é o que estes casos passaram a exigir, abrindo o `(?)`
 * em cada estado em vez de só procurar o texto na tela.
 *
 * O que deixa cada asserção VERMELHA: mover o `(?)` para `children` (some no vazio/erro/
 * loading), passar `initialFrom`/data fixa em vez de `filters`, ou remover a nota de dentro
 * do conteúdo recolhido.
 */
describe('PlanConsumptionPage — nota de competência (123/FAT-1)', () => {
  function abrirAjuda() {
    fireEvent.click(screen.getByTestId('ajuda-gatilho'))
  }

  it('FECHADA por padrão — é o que devolve o espaço à tabela', () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()

    expect(screen.queryByText('Como o período é contado aqui')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Mostrando as horas apontadas entre 01/07/2026 e 31/07/2026.'),
    ).not.toBeInTheDocument()
  })

  it('declara o recorte pela data do APONTAMENTO, com o período FILTRADO (132/D1)', () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()
    abrirAjuda()

    expect(
      screen.getByText('Mostrando as horas apontadas entre 01/07/2026 e 31/07/2026.'),
    ).toBeInTheDocument()
    // 🔴 132/D1 — literal escrito à mão, invertido no mesmo commit que inverteu a regra. O
    // literal antigo era `'O chamado conta no período em que foi concluído — não no período
    // em que as horas foram apontadas.'`; deixá-lo aqui faria a suíte DEFENDER a regra
    // revogada, e o autor da correção veria vermelho ao acertar.
    expect(
      screen.getByText(
        'A hora conta no período em que foi apontada — não no período em que o chamado foi concluído.',
      ),
    ).toBeInTheDocument()
    // Companheira negativa: a frase antiga não sobreviveu em nenhuma dobra da ajuda.
    expect(
      screen.queryByText(/O chamado conta no período em que foi concluído/i),
    ).not.toBeInTheDocument()
  })

  it('a frase acompanha OUTRO período (não é um literal fixo na tela)', () => {
    // Dois períodos distintos, com números diferentes: um texto hardcoded passaria no
    // primeiro caso e cairia aqui.
    mockListagem({ from: '2026-08-01', to: '2026-08-31' })
    renderPage()
    abrirAjuda()

    expect(
      screen.getByText('Mostrando as horas apontadas entre 01/08/2026 e 31/08/2026.'),
    ).toBeInTheDocument()
  })

  /**
   * 🔴 131 (08/09/2026) — este caso travava, com literal, a frase
   * *"Apontamento de projeto não tem chamado e, por isso, continua contando pela data do
   * próprio apontamento."* Ela era verdadeira sobre a coluna de horas DESTA tela até a
   * decisão do usuário; depois dela, induz ao erro — aqui a hora de projeto não entra na
   * conta do plano por data nenhuma (`ReportQueryRepository.cs:777-785`).
   *
   * O teste não foi apagado: passou a afirmar a redação nova, com o literal novo, e ficou
   * MAIS específico — nega explicitamente a frase antiga nesta tela.
   */
  it('🔴 131: declara que PROJETO não consome o plano — e a frase antiga não volta', () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()
    abrirAjuda()

    expect(
      screen.getByText(
        'Apontamento de projeto não consome o plano de suporte: projeto é contratado à parte. Ele continua registrado e continua faturável — só não entra na conta do plano (horas usadas, restantes, adicionais e percentual). O que ainda aparece de projeto nesta tela são as horas marcadas para cobrar fora do plano, contadas pela data do próprio apontamento. Cliente que só teve projeto no período continua na lista, com zero hora usada do plano.',
      ),
    ).toBeInTheDocument()

    // A frase antiga, verbatim, não pode voltar a aparecer NESTA tela — ela continua
    // válida (e continua sendo asseverada) no Relatório do Cliente, que a 131 não tocou.
    expect(
      screen.queryByText(
        'Apontamento de projeto não tem chamado e, por isso, continua contando pela data do próprio apontamento.',
      ),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['VAZIA', { vazio: true }],
    ['em ERRO', { isError: true }],
    ['CARREGANDO', { isLoading: true }],
  ])('continua alcançável pelo (?) com a listagem %s', (_estado, flags) => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' }, flags)
    renderPage()
    // O gatilho existe nos três estados — é isso que o slot `banner` garante.
    abrirAjuda()

    expect(
      screen.getByText('Mostrando as horas apontadas entre 01/07/2026 e 31/07/2026.'),
    ).toBeInTheDocument()
  })

  it('sem datas filtradas, diz que o período é o mês atual — nunca "todos"', () => {
    // O backend não abre a janela: `FusoSaoPaulo.Resolver:152-159` fecha as duas pontas no
    // mês local. "Mostrando todos" seria uma afirmação falsa sobre o recorte.
    mockListagem({ from: null, to: null })
    renderPage()
    abrirAjuda()

    expect(
      screen.getByText('Sem datas preenchidas: mostrando as horas apontadas no mês atual.'),
    ).toBeInTheDocument()
  })
})

describe('PlanConsumptionPage — rótulo × Saúde dos Planos (123/D-14)', () => {
  // 123/FE-FIX3 (F-4): a frase era copiada à mão aqui e ficou defasada quando o texto
  // ganhou a SEGUNDA causa da divergência. Passa a vir da constante — uma fonte só.
  // O irmão com LITERAL escrito à mão vive em `competenciaTexts.test.ts`, que asserta o
  // conteúdo da frase; aqui o que se prova é que a PÁGINA a renderiza.
  const FRASE_SAUDE = TEXTO_COMPETENCIA_VS_SAUDE_PLANOS

  function abrirAjuda() {
    fireEvent.click(screen.getByTestId('ajuda-gatilho'))
  }

  it('explica por que o gráfico do painel mostra outro número', () => {
    // Vermelho se a página parar de passar `comparaSaudePlanos` — e é a página, não a nota,
    // quem decide (o Relatório do Cliente usa a MESMA nota e não deve trazer esta frase).
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()
    abrirAjuda()

    expect(screen.getByText(FRASE_SAUDE)).toBeInTheDocument()
  })

  it.each([
    ['VAZIA', { vazio: true }],
    ['em ERRO', { isError: true }],
    ['CARREGANDO', { isLoading: true }],
  ])('a explicação continua a um clique do (?) com a listagem %s', (_estado, flags) => {
    // É justamente quando a tela volta zerada que o usuário conclui "os números não batem".
    mockListagem({ from: '2026-07-01', to: '2026-07-31' }, flags)
    renderPage()
    abrirAjuda()

    expect(screen.getByText(FRASE_SAUDE)).toBeInTheDocument()
  })
})


// ─── 131 (08/09/2026) — a tela deixou de dizer que soma horas de projeto ──────

describe('PlanConsumptionPage — projeto fora do plano (131)', () => {
  function abrirAjuda() {
    fireEvent.click(screen.getByTestId('ajuda-gatilho'))
  }

  /**
   * Vítima de COMPONENTE com literal escrito à mão — os testes acima comparam com a
   * constante e continuariam verdes se alguém reescrevesse a constante de volta. Aqui os
   * fragmentos são digitados a partir da redação decidida em 08/09/2026, então restaurar a
   * frase antiga no módulo de textos deixa ESTE arquivo vermelho.
   */
  it('🔴 o (?) NÃO afirma mais que esta tela soma as horas de projeto', () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()
    abrirAjuda()

    // Companheira positiva obrigatória na MESMA execução: o painel abriu de verdade.
    // Sem ela, "não vejo a frase antiga" seria satisfeito por um painel que não renderizou.
    expect(
      screen.getByText(/O gráfico Saúde dos Planos, no painel, conta as horas pela mesma data/i),
    ).toBeInTheDocument()

    expect(screen.queryByText(/soma também as horas de projeto/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Por essas duas razões/i)).not.toBeInTheDocument()
  })

  it('🔴 o (?) afirma que projeto não consome o plano — e que continua faturável', () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()
    abrirAjuda()

    expect(
      screen.getByText(/Apontamento de projeto não consome o plano de suporte/i),
    ).toBeInTheDocument()
    // ⚠️ O erro do outro lado: um texto que sugerisse "projeto não é mais cobrado" seria
    // pior que o antigo. Ele continua registrado e continua faturável.
    expect(screen.getByText(/continua registrado e continua faturável/i)).toBeInTheDocument()
    expect(screen.queryByText(/não é mais cobrad/i)).not.toBeInTheDocument()
  })

  /**
   * 🔴 **INVERTIDO em 132/D1 + R-12.** Este caso exigia que a ajuda nomeasse **duas datas
   * diferentes** como a razão que "permanece". Ela deixou de permanecer: os dois lados
   * recortam por `te.InicioEm` (`MetricsQueryRepository.cs:1465-1474` ×
   * `ReportQueryRepository.cs:900-914`, predicados idênticos).
   *
   * A razão que entrou no lugar é o **crédito de horas**: `plan-consumption` mede o plano
   * efetivo, `plan-health` só o contratado e não conhece crédito (132/R-12, com gatilho de
   * reabertura nomeado em `MetricsDtos.cs:137-148`).
   */
  it('🔴 132: o (?) diz que a data é a MESMA, e nomeia o crédito e a lista como as razões', () => {
    mockListagem({ from: '2026-07-01', to: '2026-07-31' })
    renderPage()
    abrirAjuda()

    const comparacao = screen.getByText(
      /O gráfico Saúde dos Planos, no painel, conta as horas pela mesma data/i,
    )
    // Positivas.
    expect(comparacao).toHaveTextContent('a do apontamento')
    expect(comparacao).toHaveTextContent('Crédito de Suporte')
    expect(comparacao).toHaveTextContent('soma o crédito da competência')
    // A razão de lista, que sobreviveu às duas demandas (`:1459` × `:819-831`).
    expect(comparacao).toHaveTextContent('só clientes com plano contratado')
    expect(comparacao).toHaveTextContent('lista também cliente sem plano')
    // Negativa, com a positiva acima como companheira na mesma execução.
    expect(comparacao).not.toHaveTextContent('data em que o chamado foi concluído')
  })
})

// ─── 132/F4b — o ⓘ do crédito DENTRO de uma linha clicável (precedente novo) ──

/**
 * 🔴 **Precedente novo no repo, e é por isso que estes dois casos existem.** Varridos os 16
 * consumidores do `InfoIcon`, nenhum o usava dentro de **célula** de `DataTable` — todos em
 * `<th>` via `headerInfo`, em `KpiCard`, em `Modal` ou em bloco de filtro. E a linha da
 * `DataTable` é `role="button"` com `tabIndex={0}` (`DataTable.tsx:100-101`), logo o clique no
 * ⓘ borbulharia e abriria o drawer do cliente.
 */
describe('PlanConsumptionPage — o ⓘ do crédito na linha clicável (132/F4b)', () => {
  const linhaComCredito = {
    ...clientRow,
    qtdePlanoHoras: 15,
    creditoHoras: 2,
  } as unknown as PlanConsumptionItemDto

  it('🔴 clicar no ⓘ do crédito NÃO abre o drawer do cliente', () => {
    mockListagem({ from: '2026-08-01', to: '2026-08-31' }, { linha: linhaComCredito })
    renderPage()

    // Companheira positiva: o ⓘ está lá (a negativa não passa por ausência do botão).
    const info = screen
      .getAllByRole('button')
      .find((b) => b.getAttribute('aria-label')?.includes('Crédito de Suporte'))
    expect(info).toBeDefined()

    fireEvent.click(info!)

    // Nenhum diálogo aberto — o `stopPropagation`/`preventDefault` do `InfoIcon` cobre o
    // caminho do clique dentro da linha.
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a linha continua abrindo o drawer (o controle positivo do assert acima)', () => {
    mockListagem({ from: '2026-08-01', to: '2026-08-31' }, { linha: linhaComCredito })
    renderPage()

    // Se este caso não existisse, o de cima passaria numa tela em que NADA abre o drawer.
    openDrawer()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('a célula mostra `15h + 2h` na tabela renderizada (D11/D21, ponta a ponta)', () => {
    mockListagem({ from: '2026-08-01', to: '2026-08-31' }, { linha: linhaComCredito })
    renderPage()

    const celula = screen.getByTestId('plano-credito')
    expect(celula).toHaveTextContent('+ 2h')
    expect(celula.parentElement?.textContent).toContain('15h')
    // O reforço não-cromático chega ao DOM da tabela, não só ao do componente isolado.
    expect(screen.getByText('mais 2h de Crédito de Suporte')).toBeInTheDocument()
  })
})

// ─── 132/F4d — o selo de fonte vem do PAYLOAD, com dois payloads distintos ────

describe('PlanConsumptionPage — aviso de fonte no banner (D12)', () => {
  it('payload de mês fechado ⇒ selo; payload de período personalizado ⇒ a outra frase', () => {
    // Dois payloads DIFERENTES para o mesmo tipo de período: é o que prova que a tela não
    // decide nada. Um texto derivado das datas passaria no primeiro e cairia aqui.
    mockListagem(
      { from: '2026-08-01', to: '2026-08-31' },
      {
        envelope: {
          fonte: 'snapshot',
          competencia: '2026-08',
          competenciaFechadaEm: '2026-09-01T03:00:00Z',
        },
      },
    )
    const primeira = renderPage()
    expect(screen.getByText('Competência fechada')).toBeInTheDocument()
    primeira.unmount()

    mockListagem(
      { from: '2026-08-01', to: '2026-08-30' },
      { envelope: { fonte: 'aovivo', avisoPeriodoNaoMensal: true } },
    )
    renderPage()
    expect(
      screen.getByText(
        'Período personalizado: números calculados ao vivo, podem divergir do que foi faturado.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Competência fechada')).toBeNull()
  })

  it('🔴 sem `fonte` no wire (backend anterior à 132) a tela fica como HOJE', () => {
    // É o estado atual de produção: 132/B11 não entregue. Nenhum selo, nenhuma frase — e o
    // `(?)` continua lá, que é a companheira positiva de "não renderizou nada de fonte".
    mockListagem({ from: '2026-08-01', to: '2026-08-31' })
    renderPage()

    expect(screen.queryByText('Competência fechada')).toBeNull()
    expect(screen.queryByText(/Período personalizado/)).toBeNull()
    expect(screen.queryByRole('region', { name: 'Origem dos números desta tela' })).toBeNull()
    expect(screen.getByRole('button', { name: /Ajuda/i })).toBeInTheDocument()
  })

  it('o aviso sobrevive à listagem VAZIA (é slot `banner`, não `children`)', () => {
    mockListagem(
      { from: '2026-08-01', to: '2026-08-31' },
      { vazio: true, envelope: { fonte: 'snapshot', competencia: '2026-08' } },
    )
    renderPage()

    // O `ReportPageLayout` só renderiza `children` no estado "com dados": em `children`, o
    // aviso desapareceria justamente quando o usuário pergunta de onde vem o zero.
    expect(screen.getByText('Competência fechada')).toBeInTheDocument()
  })
})

// ─── 132/F4c — o wiring do export (as funções puras têm dono na tela) ─────────

describe('PlanConsumptionPage — o botão de export usa as colunas e o nome novos', () => {
  it('🔴 "Baixar CSV" chama exportToCsv com o nome derivado da FONTE e as 14 colunas', async () => {
    // Prova de ALCANCE: sem este caso, `PLAN_CONSUMPTION_EXPORT_COLUMNS` e
    // `nomeDoArquivoDeExport` poderiam estar corretos e mortos — testados em
    // `index.export.test.ts` e nunca usados pela tela.
    mockListagem(
      { from: '2026-08-01', to: '2026-08-31' },
      { envelope: { fonte: 'snapshot', competencia: '2026-08' } },
    )
    vi.mocked(listPlanConsumption).mockResolvedValue({
      items: [{ ...clientRow, creditoHoras: 2 } as unknown as PlanConsumptionItemDto],
      totalCount: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
      fonte: 'snapshot',
      competencia: '2026-08',
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))

    await waitFor(() => expect(exportToCsv).toHaveBeenCalledTimes(1))

    const [nome, colunas, linhas] = vi.mocked(exportToCsv).mock.calls[0]!
    // Literal escrito à mão — não `nomeDoArquivoDeExport(...)`, que seria a expectativa
    // derivada da própria implementação (tautologia).
    expect(nome).toBe('consumo-planos-2026-08-snapshot')
    expect(nome).toBe(nomeDoArquivoDeExport('snapshot', '2026-08'))
    expect(colunas).toBe(PLAN_CONSUMPTION_EXPORT_COLUMNS)
    // 135/G1 — 14 colunas, e a última é a contagem. A identidade por referência acima não
    // cai quando uma coluna entra ou sai; esta cardinalidade + o cabeçalho, sim.
    expect(colunas).toHaveLength(14)
    expect(colunas[13]?.header).toBe('Qtde. Tickets')
    // E o crédito chegou na planilha como SEGUNDOS, não como '2h 0m'.
    // `clientRow` tem plano de 10h ⇒ base 36.000s, crédito 7.200s, efetivo 43.200s.
    expect(linhas[0]?.qtdePlanoHoras).toBe(36_000)
    expect(linhas[0]?.creditoHoras).toBe(7_200)
    expect(linhas[0]?.qtdePlanoEfetivoHoras).toBe(43_200)
  })

  /**
   * 🔴 **Este caso existe por causa de uma MUTAÇÃO.** Trocar o guard do mapper por
   * `durationCellFromHours(plano.creditoHoras)` (o `?? 0` disfarçado) derrubava **um** teste,
   * e ele era `puro` (`index.export.test.ts`). Um invariante de EFEITO — o que sai na planilha
   * que o gestor encaminha — não pode ter cobertura só na classe pura
   * (`rules/tests.md` § "leia o resultado por CLASSE de prova").
   *
   * Aqui a asserção é sobre a planilha que a TELA gerou, pelo caminho real do botão.
   */
  it('🔴 crédito desconhecido no wire ⇒ a planilha gerada pela TELA sai com célula vazia', () => {
    mockListagem({ from: '2026-08-01', to: '2026-08-31' })
    // Linha SEM a chave `creditoHoras` — é o backend anterior à 132, o estado de produção
    // durante todo o intervalo entre os dois deploys.
    vi.mocked(listPlanConsumption).mockResolvedValue({
      items: [clientRow],
      totalCount: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
    })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))

    return waitFor(() => {
      expect(exportToCsv).toHaveBeenCalledTimes(1)
      const linhas = vi.mocked(exportToCsv).mock.calls[0]![2]
      // Companheira positiva: a linha saiu e as colunas de hora conhecidas têm número.
      expect(linhas).toHaveLength(1)
      expect(linhas[0]?.qtdePlanoHoras).toBe(36_000)
      // `0` afirmaria "não há crédito" numa planilha que vai por e-mail.
      expect(linhas[0]?.creditoHoras).toBeNull()
      expect(linhas[0]?.qtdePlanoEfetivoHoras).toBeNull()
    })
  })
})

// ─── 135/G5 — o filtro "Uso do plano" na barra ───────────────────────────────

/**
 * O gatilho do combobox é um `<button>` **rotulado por `<label for>`** — e `<button>` é
 * elemento rotulável, logo o nome ACESSÍVEL é o rótulo do campo ("Uso do plano"), não o
 * resumo visível ("Todos", "Em Risco…"). Medido no DOM renderizado, não presumido: a
 * primeira versão destes casos procurava pelo resumo e não achava o botão.
 *
 * ⇒ a **identidade** do controle é o nome acessível; o **estado** é o texto visível. Os
 * casos abaixo perguntam cada coisa onde ela mora.
 */
function gatilhoDoFiltro(): HTMLElement {
  return screen.getByRole('button', { name: LABEL_FILTRO_USO_DO_PLANO })
}

describe('PlanConsumptionPage — o filtro "Uso do plano" (135/G5)', () => {
  it('🔴 T-17: está na barra, é um listbox MULTI, e nasce com "Todos" marcado', () => {
    mockListagem({ from: '2026-08-01', to: '2026-08-31' })
    renderPage()

    const gatilho = gatilhoDoFiltro()
    // O resumo visível é o ESTADO: nada selecionado ⇒ a tela diz "Todos".
    expect(gatilho).toHaveTextContent(LABEL_USO_DO_PLANO_TODOS)
    expect(gatilho).toHaveAttribute('aria-haspopup', 'listbox')
    expect(gatilho).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(gatilho)

    const lista = screen.getByRole('listbox')
    expect(lista).toHaveAttribute('aria-multiselectable', 'true')

    const opcoes = within(lista).getAllByRole('option')
    // Identidade NOMINAL das 4 opções, na ordem, com os rótulos vindos do módulo do
    // vocabulário (nunca redigitados aqui). Cardinalidade sozinha passaria com uma
    // opção entrando e outra saindo.
    expect(opcoes.map((o) => o.textContent)).toEqual([
      LABEL_USO_DO_PLANO_TODOS,
      LABEL_USO_DO_PLANO_DENTRO,
      LABEL_USO_DO_PLANO_RISCO,
      LABEL_USO_DO_PLANO_FORA,
    ])
    // Nada selecionado ⇒ "Todos" aparece MARCADO. As três faixas desmarcadas são o
    // discriminador: sem elas, a asserção passaria com o componente marcando tudo.
    expect(opcoes[0]).toHaveAttribute('aria-checked', 'true')
    expect(opcoes.slice(1).map((o) => o.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
    ])
  })

  it('🔴 T-19: o ⓘ de G3 está ao lado do filtro, com o texto que explica o "—"', () => {
    mockListagem({ from: '2026-08-01', to: '2026-08-31' })
    renderPage()

    // Sem esta frase na tela, "Fora do Plano" trazendo linhas com `—` em "% do Plano"
    // (o cliente SEM plano, G3) volta a parecer defeito de dado.
    expect(
      screen.getByRole('button', { name: TOOLTIP_FILTRO_USO_DO_PLANO }),
    ).toBeInTheDocument()
  })

  /**
   * 🔴 **T-18 — G2 na classe de COMPONENTE, irmã (não substituta) do T-03 puro.**
   *
   * O `MultiSelectCombobox` é genérico: ele devolve **só o array alternado** e **não diz
   * qual item foi clicado**. Os dois cliques abaixo produzem arrays com o **mesmo
   * conteúdo** (`{todos, risco}`) — só o estado ANTERIOR os distingue. Um handler que
   * repassasse `proximo` cru ao `setFilters` passaria em qualquer teste que olhasse
   * apenas um dos dois.
   */
  it('🔴 T-18: "Todos" ativo + clique em "Em Risco" ⇒ `{ usoPlano: [risco] }`, sem o sentinela', () => {
    // ANTERIOR = `[]` ⇒ "Todos" exibido marcado.
    const { setFilters } = mockListagem({ from: '2026-08-01', to: '2026-08-31' })
    renderPage()

    expect(gatilhoDoFiltro()).toHaveTextContent(LABEL_USO_DO_PLANO_TODOS)
    fireEvent.click(gatilhoDoFiltro())
    fireEvent.click(screen.getByRole('option', { name: LABEL_USO_DO_PLANO_RISCO }))

    expect(setFilters).toHaveBeenCalledTimes(1)
    // `['todos','risco']` no wire seria "sem filtro" (o sentinela absorve a união): o
    // usuário marcaria "Em Risco" e a tabela não mudaria.
    expect(setFilters).toHaveBeenCalledWith({ usoPlano: ['risco'] })
  })

  it('🔴 T-18b: "Em Risco" ativo + clique em "Todos" ⇒ `{ usoPlano: [] }` (mesmo array, outra decisão)', () => {
    // ANTERIOR = `['risco']`. O combobox devolve `['risco','todos']` — o MESMO conteúdo
    // do caso acima. É aqui que se prova que a decisão é sobre ESTADO, não sobre a ordem
    // do array (que dependeria de `toggleOption` continuar fazendo append).
    const { setFilters } = mockListagem(
      { from: '2026-08-01', to: '2026-08-31' },
      { usoPlano: ['risco'] },
    )
    renderPage()

    // O resumo visível prova que o ANTERIOR é mesmo `['risco']` — sem isso, este caso e o
    // T-18 poderiam estar exercitando o mesmo estado.
    expect(gatilhoDoFiltro()).toHaveTextContent(LABEL_USO_DO_PLANO_RISCO)
    fireEvent.click(gatilhoDoFiltro())
    fireEvent.click(screen.getByRole('option', { name: LABEL_USO_DO_PLANO_TODOS }))

    expect(setFilters).toHaveBeenCalledTimes(1)
    expect(setFilters).toHaveBeenCalledWith({ usoPlano: [] })
  })

  it('T-18c: marcar a 2ª faixa ACUMULA, em ordem canônica (o controle positivo dos dois acima)', () => {
    // Sem este caso, um handler que devolvesse sempre `[]` passaria no T-18b, e um que
    // devolvesse sempre a última faixa clicada passaria no T-18.
    const { setFilters } = mockListagem(
      { from: '2026-08-01', to: '2026-08-31' },
      { usoPlano: ['fora'] },
    )
    renderPage()

    expect(gatilhoDoFiltro()).toHaveTextContent(LABEL_USO_DO_PLANO_FORA)
    fireEvent.click(gatilhoDoFiltro())
    fireEvent.click(screen.getByRole('option', { name: LABEL_USO_DO_PLANO_RISCO }))

    // Ordem CANÔNICA (dentro → risco → fora), não ordem de clique: é o que mantém a
    // `queryKey` estável para a mesma seleção feita em ordens diferentes.
    expect(setFilters).toHaveBeenCalledWith({ usoPlano: ['risco', 'fora'] })
  })
})

// ─── 135/§8.1.1 — 400 do filtro é ERRO, nunca "vazio" ────────────────────────

describe('PlanConsumptionPage — a requisição recusada não vira lista vazia', () => {
  it('🔴 T-21: em erro, a tela mostra ErrorState com retry — e NÃO a mensagem de vazio', () => {
    // Token fora do vocabulário (bundle velho depois de uma troca) ⇒ 400
    // `INVALID_USO_PLANO`. Dizer "Nenhum cliente encontrado" seria mentir sobre o dado:
    // o servidor RECUSOU a requisição, não respondeu "não há".
    //
    // 🔴 **`vazio: true` JUNTO de `isError` é o que torna este caso um detector.** No 400
    // real o hook publica `data` **undefined** (medido em `usePlanConsumption.test.ts`,
    // T-21(a)) — ou seja, "erro" e "sem itens" acontecem ao MESMO tempo. Com uma resposta
    // cheia no mock, qualquer guarda de vazio ficaria inerte por causa dos itens, e o caso
    // passaria sem exercitar nada (medido: a 1ª versão deste teste não caía com a guarda
    // `!isError` removida).
    mockListagem(
      { from: '2026-08-01', to: '2026-08-31' },
      { isError: true, vazio: true, usoPlano: ['fora'] },
    )
    renderPage()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument()
    expect(screen.queryByText(/Nenhum cliente encontrado/i)).not.toBeInTheDocument()
  })

  it('companheira POSITIVA: em SUCESSO sem itens, a mensagem de vazio aparece', () => {
    // Sem ela, a negativa acima passaria numa tela que nunca mostra vazio nenhum.
    mockListagem({ from: '2026-08-01', to: '2026-08-31' }, { vazio: true, usoPlano: ['fora'] })
    renderPage()

    expect(screen.getByText(/Nenhum cliente encontrado para os filtros selecionados/)).toBeInTheDocument()
    // Com faixa selecionada, a frase distingue "não há cliente no período" de "há, mas
    // nenhum na faixa" — é a informação que o usuário precisa para não achar que o
    // relatório quebrou.
    expect(
      screen.getByText(/nas faixas de uso do plano selecionadas/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /tentar novamente/i })).not.toBeInTheDocument()
  })
})

// ─── 135/§5.2 — o export sai com o MESMO recorte da tela ─────────────────────

describe('PlanConsumptionPage — o filtro viaja no export (o SEGUNDO call site)', () => {
  /** Duas páginas: é o que torna "todas as chamadas do laço" uma asserção com conteúdo. */
  function mockDuasPaginas(item: PlanConsumptionItemDto) {
    vi.mocked(listPlanConsumption).mockResolvedValue({
      items: [item],
      totalCount: 2,
      page: 1,
      pageSize: 200,
      totalPages: 2,
      fonte: 'aovivo',
      competencia: '2026-08',
    })
  }

  it('🔴 T-16: `usoPlano` vai em TODAS as páginas do laço, e a contagem chega na planilha', async () => {
    mockListagem({ from: '2026-08-01', to: '2026-08-31' }, { usoPlano: ['fora'] })
    mockDuasPaginas({ ...clientRow, qtdeTickets: 12 } as unknown as PlanConsumptionItemDto)

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))

    await waitFor(() => expect(exportToCsv).toHaveBeenCalledTimes(1))

    const chamadas = vi.mocked(listPlanConsumption).mock.calls.map((c) => c[0])
    // Controle positivo do laço: sem ele, "todas as chamadas carregam o filtro" seria
    // satisfeito por ZERO chamadas (asserção negativa satisfeita pelo vazio).
    expect(chamadas).toHaveLength(2)
    expect(chamadas.map((p) => p.page)).toEqual([1, 2])
    for (const p of chamadas) {
      // 🔴 Esquecer o filtro aqui traria TODOS os clientes na planilha enquanto a tela
      // mostra os filtrados — a planilha responderia outra pergunta que a tabela de onde
      // o usuário clicou "Exportar".
      expect(p.usoPlano).toEqual(['fora'])
    }

    const linhas = vi.mocked(exportToCsv).mock.calls[0]![2]
    expect(linhas).toHaveLength(2)
    expect(linhas[0]?.qtdeTickets).toBe(12)
  })

  it('🔴 T-16b: nada selecionado ⇒ o parâmetro NÃO viaja no export (nem como `[]`)', async () => {
    // O par obrigatório do caso acima, e ele muta o call site do EXPORT separadamente do
    // call site do hook: a cobertura poderia estar concentrada num só.
    mockListagem({ from: '2026-08-01', to: '2026-08-31' })
    mockDuasPaginas({ ...clientRow, qtdeTickets: 0 } as unknown as PlanConsumptionItemDto)

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))

    await waitFor(() => expect(exportToCsv).toHaveBeenCalledTimes(1))

    const chamadas = vi.mocked(listPlanConsumption).mock.calls.map((c) => c[0])
    expect(chamadas).toHaveLength(2)
    for (const p of chamadas) {
      expect(p.usoPlano).toBeUndefined()
    }
    // `cleanParams` não descarta array vazio: um `[]` cru viajaria como `?usoPlano=`.
    expect(chamadas.filter((p) => Array.isArray(p.usoPlano))).toEqual([])

    // E o `0` da contagem sobrevive ao caminho da TELA — não vira célula vazia.
    const linhas = vi.mocked(exportToCsv).mock.calls[0]![2]
    expect(linhas[0]?.qtdeTickets).toBe(0)
  })

  it('🔴 contagem DESCONHECIDA no wire ⇒ célula VAZIA na planilha gerada pela tela', async () => {
    // Backend anterior à 135: a chave não vem. `?? 0` afirmaria "nenhum chamado aberto"
    // na planilha que vai por e-mail — a classe de EFEITO do M-1, que a asserção pura de
    // `index.export.test.ts` sozinha não cobre.
    mockListagem({ from: '2026-08-01', to: '2026-08-31' })
    mockDuasPaginas(clientRow)

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))

    await waitFor(() => expect(exportToCsv).toHaveBeenCalledTimes(1))

    const linhas = vi.mocked(exportToCsv).mock.calls[0]![2]
    // Companheira positiva: a linha saiu e as colunas conhecidas têm número.
    expect(linhas).toHaveLength(2)
    expect(linhas[0]?.qtdePlanoHoras).toBe(36_000)
    expect(linhas[0]?.qtdeTickets).toBeNull()
  })
})
