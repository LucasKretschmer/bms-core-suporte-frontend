/**
 * 123/FE-PER (D-2) — **prova de wire**: com o filtro de período VAZIO, as DUAS metades da
 * tela saem com o MESMO período.
 *
 * O defeito que este arquivo existe para impedir (medido no backend em 05/09/2026):
 *  · `GET /api/v1/metrics/plan-consumption` (KPIs) — `from`/`to` ausentes caem no mês
 *    corrente (`FusoSaoPaulo.cs:149-162`);
 *  · `GET /api/v1/reports/tickets` (tabela) — limite ausente é **sem restrição nenhuma**
 *    (`ReportService.cs:740-767`, que declara isso por escrito e de propósito).
 * Resultado: cartões falando do mês atual e tabela falando do histórico inteiro, na mesma
 * tela, sem aviso.
 *
 * Por que o teste é de REQUISIÇÃO e não do hook nem do service: um default implementado e
 * não ligado deixa o teste de service verde (foi o que aconteceu com `apenasFatura` — ver
 * `fat-1-report.md` §7, mutação M3). O sujeito da frase da D-2 é "as duas requisições", logo
 * o teste é da requisição real, montando o painel inteiro e mockando só o `api` do projeto.
 *
 * ⚠️ Toda asserção sobre parâmetro de query casa o **valor inteiro** (`URLSearchParams.get`
 * ou igualdade de string), nunca `toContain` — `sortBy=cliente` é prefixo de
 * `sortBy=clienteNome`, e isso já mordeu nesta demanda.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'
import { ClientTicketsPanel } from './ClientTicketsPanel'
import { ToastProvider } from '../../../components/ui/Toast'
import { api } from '../../../services/api'

// Só o transporte é fake: `clientTicketsService` (que monta os params) roda de verdade.
vi.mock('../../../services/api', () => ({
  api: { get: vi.fn() },
}))
vi.mock('../../reports/shared/services/reportsService', () => ({
  getTicketStatuses: vi.fn().mockResolvedValue([]),
  listTeams: vi.fn().mockResolvedValue([]),
}))

const mockedGet = vi.mocked(api.get)

/** Relógio fixo — os literais de data abaixo são escritos à mão a partir dele. */
const AGORA = new Date(2026, 8, 15, 12, 0, 0)
const PRIMEIRO_DIA = '2026-09-01'
const ULTIMO_DIA = '2026-09-30'

const ROTA_TABELA = '/api/v1/reports/tickets'
const ROTA_KPIS = '/api/v1/metrics/plan-consumption'

type Params = Record<string, unknown>

function chamadas(url: string): Params[] {
  return mockedGet.mock.calls
    .filter((call) => call[0] === url)
    .map((call) => (call[1]?.params ?? {}) as Params)
}

function ultimaChamada(url: string): Params {
  const todas = chamadas(url)
  // Controle positivo: prova de ausência só vale se o ponto observado for alcançado.
  expect(todas.length).toBeGreaterThan(0)
  return todas[todas.length - 1]
}

