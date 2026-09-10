/**
 * 121/§4.5 + 🔴 **132/F2 (D7)** — o painel de chamados do cliente e o cartão que **saiu**
 * dele.
 *
 * ## O que este arquivo travava, e o que ele trava agora
 *
 * Ele nasceu para provar o KPI "Em aberto (não faturável ainda)": que o valor era ESTOQUE
 * all-time, que a tela **dizia** que ele independia do período (§12/R12), e que campo
 * ausente/`null` virava `"—"` e nunca `"0h 0m"` (AP-FRONTEND-021).
 *
 * **O cartão não existe mais.** `horasEmAbertoNaoFaturadas` saiu do wire de
 * `/metrics/plan-consumption` na 132/B1+B2, e o cartão — o **segundo consumidor** do
 * campo — saiu daqui na 132/F2. Com `TimeEntry.InicioEm` como competência (132/D1), a
 * hora é faturada no mês em que foi apontada, chamado aberto ou fechado: "trabalho em
 * aberto fora de qualquer fatura" deixou de ser um conjunto.
 *
 * Os 6 casos daquele KPI foram **INVERTIDOS, não apagados** — viraram um bloco que afirma
 * a ausência do cartão **com a identidade nominal dos 6 que ficaram** ao lado. Asserção
 * negativa pura ("não vejo o cartão") passaria com o painel inteiro quebrado; a
 * identidade é a companheira positiva que a torna capaz de discriminar
 * (`rules/tests.md` § padrão 1).
 *
 * O resto do arquivo — a coluna "Na fatura", os 3 baldes e o **export** — não foi tocado
 * pela 132: continua provando que `null`/ausente viram `"—"` nos quatro lugares
 * (AP-FRONTEND-028), agora para os campos de `TicketReportItemDto`, que a 132 não mexeu.
 *
 * Hooks reais; só a camada de serviço é fake.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

vi.mock('../services/clientTicketsService', () => ({
  getClientKpis: vi.fn(),
  listClientTickets: vi.fn(),
  listTicketOwners: vi.fn().mockResolvedValue([]),
}))
vi.mock('../../reports/shared/services/reportsService', () => ({
  getTicketStatuses: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
}))
// O export é o 4º ramo de "Na fatura" (121/F4): ele tem a MESMA conflação que a coluna
// visível, e num CSV a afirmação falsa sobrevive na planilha do gestor. Encenado para
// inspecionar as linhas geradas (e para não importar o exceljs lazy).
//
// 134 — `importOriginal`: só `exportToCsv`/`exportToXlsx` são dublês. `durationCell` TEM de
// ser o real, senão o teste do export mediria o dublê e não o guard de ausência do núcleo.
// O exceljs continua fora, porque só `exportToXlsx` o importa (dinamicamente) e ele é dublê.
vi.mock('../../reports/shared/utils/exportTable', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../reports/shared/utils/exportTable')>()),
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { ClientTicketsPanel } from './ClientTicketsPanel'
import { buildClientTicketsColumns } from '../columns'
import { ToastProvider } from '../../../components/ui/Toast'
import { getClientKpis, listClientTickets } from '../services/clientTicketsService'
import { exportToCsv } from '../../reports/shared/utils/exportTable'
import type { PlanConsumptionItemDto } from '../../reports/shared/types/reports'
import type { ClientTicketItemDto } from '../types/clientTickets'

const mockedKpis = vi.mocked(getClientKpis)
const mockedTickets = vi.mocked(listClientTickets)
const mockedExportCsv = vi.mocked(exportToCsv)

const TEXTO_ESTOQUE =
  'Total, independe do período — trabalho em chamados ainda sem data de conclusão.'

function kpiRow(partial: Partial<PlanConsumptionItemDto>): PlanConsumptionItemDto {
  return {
    clientId: 1,
    cnpj: '00.000.000/0001-00',
    nomeFantasia: 'Acme',
    razaoSocial: 'Acme LTDA',
    nomePlano: 'Plano X',
    qtdePlanoHoras: 10,
    // Valores TODOS DISTINTOS entre si e diferentes de "0h 0m": assim "0h 0m" na tela
    // só pode vir do KPI sob teste, e não de "Extras (estouro)" — sem isso o
    // `getByText('0h 0m')` casaria dois cards e o assert de ausência seria inerte.
    horasUsadas: 4,
    horasRestantes: 6,
    horasAdicionais: 2,
    percentualPlano: 40,
    horasFaturaveis: 1,
    horasAnalise: 0,
    ...partial,
  }
}

function ticket(overrides: Partial<ClientTicketItemDto> = {}): ClientTicketItemDto {
  return {
    ticketId: 1,
    hubspotTicketId: '10001',
    assunto: 'Chamado A',
    clienteNome: 'Acme',
    equipe: 'Suporte',
    ownerNome: 'Ana',
    status: 'Fechado',
    // 1500s → "0h 25m": nunca colide com os números dos KPIs.
    totalSeconds: 1500,
    apontamentosCount: 1,
    hubspotUrl: null,
    totalSecondsAllTime: 1500,
    apontamentosCountAllTime: 1,
    statusNome: 'Fechado',
    statusCategoria: 'fechado',
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

/** Escopo obrigatório: sem ele um "3h 30m" de célula da tabela satisfaria a asserção. */
function resumo(): HTMLElement {
  return screen.getByLabelText('Resumo do plano do cliente')
}

