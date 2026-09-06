/**
 * 121/§4.5 — KPI "Em aberto (não faturável ainda)" no painel de chamados do cliente.
 *
 * Hooks reais; só a camada de serviço é fake (mesmo padrão de
 * `ClientTicketsPanel.periodo-kpis.test.tsx`, da unidade WEB-1 — não mexo nos arquivos
 * dela, este é um arquivo novo).
 *
 * Dois pontos que este arquivo existe para travar:
 *  1. o valor é ESTOQUE all-time e a tela **diz** que independe do período (§12/R12) —
 *     sem esse texto o relato P4 ("o filtro de data não tem efeito") volta;
 *  2. campo AUSENTE ⇒ "—", nunca "0h 0m" (AP-FRONTEND-021).
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
// visível, e num CSV a afirmação falsa sobrevive na planilha do gestor. Mockado para
// inspecionar as linhas geradas (e para não importar o exceljs lazy).
vi.mock('../../reports/shared/utils/exportTable', () => ({
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

function celulaNaFatura(linha: HTMLElement): HTMLElement {
  return within(linha).getAllByRole('cell')[IDX_NA_FATURA]
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

describe('KPI "Em aberto (não faturável ainda)" (121/§4.5)', () => {
  it('mostra o valor do backend com literal escrito à mão (3.5 h → "3h 30m")', async () => {
    mockedKpis.mockResolvedValue(kpiRow({ horasEmAbertoNaoFaturadas: 3.5 }))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    // Espera pelo VALOR, não pelo rótulo: o rótulo já existe durante o skeleton, e
    // esperar por ele mediria a fase errada (o assert rodaria no loading).
    await waitFor(() => expect(within(resumo()).getByText('3h 30m')).toBeInTheDocument())
    expect(within(resumo()).getByText('Em aberto (não faturável ainda)')).toBeInTheDocument()
  })

  it('ZERO é um valor, não ausência: 0 → "0h 0m"', async () => {
    mockedKpis.mockResolvedValue(kpiRow({ horasEmAbertoNaoFaturadas: 0 }))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() => expect(within(resumo()).getByText('0h 0m')).toBeInTheDocument())
  })

  it('campo AUSENTE → "—", nunca "0h 0m" (backend sem FAT-3; AP-FRONTEND-021)', async () => {
    // `kpiRow({})` não traz `horasEmAbertoNaoFaturadas`: é o estado real entre os
    // deploys. Um `?? 0` aqui afirmaria "não há trabalho em aberto".
    mockedKpis.mockResolvedValue(kpiRow({}))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    // Discriminador: espera um KPI que VEIO preenchido (4 h usadas). Só então a
    // ausência do "0h 0m" prova algo — sem isso o assert passaria no loading.
    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())
    expect(within(resumo()).getByText('Em aberto (não faturável ainda)')).toBeInTheDocument()
    expect(within(resumo()).queryByText('0h 0m')).not.toBeInTheDocument()
    expect(within(resumo()).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('campo `null` → "—" também: `null` é a OUTRA forma de ausente (121/F4)', async () => {
    // O que um `decimal?` do C# serializa. Com o guard `=== undefined`, `null` caía em
    // `formatHours(null)` = "0h 0m" — afirmando ZERO onde o valor é DESCONHECIDO.
    mockedKpis.mockResolvedValue(kpiRow({ horasEmAbertoNaoFaturadas: null }))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    // Mesmo discriminador do caso AUSENTE: sem um KPI já preenchido na tela, a ausência
    // do "0h 0m" seria satisfeita pelo próprio loading.
    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())
    expect(within(resumo()).getByText('Em aberto (não faturável ainda)')).toBeInTheDocument()
    expect(within(resumo()).queryByText('0h 0m')).not.toBeInTheDocument()
    expect(within(resumo()).getAllByText('—').length).toBeGreaterThan(0)
  })

  it('a tela DIZ que o número independe do período (§12/R12 — senão o relato P4 volta)', async () => {
    mockedKpis.mockResolvedValue(kpiRow({ horasEmAbertoNaoFaturadas: 3.5 }))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() =>
      expect(within(resumo()).getByText(TEXTO_ESTOQUE)).toBeInTheDocument(),
    )
  })

  it('durante o LOADING não exibe valor nenhum (nem "—", que afirmaria ausência)', () => {
    mockedKpis.mockReturnValue(new Promise(() => {}))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    expect(within(resumo()).queryByText('3h 30m')).not.toBeInTheDocument()
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
  })

  it('renderiza "Sim"/"Não" a partir de entraNaFatura, e "—" quando o campo falta', async () => {
    mockedKpis.mockResolvedValue(kpiRow({ horasEmAbertoNaoFaturadas: 3.5 }))
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
    mockedKpis.mockResolvedValue(kpiRow({ horasEmAbertoNaoFaturadas: 3.5 }))
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
    mockedKpis.mockResolvedValue(kpiRow({ horasEmAbertoNaoFaturadas: 3.5 }))
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

  it('o cabeçalho "Tempo do plano" deixou de existir na tabela', async () => {
    mockedKpis.mockResolvedValue(kpiRow({ horasEmAbertoNaoFaturadas: 0 }))
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />)

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const cabecalhos = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '')
    expect(cabecalhos.some((h) => h.includes('Tempo do plano'))).toBe(false)
    expect(cabecalhos.some((h) => h.includes('Tempo no período'))).toBe(true)
    expect(cabecalhos.some((h) => h.includes('Na fatura'))).toBe(true)
  })
})
