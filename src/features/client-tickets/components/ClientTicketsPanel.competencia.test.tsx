/**
 * 123/FAT-1 — no painel de chamados do cliente:
 *   1. o toggle "Só o que entra na fatura do período" (liga `apenasFatura`, que existia
 *      morto no backend);
 *   2. a tela DIZ por qual data os KPIs recortam e que a coluna da tabela recorta por outra;
 *   3. o export leva as colunas novas E o estado do toggle.
 *
 * Hooks reais; só a camada de serviço é fake — mesmo padrão de
 * `ClientTicketsPanel.fatura.test.tsx`. Este é um arquivo NOVO: não altero os das unidades
 * anteriores.
 *
 * O que deixa cada asserção VERMELHA:
 *  · toggle desligado por default virar ligado → muda o conjunto de linhas sem decisão de
 *    produto (é o que o escopo da demanda proíbe);
 *  · `apenasFatura` não entrar na `queryKey`/params ao ligar → o TanStack serviria o
 *    resultado antigo e a tela pareceria morta (memória: broadcast condicional silencia
 *    campo). O assert é sobre a REQUISIÇÃO, não sobre o estado do `<button>`;
 *  · export não repassar o toggle → a planilha responde outra pergunta que a tabela de onde
 *    o usuário clicou "Exportar" (AP-FRONTEND-028);
 *  · remover as colunas novas do export → assert de identidade dos cabeçalhos.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
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
vi.mock('../../reports/shared/utils/exportTable', () => ({
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { ClientTicketsPanel } from './ClientTicketsPanel'
import { ToastProvider } from '../../../components/ui/Toast'
import { getClientKpis, listClientTickets } from '../services/clientTicketsService'
import { exportToCsv } from '../../reports/shared/utils/exportTable'
import {
  KPI_EM_ABERTO_LABEL,
  KPI_EM_ABERTO_TEXTO,
  TEXTO_APENAS_FATURA_LABEL,
  TEXTO_DIVERGENCIA_KPI_TABELA,
  textoPeriodoDoDetalhe,
} from '../../reports/shared/utils/competenciaTexts'
import type { PlanConsumptionItemDto } from '../../reports/shared/types/reports'
import type { ClientTicketItemDto } from '../types/clientTickets'

const mockedKpis = vi.mocked(getClientKpis)
const mockedTickets = vi.mocked(listClientTickets)
const mockedExportCsv = vi.mocked(exportToCsv)

const FROM = '2026-08-01'
const TO = '2026-08-31'

function kpiRow(partial: Partial<PlanConsumptionItemDto> = {}): PlanConsumptionItemDto {
  return {
    clientId: 1,
    cnpj: '00.000.000/0001-00',
    nomeFantasia: 'Acme',
    razaoSocial: 'Acme LTDA',
    nomePlano: 'Plano X',
    qtdePlanoHoras: 10,
    horasUsadas: 4,
    horasRestantes: 6,
    horasAdicionais: 2,
    percentualPlano: 40,
    horasFaturaveis: 1,
    horasAnalise: 0,
    horasEmAbertoNaoFaturadas: 3.5,
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

function resumo(): HTMLElement {
  return screen.getByLabelText('Resumo do plano do cliente')
}

/** Params da ÚLTIMA chamada a `listClientTickets` — é o wire, não o estado do componente. */
function ultimosParams(): Record<string, unknown> {
  const calls = mockedTickets.mock.calls
  return calls[calls.length - 1][0] as unknown as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedKpis.mockResolvedValue(kpiRow())
  mockedTickets.mockResolvedValue({
    items: [ticket()],
    totalCount: 1,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  })
})