/**
 * 123/FAT-1 — o escopo de "Na fatura" passou de LINHA para CÉLULA.
 *
 * Motivo: a tabela ganhou "Concluído em" e os 3 baldes de fatura, que também rendem "—"
 * quando o campo falta. Um `within(linha).getByText('—')` deixou de discriminar (casa 4
 * elementos e lança). Escopo de linha só funcionava enquanto "Na fatura" era a única
 * coluna capaz de escrever "—" — premissa que uma coluna nova invalida em silêncio.
 *
 * O índice é DERIVADO do próprio `buildClientTicketsColumns()`, nunca digitado: uma
 * reordenação de colunas moveria a asserção para a célula errada e o teste passaria a
 * medir outra coluna. O controle positivo abaixo garante que a derivação não é vacuosa.
 */
const IDX_NA_FATURA = buildClientTicketsColumns().findIndex((c) => c.key === 'naFatura')
/** 134 — mesmo raciocínio, para provar que a COLUNA VISÍVEL do balde não mudou. */
const IDX_BALDE_PLANO = buildClientTicketsColumns().findIndex((c) => c.key === 'baldePlano')

function celulaNaFatura(linha: HTMLElement): HTMLElement {
  return within(linha).getAllByRole('cell')[IDX_NA_FATURA]
}

function celulaBaldePlano(linha: HTMLElement): HTMLElement {
  return within(linha).getAllByRole('cell')[IDX_BALDE_PLANO]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedTickets.mockResolvedValue({
    items: [ticket()],
    totalCount: 1,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  })
})

describe('🔴 o KPI "Em aberto (não faturável ainda)" foi REMOVIDO (132/F2, D7)', () => {
  /**
   * Identidade NOMINAL dos cartões que sobraram, não cardinalidade: a grade caiu de 7
   * para 6, e um assert de contagem (`toHaveLength(6)`) passaria com um cartão entrando e
   * outro saindo (`rules/tests.md` § "cardinalidade simétrica não discrimina"). Os nomes
   * são literais escritos à mão, na ordem em que a tela os renderiza.
   *
   * Cartão novo aqui reprova e obriga a declarar — é o comportamento desejado. A 132
   * abriu espaço na grade e a análise §5.3 registra um KPI de crédito como
   * **oportunidade, não requisito**: se ele entrar, entra por esta lista.
   */
  const CARTOES_QUE_FICAM = [
    'Plano',
    'Horas usadas',
    'Horas restantes',
    'Extras (estouro)',
    'Faturável por fora',
    '% do plano',
  ]

  it('o cartão não está na tela — e os 6 que ficaram continuam, nominalmente', async () => {
    mockedKpis.mockResolvedValue(kpiRow({}))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    // Discriminador: espera um KPI que VEIO preenchido (4 h usadas). Sem isto a ausência
    // do cartão seria satisfeita pelo próprio skeleton do loading — o defeito de "prova
    // por ausência com o ponto observado inalcançado" (`rules/tests.md`).
    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())

    // A companheira POSITIVA, na mesma execução e no mesmo recorte.
    for (const rotulo of CARTOES_QUE_FICAM) {
      expect(
        within(resumo()).getByText(rotulo),
        `o cartão "${rotulo}" desapareceu da grade`,
      ).toBeInTheDocument()
    }

    // E a negativa, que é o requisito da 132/F2.
    expect(within(resumo()).queryByText('Em aberto (não faturável ainda)')).not.toBeInTheDocument()
  })

  it('🔴 nem o subtexto de estoque all-time sobrou (a frase inteira, não só o rótulo)', async () => {
    // O rótulo e o subtexto eram DOIS textos, e remover só o primeiro deixaria na tela
    // uma frase órfã afirmando que existe um número que independe do período.
    mockedKpis.mockResolvedValue(kpiRow({}))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())
    expect(within(resumo()).queryByText(TEXTO_ESTOQUE)).not.toBeInTheDocument()
    // Controle positivo do LITERAL: se a constante virar string vazia, o `queryByText`
    // acima passa por vacuidade. Este assert garante que ela ainda descreve algo.
    expect(TEXTO_ESTOQUE).toContain('independe do período')
  })

  it('a grade não deixou buraco: os 6 cartões e nenhum valor perdido de "—"', async () => {
    // `kpiRow({})` tem TODOS os campos preenchidos e distintos entre si. Antes da 132 este
    // fixture produzia pelo menos um "—" na grade (o cartão "Em aberto", cujo campo o
    // fixture não trazia). Agora não deve haver nenhum: se aparecer, é cartão lendo campo
    // que saiu do wire — exatamente a regressão que a 132/B1+B2 criou e a F2 fecha.
    mockedKpis.mockResolvedValue(kpiRow({}))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())
    expect(within(resumo()).queryAllByText('—')).toEqual([])
  })

  it('durante o LOADING não exibe valor nenhum (nem "—", que afirmaria ausência)', () => {
    mockedKpis.mockReturnValue(new Promise(() => {}))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    expect(within(resumo()).queryByText('4h 0m')).not.toBeInTheDocument()
    expect(within(resumo()).queryByText('0h 0m')).not.toBeInTheDocument()
    expect(within(resumo()).getAllByLabelText('Carregando…').length).toBeGreaterThan(0)
  })
})