function respostaPara(url: string): unknown {
  if (url === ROTA_KPIS) {
    return {
      items: [
        {
          clientId: 1,
          cnpj: '00.000.000/0001-00',
          nomeFantasia: 'Acme',
          razaoSocial: 'Acme LTDA',
          nomePlano: 'Plano X',
          qtdePlanoHoras: 10,
          horasUsadas: 4,
          horasRestantes: 6,
          horasAdicionais: 0,
          percentualPlano: 40,
          horasFaturaveis: 0,
          horasAnalise: 0,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 200,
      totalPages: 1,
    }
  }
  if (url === ROTA_TABELA) {
    return {
      items: [
        {
          ticketId: 1,
          hubspotTicketId: '1001',
          assunto: 'Chamado A',
          clienteNome: 'Acme',
          equipe: 'Suporte',
          ownerNome: 'Ana',
          status: 'Aberto',
          totalSeconds: 1500,
          apontamentosCount: 1,
          hubspotUrl: null,
          totalSecondsAllTime: 1500,
          apontamentosCountAllTime: 1,
          statusNome: null,
          statusCategoria: null,
          categoriasTimer: [],
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    }
  }
  // /reports/tickets/owners e afins — envelope ApiResponse
  return { data: [] }
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

beforeEach(() => {
  // Só o `Date` é falso: `setTimeout`/`setInterval` continuam reais, senão `waitFor` trava.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(AGORA)
  mockedGet.mockReset()
  mockedGet.mockImplementation((url: string) =>
    Promise.resolve({ data: respostaPara(url) }),
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('D-2 — filtro vazio: uma janela so, nas duas metades da tela', () => {
  it('as DUAS requisicoes saem com o MESMO periodo, e ele e o mes atual', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} />)

    await waitFor(() => expect(chamadas(ROTA_KPIS).length).toBeGreaterThan(0))
    await waitFor(() => expect(chamadas(ROTA_TABELA).length).toBeGreaterThan(0))

    const kpis = ultimaChamada(ROTA_KPIS)
    const tabela = ultimaChamada(ROTA_TABELA)

    // Valor INTEIRO, escrito à mão — não "contém", não derivado da resposta.
    expect(kpis.from).toBe(PRIMEIRO_DIA)
    expect(kpis.to).toBe(ULTIMO_DIA)
    expect(tabela.from).toBe(PRIMEIRO_DIA)
    expect(tabela.to).toBe(ULTIMO_DIA)

    // E a igualdade entre as duas, que é literalmente o requisito da D-2.
    expect({ from: tabela.from, to: tabela.to }).toEqual({ from: kpis.from, to: kpis.to })
  })

  it('nenhuma das duas requisicoes omite o periodo (era assim que o backend aplicava defaults opostos)', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} />)
    await waitFor(() => expect(chamadas(ROTA_TABELA).length).toBeGreaterThan(0))
    await waitFor(() => expect(chamadas(ROTA_KPIS).length).toBeGreaterThan(0))

    const todas = [...chamadas(ROTA_TABELA), ...chamadas(ROTA_KPIS)]
    expect(todas.length).toBeGreaterThanOrEqual(2)
    for (const params of todas) {
      expect(params).toHaveProperty('from')
      expect(params).toHaveProperty('to')
      expect(params.from).toBe(PRIMEIRO_DIA)
      expect(params.to).toBe(ULTIMO_DIA)
    }
  })

  it('a QUERY STRING real (serializer do projeto) leva from/to com o valor inteiro', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} />)
    await waitFor(() => expect(chamadas(ROTA_TABELA).length).toBeGreaterThan(0))
    await waitFor(() => expect(chamadas(ROTA_KPIS).length).toBeGreaterThan(0))

    // `importActual` fura o mock: aqui a instância é a REAL, com o paramsSerializer de
    // `services/api.ts` — objeto certo com serialização errada é 200 com filtro ignorado.
    const real = await vi.importActual<typeof import('../../../services/api')>(
      '../../../services/api',
    )

    const alvos = [
      [ROTA_TABELA, ultimaChamada(ROTA_TABELA)],
      [ROTA_KPIS, ultimaChamada(ROTA_KPIS)],
    ] as const

    for (const [url, params] of alvos) {
      const uri = real.api.getUri({ url, params })
      const query = new URLSearchParams(uri.split('?')[1] ?? '')
      // `.get()` compara o VALOR INTEIRO do parâmetro — nunca substring.
      expect(query.get('from')).toBe(PRIMEIRO_DIA)
      expect(query.get('to')).toBe(ULTIMO_DIA)
      // A forma que o model binder do ASP.NET ignoraria em silêncio.
      expect(query.get('from[]')).toBeNull()
      expect(query.get('to[]')).toBeNull()
    }

    // Controle positivo do medidor: a instância importada é a real (arrays em "repeat").
    const controle = new URLSearchParams(
      real.api
        .getUri({ url: ROTA_TABELA, params: { status: ['Aberto', 'Fechado'] } })
        .split('?')[1] ?? '',
    )
    expect(controle.getAll('status')).toEqual(['Aberto', 'Fechado'])
  })

  it('a tela DIZ qual periodo esta mostrando, e que ele e o padrao', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} />)
    const resumo = await screen.findByLabelText('Resumo do plano do cliente')

    // Default invisível é defeito de comunicação — foi o que fez o usuário achar que a tela
    // estava errada. As datas impressas são as MESMAS que foram ao wire.
    expect(resumo).toHaveTextContent('Período em uso: 01/09/2026 a 30/09/2026.')
    expect(resumo).toHaveTextContent(
      'É o mês atual, que é o padrão da tela — troque as datas no filtro para ver outro período.',
    )
  })

  it('os campos De/Ate nascem preenchidos com o mes atual (o filtro continua editavel)', async () => {
    renderPanel(<ClientTicketsPanel clientId={1} />)

    const de = await screen.findByLabelText('De')
    const ate = screen.getByLabelText('Até')
    expect(de).toHaveValue(PRIMEIRO_DIA)
    expect(ate).toHaveValue(ULTIMO_DIA)
  })
})