describe('toggle "Só o que entra na fatura do período"', () => {
  it('existe, com role="switch", rótulo visível e desligado por default', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(mockedTickets).toHaveBeenCalled())

    const toggle = screen.getByRole('switch', { name: TEXTO_APENAS_FATURA_LABEL })
    // Desligado por default é REQUISITO, não detalhe: o padrão da tela é a visão de
    // conferência, com os chamados em aberto na lista (instrução explícita do usuário).
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('na primeira carga o wire NÃO leva apenasFatura', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(mockedTickets).toHaveBeenCalled())

    expect(ultimosParams().apenasFatura).toBeUndefined()
    // Companheira positiva: o período CHEGA na mesma chamada. Sem ela, "não vejo
    // apenasFatura" seria satisfeito por uma chamada que não aconteceu.
    expect(ultimosParams().from).toBe(FROM)
    expect(ultimosParams().to).toBe(TO)
  })

  it('ligar o toggle dispara requisição NOVA com apenasFatura=true', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(mockedTickets).toHaveBeenCalled())
    const chamadasAntes = mockedTickets.mock.calls.length

    await userEvent.click(screen.getByRole('switch', { name: TEXTO_APENAS_FATURA_LABEL }))

    // Requisição NOVA (o filtro está na queryKey) e com o booleano no wire. Um toggle que
    // só mudasse o estado visual sem entrar na queryKey deixaria a tela idêntica.
    await waitFor(() =>
      expect(mockedTickets.mock.calls.length).toBeGreaterThan(chamadasAntes),
    )
    await waitFor(() => expect(ultimosParams().apenasFatura).toBe(true))
    expect(ultimosParams().from).toBe(FROM)
  })

  it('desligar de volta remove apenasFatura do wire', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(mockedTickets).toHaveBeenCalled())
    const toggle = screen.getByRole('switch', { name: TEXTO_APENAS_FATURA_LABEL })

    await userEvent.click(toggle)
    await waitFor(() => expect(ultimosParams().apenasFatura).toBe(true))

    await userEvent.click(toggle)
    // Estado "pegajoso" tem de ter caminho de limpeza garantido (AP-FRONTEND-017).
    await waitFor(() => expect(ultimosParams().apenasFatura).toBeUndefined())
  })

  it('o rótulo é clicável e alterna o toggle (label htmlFor ↔ id do switch)', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(mockedTickets).toHaveBeenCalled())

    await userEvent.click(screen.getByText(TEXTO_APENAS_FATURA_LABEL, { selector: 'label' }))
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: TEXTO_APENAS_FATURA_LABEL })).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    )
  })

  it('o vazio com o toggle LIGADO explica o recorte, em vez de dizer "nenhum ticket"', async () => {
    mockedTickets.mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 25,
      totalPages: 0,
    })
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(mockedTickets).toHaveBeenCalled())

    // Sem o toggle: mensagem antiga.
    await waitFor(() =>
      expect(
        screen.getByText('Nenhum ticket encontrado para este cliente no período.'),
      ).toBeInTheDocument(),
    )

    await userEvent.click(screen.getByRole('switch', { name: TEXTO_APENAS_FATURA_LABEL }))

    // Com o toggle: o vazio significa "nada deste cliente fechou no período", que é outra
    // afirmação — e traz a saída (desligar o toggle).
    await waitFor(() =>
      expect(screen.getByText(/foi concluído dentro do período filtrado/)).toBeInTheDocument(),
    )
    expect(
      screen.queryByText('Nenhum ticket encontrado para este cliente no período.'),
    ).not.toBeInTheDocument()
  })
})

describe('a tela declara por qual data cada número recorta', () => {
  it('mostra a frase do período EM USO, com as datas do filtro', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())

    // 123/FE-PER (D-2): a frase do detalhe passou de `textoPeriodoDeConclusao` (que descreve
    // o recorte de UMA rota) para `textoPeriodoDoDetalhe`, que imprime a janela EFETIVA que
    // as DUAS metades da tela mandaram ao wire. Literal derivado do módulo de textos (que
    // tem o próprio teste com literais à mão) — aqui se prova o LIGAMENTO: a frase usa o
    // período REAL da tela, não um congelado.
    expect(
      within(resumo()).getByText(
        new RegExp(
          textoPeriodoDoDetalhe({ from: FROM, to: TO }).replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&',
          ),
        ),
      ),
    ).toBeInTheDocument()
  })

  /**
   * 123/FE-FIX3 (ressalva `F-2`) — prova de RENDER: as duas frases estão na MESMA dobra e
   * deixaram de se contradizer.
   *
   * O irmão unitário (`competenciaTexts.test.ts`) prova o conteúdo da frase. Aqui se prova
   * que ela e o subtexto do cartão "Em aberto" convivem no mesmo `<section>` renderizado —
   * que era exatamente o que o QA leu na tela.
   *
   * O que deixa isto vermelho: a frase voltar a dizer "os cartões … usam este mesmo
   * período" sem a ressalva (a redação do defeito).
   */
  it('123/FE-FIX3 (F-2): a frase do período e o cartão "Em aberto" não se contradizem na tela', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())

    const secao = resumo()
    // As duas afirmações estão na mesma seção — é o que produz a contradição quando
    // uma diz "todos os cartões" e a outra "independe do período".
    expect(within(secao).getByText(KPI_EM_ABERTO_LABEL)).toBeInTheDocument()
    expect(within(secao).getAllByText(KPI_EM_ABERTO_TEXTO).length).toBeGreaterThan(0)

    const texto = secao.textContent ?? ''
    expect(texto).toContain('menos o cartão')
    expect(texto).toContain(KPI_EM_ABERTO_LABEL)
    // Controle negativo: a redação antiga, sem ressalva, não pode estar na tela.
    expect(texto).not.toContain('Os cartões e a tabela abaixo usam este mesmo período.')
  })

  it('mostra que os KPIs e a coluna "Tempo no período" usam datas diferentes', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())

    // Torna LEGÍVEL a divergência (DP-7 resolve, esta unidade só declara). Sem esta frase, a
    // única leitura possível de "KPI ≠ soma da coluna" é "o sistema está errado".
    expect(
      within(resumo()).getByText(new RegExp(TEXTO_DIVERGENCIA_KPI_TABELA.slice(0, 60)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
    ).toBeInTheDocument()
  })

  it('a frase acompanha a troca de período (não congela o da abertura)', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())

    // Limpa a ponta final pelo próprio controle da tela.
    const inputAte = screen.getByLabelText('Até')
    await userEvent.clear(inputAte)

    // 123/FE-PER (D-2): antes a frase dizia "até o fim do mês atual" — descrição do default
    // do BACKEND, que o front não controlava e não mandava no wire. Agora o front resolve a
    // ponta em branco e a frase diz de onde saiu o valor que ele efetivamente enviou.
    await waitFor(() =>
      expect(
        within(resumo()).getByText(
          /A data final ficou em branco, então vale o último dia do mês atual\./,
        ),
      ).toBeInTheDocument(),
    )
    // E o início continua sendo o do usuário — o padrão fecha só a ponta em branco.
    // FROM = '2026-08-01' → "01/08/2026" (literal escrito à mão, não derivado da resposta).
    expect(within(resumo()).getByText(/Período em uso: 01\/08\/2026 a /)).toBeInTheDocument()
  })
})