describe('Coluna "Na fatura" no painel', () => {
  it('o índice derivado da coluna existe (controle positivo do escopo de célula)', () => {
    // Sem isto, um `key` renomeado daria `-1`, `getAllByRole('cell')[-1]` seria
    // `undefined`, e os asserts abaixo falhariam por motivo errado (ou, num
    // `queryByText`, passariam vacuamente).
    expect(IDX_NA_FATURA).toBeGreaterThanOrEqual(0)
    expect(IDX_BALDE_PLANO).toBeGreaterThanOrEqual(0)
  })

  it('renderiza "Sim"/"Não" a partir de entraNaFatura, e "—" quando o campo falta', async () => {
    mockedKpis.mockResolvedValue(kpiRow({}))
    mockedTickets.mockResolvedValue({
      items: [
        ticket({ ticketId: 1, hubspotTicketId: '10001', entraNaFatura: true }),
        ticket({ ticketId: 2, hubspotTicketId: '10002', entraNaFatura: false }),
        ticket({ ticketId: 3, hubspotTicketId: '10003' }),
      ],
      totalCount: 3,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const linhas = screen.getAllByRole('row')
    expect(celulaNaFatura(linhas[1])).toHaveTextContent('Sim')
    expect(celulaNaFatura(linhas[2])).toHaveTextContent('Não')
    expect(celulaNaFatura(linhas[3])).toHaveTextContent('—')
  })

  it('entraNaFatura `null` na LINHA rende "—", nunca "Não" (121/F4, na tabela real)', async () => {
    mockedKpis.mockResolvedValue(kpiRow({}))
    mockedTickets.mockResolvedValue({
      items: [
        // Cardinalidade assimétrica de propósito: 1 linha com `true` e 2 com ausência
        // (uma `null`, uma sem a chave). Com um "Sim" e um "Não" simétricos, o assert
        // passaria até com o ramo invertido.
        ticket({ ticketId: 1, hubspotTicketId: '10001', entraNaFatura: true }),
        ticket({ ticketId: 2, hubspotTicketId: '10002', entraNaFatura: null }),
        ticket({ ticketId: 3, hubspotTicketId: '10003' }),
      ],
      totalCount: 3,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const linhas = screen.getAllByRole('row')
    // Companheira positiva: o "Sim" da linha 1 prova que a coluna está viva.
    expect(celulaNaFatura(linhas[1])).toHaveTextContent('Sim')
    expect(celulaNaFatura(linhas[2])).toHaveTextContent('—')
    expect(celulaNaFatura(linhas[2])).not.toHaveTextContent('Não')
    expect(celulaNaFatura(linhas[3])).toHaveTextContent('—')
    // Em NENHUMA linha aparece "Não": nenhuma delas recebeu `false` do backend.
    expect(screen.queryByText('Não')).not.toBeInTheDocument()
  })

  it('no EXPORT, entraNaFatura `null` sai como "—" e nunca como "Não" (121/F4)', async () => {
    mockedKpis.mockResolvedValue(kpiRow({}))
    mockedTickets.mockResolvedValue({
      items: [
        ticket({ ticketId: 1, hubspotTicketId: '10001', entraNaFatura: true }),
        ticket({ ticketId: 2, hubspotTicketId: '10002', entraNaFatura: null }),
        ticket({ ticketId: 3, hubspotTicketId: '10003', entraNaFatura: false }),
      ],
      totalCount: 3,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))

    await waitFor(() => expect(mockedExportCsv).toHaveBeenCalledTimes(1))
    const linhas = mockedExportCsv.mock.calls[0][2]
    // Os três ramos na MESMA planilha: "Sim" e "Não" existem de verdade (companheiras
    // positivas) e a ausência é "—", não "Não".
    expect(linhas[0].naFatura).toBe('Sim')
    expect(linhas[1].naFatura).toBe('—')
    expect(linhas[2].naFatura).toBe('Não')
  })

  /**
   * 134 — a MESMA lição deste arquivo ("ausente nunca vira zero"), agora na superfície que
   * `AP-FRONTEND-028` chama de mais grave: o arquivo que sai do sistema.
   *
   * As colunas de duração deixaram de levar texto e levam SEGUNDOS. Ausência ⇒ célula
   * VAZIA (`null`): na planilha ela não conta em SOMA/MÉDIA e não afirma nada. Um `0` ali
   * afirmaria "nenhuma hora neste balde" — a mentira exata que o cartão "Em aberto" já
   * produziu neste painel (`formatHours(null)` → "0h 0m") **antes de a 132/F2 removê-lo**.
   * A citação é HISTÓRICA de propósito: o cartão não existe mais, mas o defeito que ele
   * cometeu é o melhor exemplo do que este guard impede.
   *
   * Cardinalidade ASSIMÉTRICA de propósito (1 com valor · 2 ausentes · 1 zero): com um de
   * cada, inverter o ramo do guard ainda passaria.
   *
   * O que fica vermelho: guard `=== undefined` (a linha `null` sairia 0);
   * `if (!v) return null` (a linha de zero sumiria); mapper voltando a `baldeTexto`
   * (sairia "—"/"1h 0m"); e mudar a TELA junto (as células visíveis abaixo).
   */
  it('134 — no EXPORT, balde ausente sai VAZIO e zero sai 0 (a tela segue em "—"/"0h 0m")', async () => {
    mockedKpis.mockResolvedValue(kpiRow({}))
    mockedTickets.mockResolvedValue({
      items: [
        ticket({ ticketId: 1, hubspotTicketId: '10001', faturaPlanoSegundos: 3600 }),
        // `null` explícito — a forma de ausência que `=== undefined` deixa passar.
        ticket({ ticketId: 2, hubspotTicketId: '10002', faturaPlanoSegundos: null }),
        // Chave ausente — o backend anterior a FAT-3.
        ticket({ ticketId: 3, hubspotTicketId: '10003' }),
        // Zero legítimo: o backend RESPONDEU que não há horas neste balde.
        ticket({ ticketId: 4, hubspotTicketId: '10004', faturaPlanoSegundos: 0 }),
      ],
      totalCount: 4,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    // A TELA (as outras 3 superfícies do mesmo campo) não mudou: "1h 0m", "—", "0h 0m".
    const linhasTela = screen.getAllByRole('row')
    expect(celulaBaldePlano(linhasTela[1])).toHaveTextContent('1h 0m')
    expect(celulaBaldePlano(linhasTela[2])).toHaveTextContent('—')
    expect(celulaBaldePlano(linhasTela[3])).toHaveTextContent('—')
    expect(celulaBaldePlano(linhasTela[4])).toHaveTextContent('0h 0m')

    await userEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await waitFor(() => expect(mockedExportCsv).toHaveBeenCalledTimes(1))

    const linhas = mockedExportCsv.mock.calls[0][2]
    // Companheira positiva primeiro: o export escreveu valor de verdade nesta coluna.
    expect(linhas[0].baldePlano).toBe(3600)
    expect(linhas[1].baldePlano).toBeNull()
    expect(linhas[2].baldePlano).toBeNull()
    // As duas mentiras possíveis, nomeadas: nem zero, nem o travessão da tela.
    expect(linhas[1].baldePlano).not.toBe(0)
    expect(linhas[1].baldePlano).not.toBe('—')
    expect(linhas[2].baldePlano).not.toBe(0)
    // E zero continua sendo zero — não é ausência.
    expect(linhas[3].baldePlano).toBe(0)
  })

  it('o cabeçalho "Tempo do plano" deixou de existir na tabela', async () => {
    mockedKpis.mockResolvedValue(kpiRow({}))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const cabecalhos = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '')
    expect(cabecalhos.some((h) => h.includes('Tempo do plano'))).toBe(false)
    expect(cabecalhos.some((h) => h.includes('Tempo no período'))).toBe(true)
    expect(cabecalhos.some((h) => h.includes('Na fatura'))).toBe(true)
  })
})