describe('D-2 — o default nao sequestra a escolha do usuario', () => {
  it('periodo vindo da tela-mae passa intacto as duas requisicoes', async () => {
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />,
    )
    await waitFor(() => expect(chamadas(ROTA_TABELA).length).toBeGreaterThan(0))
    await waitFor(() => expect(chamadas(ROTA_KPIS).length).toBeGreaterThan(0))

    expect(ultimaChamada(ROTA_TABELA).from).toBe('2026-07-01')
    expect(ultimaChamada(ROTA_TABELA).to).toBe('2026-07-31')
    expect(ultimaChamada(ROTA_KPIS).from).toBe('2026-07-01')
    expect(ultimaChamada(ROTA_KPIS).to).toBe('2026-07-31')

    // E a tela NÃO chama isso de padrão (a frase de padrão mentiria sobre a escolha dele).
    const resumo = screen.getByLabelText('Resumo do plano do cliente')
    expect(resumo).toHaveTextContent('Período em uso: 01/07/2026 a 31/07/2026.')
    expect(resumo).not.toHaveTextContent('que é o padrão da tela')
  })

  it('limpar AS DUAS pontas devolve a tela ao mes atual, nas duas requisicoes', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />,
    )
    await waitFor(() => expect(chamadas(ROTA_TABELA).length).toBeGreaterThan(0))
    await waitFor(() => expect(chamadas(ROTA_KPIS).length).toBeGreaterThan(0))

    await user.clear(screen.getByLabelText('De'))
    await user.clear(screen.getByLabelText('Até'))

    // O par de asserções que mata a reversão do default em QUALQUER um dos dois consumidores.
    await waitFor(() => {
      expect(ultimaChamada(ROTA_TABELA)).toMatchObject({
        from: PRIMEIRO_DIA,
        to: ULTIMO_DIA,
      })
    })
    await waitFor(() => {
      expect(ultimaChamada(ROTA_KPIS)).toMatchObject({
        from: PRIMEIRO_DIA,
        to: ULTIMO_DIA,
      })
    })

    const resumo = screen.getByLabelText('Resumo do plano do cliente')
    expect(resumo).toHaveTextContent('Período em uso: 01/09/2026 a 30/09/2026.')
  })

  /**
   * ⚠️ Este teste começa LIMPANDO os dois campos, e o passo não é decorativo.
   *
   * Com os campos semeados, `filters.from` já é o mês atual — então um export escrito como
   * `filters.from ?? undefined` produz exatamente o MESMO wire e o teste passaria com o
   * defeito ativo. Medido: essa mutação matou 0 testes na primeira versão deste arquivo.
   * O único estado em que o export pode divergir da tela é o de campo em branco, e é por
   * ele que o teste tem de passar. O export é a superfície mais grave do período: tela
   * errada o gestor recarrega, planilha errada ele encaminha (AP-FRONTEND-028).
   */
  it('o EXPORT sai com a janela da tela mesmo com os campos em branco', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />,
    )
    await waitFor(() => expect(chamadas(ROTA_TABELA).length).toBeGreaterThan(0))

    await user.clear(screen.getByLabelText('De'))
    await user.clear(screen.getByLabelText('Até'))
    await waitFor(() => expect(ultimaChamada(ROTA_TABELA).from).toBe(PRIMEIRO_DIA))

    const antes = chamadas(ROTA_TABELA).length
    await user.click(screen.getByLabelText('Baixar CSV'))

    // O export refaz a busca paginada; a chamada NOVA tem de levar o mesmo período.
    await waitFor(() => expect(chamadas(ROTA_TABELA).length).toBeGreaterThan(antes))
    const doExport = chamadas(ROTA_TABELA)[antes]
    expect(doExport.from).toBe(PRIMEIRO_DIA)
    expect(doExport.to).toBe(ULTIMO_DIA)
    // Controle positivo: é mesmo a chamada do EXPORT, não mais uma da tabela (o export usa
    // pageSize próprio). Sem isto, a asserção poderia estar medindo a requisição da tela.
    expect(doExport.pageSize).not.toBe(25)
  })

  it('limpar UMA ponta fecha so ela no mes atual — nas duas requisicoes e no texto', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderPanel(
      <ClientTicketsPanel clientId={1} initialFrom="2026-07-01" initialTo="2026-07-31" />,
    )
    await waitFor(() => expect(chamadas(ROTA_TABELA).length).toBeGreaterThan(0))

    await user.clear(screen.getByLabelText('Até'))

    await waitFor(() => {
      expect(ultimaChamada(ROTA_TABELA).to).toBe(ULTIMO_DIA)
    })
    await waitFor(() => {
      expect(ultimaChamada(ROTA_KPIS).to).toBe(ULTIMO_DIA)
    })
    // A outra ponta continua sendo a do usuário — resolução ponta a ponta, não "tudo ou nada".
    expect(ultimaChamada(ROTA_TABELA).from).toBe('2026-07-01')
    expect(ultimaChamada(ROTA_KPIS).from).toBe('2026-07-01')

    const resumo = screen.getByLabelText('Resumo do plano do cliente')
    expect(resumo).toHaveTextContent('Período em uso: 01/07/2026 a 30/09/2026.')
    expect(resumo).toHaveTextContent(
      'A data final ficou em branco, então vale o último dia do mês atual.',
    )
  })
})