describe('export do detalhe — colunas novas e estado do toggle', () => {
  it('exporta "Concluído em" e os 3 baldes, com os valores do wire', async () => {
    mockedTickets.mockResolvedValue({
      items: [
        ticket({
          ticketId: 1,
          hubspotTicketId: '10001',
          entraNaFatura: true,
          fechadoEm: '2026-08-05T14:30:00Z',
          // Três valores DISTINTOS: com valores iguais, trocar um balde pelo outro no
          // mapeamento passaria batido.
          faturaPlanoSegundos: 3600,
          faturaFaturadoSegundos: 1800,
          faturaAnaliseSegundos: 900,
        }),
        // Segunda linha sem nenhum dos campos novos: é o backend antigo, e prova que a
        // planilha escreve "—" em vez de "0h 0m"/"Invalid Date".
        ticket({ ticketId: 2, hubspotTicketId: '10002' }),
        // Terceira linha com `null` EXPLÍCITO — a OUTRA forma de ausente no wire.
        //
        // ⚠️ Esta linha foi acrescentada DEPOIS de uma mutação dirigida: trocar o guard
        // `== null` por `=== undefined` em `baldeTexto`/`concluidoEmTexto` derrubava só o
        // teste unitário puro e deixava o EXPORT verde — a superfície mais grave ficava
        // descoberta justamente para a forma de ausência que o defeito produz
        // (`rules/tests.md`: ler o resultado da mutação por CLASSE de prova, não por
        // contagem; `AP-FRONTEND-028`: testar com `null` explícito, não só `undefined`).
        ticket({
          ticketId: 3,
          hubspotTicketId: '10003',
          fechadoEm: null,
          faturaPlanoSegundos: null,
          faturaFaturadoSegundos: null,
          faturaAnaliseSegundos: null,
        }),
      ],
      totalCount: 3,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await waitFor(() => expect(mockedExportCsv).toHaveBeenCalledTimes(1))

    const colunas = mockedExportCsv.mock.calls[0][1]
    // Identidade e ORDEM dos cabeçalhos: a planilha tem de se ler como a tela.
    expect(colunas.map((c) => c.header)).toEqual([
      'Ticket',
      'Nome do ticket',
      'Equipe',
      'Atendente',
      'Status',
      'Tempo no período',
      'Apontamentos',
      'Concluído em',
      'Na fatura',
      'Plano (chamado)',
      'Cobrado por fora (chamado)',
      'Análise (chamado)',
    ])

    const linhas = mockedExportCsv.mock.calls[0][2]
    expect(linhas[0]).toMatchObject({
      concluidoEm: '05/08/2026',
      naFatura: 'Sim',
      baldePlano: '1h 0m',
      baldeFaturado: '0h 30m',
      baldeAnalise: '0h 15m',
    })
    expect(linhas[1]).toMatchObject({
      concluidoEm: '—',
      naFatura: '—',
      baldePlano: '—',
      baldeFaturado: '—',
      baldeAnalise: '—',
    })
    // `null` no wire produz o MESMO "—" — nunca "Invalid Date" nem "0h 0m".
    expect(linhas[2]).toMatchObject({
      concluidoEm: '—',
      baldePlano: '—',
      baldeFaturado: '—',
      baldeAnalise: '—',
    })
    // Companheira positiva do arquivo inteiro: a linha 0 continua com valores REAIS, então
    // nenhuma das asserções de "—" acima é satisfeita por um export que não escreve nada.
    expect(linhas[0].tempo).toBe('0h 25m')
  })

  it('com o toggle ligado, o export sai com apenasFatura=true', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('switch', { name: TEXTO_APENAS_FATURA_LABEL }))
    await waitFor(() => expect(ultimosParams().apenasFatura).toBe(true))

    mockedTickets.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await waitFor(() => expect(mockedExportCsv).toHaveBeenCalled())

    // A busca do export é uma chamada PRÓPRIA (fetchAllPaginated) — se ela não repassasse o
    // toggle, a planilha traria linhas que a tabela não mostra.
    const chamadasExport = mockedTickets.mock.calls.map(
      (c) => (c[0] as unknown as Record<string, unknown>).apenasFatura,
    )
    expect(chamadasExport.length).toBeGreaterThan(0)
    expect(chamadasExport.every((v) => v === true)).toBe(true)
  })
})
