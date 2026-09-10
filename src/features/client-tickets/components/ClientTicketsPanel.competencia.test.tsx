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
// 134 — `importOriginal`: só `exportToCsv`/`exportToXlsx` são encenados. `durationCell`
// TEM de ser o real, senão o teste do export mediria um dublê e não o guard de ausência do
// núcleo (o exceljs continua fora, porque só `exportToXlsx` o importa, e ele está mockado).
vi.mock('../../reports/shared/utils/exportTable', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../reports/shared/utils/exportTable')>()),
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { ClientTicketsPanel } from './ClientTicketsPanel'
import { ToastProvider } from '../../../components/ui/Toast'
import { getClientKpis, listClientTickets } from '../services/clientTicketsService'
import { exportToCsv } from '../../reports/shared/utils/exportTable'
import {
  TEXTO_APENAS_FATURA_LABEL,
  TEXTO_DIVERGENCIA_KPI_TABELA,
  textoPeriodoDoDetalhe,
} from '../../reports/shared/utils/competenciaTexts'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../test/duracaoExport'
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
   * 🔴 **INVERTIDO em 132/F2 (D7).** Este caso era a prova de RENDER da ressalva `F-2` de
   * 123/FE-FIX3: que a frase de período e o subtexto do cartão "Em aberto" conviviam na
   * MESMA dobra sem se contradizer — a frase excetuava o cartão, o cartão dizia "independe
   * do período", e as duas afirmações fechavam.
   *
   * **As duas pontas saíram.** O cartão foi removido do painel e a exceção saiu da frase,
   * no mesmo commit e pelo mesmo motivo: `horasEmAbertoNaoFaturadas` saiu do wire
   * (132/B1+B2) e, com `TimeEntry.InicioEm` como competência (D1), não existe mais hora
   * fora de fatura esperando um chamado fechar.
   *
   * O caso foi invertido porque o **risco mudou de lado**: o que se prova agora é que a
   * tela não ficou com uma exceção ÓRFÃ, apontando para um cartão que o usuário não
   * encontra. Isso é pior que a contradição original — na contradição as duas frases
   * existiam; aqui uma delas manda procurar o que não há.
   *
   * O irmão unitário (`competenciaTexts.test.ts`) prova o conteúdo da frase; aqui o sujeito
   * é o `<section>` RENDERIZADO, que é onde o QA humano leu o defeito da `F-2`.
   */
  it('🔴 132/F2: nem o cartão "Em aberto" nem a exceção órfã estão na dobra renderizada', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(within(resumo()).getByText('4h 0m')).toBeInTheDocument())

    const secao = resumo()
    const texto = secao.textContent ?? ''

    // Companheira POSITIVA: a dobra existe, carregou e afirma o período. Sem isto, tudo
    // abaixo passaria sobre uma seção vazia ou em skeleton.
    expect(texto).toContain('Período em uso:')
    expect(texto).toContain('A tabela e os cartões abaixo usam este mesmo período.')

    // (1) o cartão não está na tela — rótulo E subtexto, que eram dois nós distintos.
    expect(within(secao).queryByText('Em aberto (não faturável ainda)')).not.toBeInTheDocument()
    expect(
      within(secao).queryByText(
        'Total, independe do período — trabalho em chamados ainda sem data de conclusão.',
      ),
    ).not.toBeInTheDocument()

    // (2) e a exceção não sobrou órfã no texto da dobra.
    expect(texto).not.toContain('menos o cartão')
    expect(texto).not.toContain('total acumulado')
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
        // planilha escreve "—"/célula vazia em vez de "0h 0m"/"Invalid Date".
        ticket({ ticketId: 2, hubspotTicketId: '10002' }),
        // Terceira linha com `null` EXPLÍCITO — a OUTRA forma de ausente no wire.
        //
        // ⚠️ Esta linha foi acrescentada DEPOIS de uma mutação dirigida: trocar o guard
        // `== null` por `=== undefined` em `baldeTexto`/`concluidoEmTexto` derrubava só o
        // teste unitário puro e deixava o EXPORT verde — a superfície mais grave ficava
        // descoberta justamente para a forma de ausência que o defeito produz
        // (`rules/tests.md`: ler o resultado da mutação por CLASSE de prova, não por
        // contagem; `AP-FRONTEND-028`: testar com `null` explícito, não só `undefined`).
        // 134: o guard passou a morar em `durationCell`, e a mutação continua valendo —
        // por isso as três formas (ausente, `null`, zero) seguem na MESMA planilha.
        ticket({
          ticketId: 3,
          hubspotTicketId: '10003',
          fechadoEm: null,
          faturaPlanoSegundos: null,
          faturaFaturadoSegundos: null,
          faturaAnaliseSegundos: null,
        }),
        // 134 — quarta linha: ZERO LEGÍTIMO. É a companheira positiva das asserções de
        // ausência acima e o que separa o guard certo (`== null`) da sobre-correção
        // (`if (!v) return null`), que devolveria vazio aqui e apagaria um dado real.
        ticket({
          ticketId: 4,
          hubspotTicketId: '10004',
          totalSeconds: 0,
          faturaPlanoSegundos: 0,
          faturaFaturadoSegundos: 0,
          faturaAnaliseSegundos: 0,
        }),
      ],
      totalCount: 4,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    // 134 — a TELA não muda: a tabela visível continua em "1h 0m"/"0h 25m"/"—". Sem esta
    // prova, converter o `accessor` em vez do mapper do export passaria despercebido.
    const tabela = screen.getByRole('table')
    expect(within(tabela).getAllByText('1h 0m').length).toBeGreaterThan(0)
    expect(within(tabela).getAllByText('0h 25m').length).toBeGreaterThan(0)
    expect(within(tabela).getAllByText('—').length).toBeGreaterThan(0)

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
    // 134 — SEGUNDOS crus, número, literais escritos à mão. Um '1h 0m' aqui é reprovação:
    // texto pré-formatado é justamente o que impede o gestor de somar na planilha.
    expect(linhas[0]).toMatchObject({
      concluidoEm: '05/08/2026',
      naFatura: 'Sim',
      tempo: 1500,
      baldePlano: 3600,
      baldeFaturado: 1800,
      baldeAnalise: 900,
    })
    // Ausência ⇒ célula VAZIA (`null`), nunca 0 e nunca "—" numa coluna numérica. As
    // colunas de TEXTO ("Concluído em", "Na fatura") seguem com "—" — nada disso mudou.
    expect(linhas[1]).toMatchObject({
      concluidoEm: '—',
      naFatura: '—',
      baldePlano: null,
      baldeFaturado: null,
      baldeAnalise: null,
    })
    // `null` no wire produz a MESMA célula vazia — nunca "Invalid Date", "0h 0m" nem 0.
    expect(linhas[2]).toMatchObject({
      concluidoEm: '—',
      baldePlano: null,
      baldeFaturado: null,
      baldeAnalise: null,
    })
    // `undefined` é o que um mapper SEM helper produziria na linha de chave ausente;
    // exigir `null` é o que discrimina "passou pelo `durationCell`" de "passou cru".
    expect(linhas[1].baldePlano).not.toBeUndefined()
    // ZERO é valor: sai 0, não célula vazia. Vermelho com `if (!v) return null`.
    expect(linhas[3].tempo).toBe(0)
    expect(linhas[3].baldePlano).toBe(0)
    expect(linhas[3].baldeFaturado).toBe(0)
    expect(linhas[3].baldeAnalise).toBe(0)
    // Companheira positiva do arquivo inteiro: a linha 0 continua com valores REAIS, então
    // nenhuma das asserções de vazio acima é satisfeita por um export que não escreve nada.
    expect(linhas[0].tempo).toBe(1500)
  })

  /**
   * 134/§9.3 — invariante da superfície S5. A enumeração NÃO é mantida à mão: sai do
   * `chavesDeDuracao` sobre as colunas que o componente REALMENTE passou ao export.
   *
   * O que fica vermelho: tirar o `type: 'duration'` de qualquer uma das 4 (identidade, não
   * cardinalidade — trocar uma pela outra também reprova); marcar como duração uma coluna
   * que não é (`apontamentos` é CONTAGEM, `concluidoEm` é INSTANTE); e o mapper voltar a
   * pré-formatar em qualquer das 4 chaves derivadas.
   */
  it('as 4 colunas de duração são exatamente {tempo, baldePlano, baldeFaturado, baldeAnalise}', async () => {
    mockedTickets.mockResolvedValue({
      items: [
        ticket({
          ticketId: 1,
          hubspotTicketId: '10001',
          faturaPlanoSegundos: 3600,
          faturaFaturadoSegundos: 1800,
          faturaAnaliseSegundos: 900,
        }),
        ticket({ ticketId: 2, hubspotTicketId: '10002' }),
      ],
      totalCount: 2,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })
    renderPanel(<ClientTicketsPanel clientId={1} initialFrom={FROM} initialTo={TO} />)
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: 'Baixar CSV' }))
    await waitFor(() => expect(mockedExportCsv).toHaveBeenCalledTimes(1))

    const colunas = mockedExportCsv.mock.calls[0][1]
    const linhas = mockedExportCsv.mock.calls[0][2]

    expect(new Set(chavesDeDuracao(colunas))).toEqual(
      new Set(['tempo', 'baldePlano', 'baldeFaturado', 'baldeAnalise']),
    )
    // Negativas nomeadas: contagem e instante NÃO são duração (PRD §2.4).
    expect(chavesDeDuracao(colunas)).not.toContain('apontamentos')
    expect(chavesDeDuracao(colunas)).not.toContain('concluidoEm')

    // Derivado: para cada chave acima, o mapper devolve `number | null` — nunca "2h 44m".
    // O helper começa pelos dois controles positivos contra "satisfeito pelo vazio".
    assertCelulasDeDuracaoSaoNumericas(colunas, linhas)
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
