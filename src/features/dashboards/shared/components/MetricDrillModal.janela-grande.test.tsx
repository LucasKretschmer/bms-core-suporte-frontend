/**
 * 124/FE-P3b (`N-1` do QA) — o `422 DATE_RANGE_TOO_LARGE` no MODAL DE DRILL.
 *
 * ## Por que este arquivo existe
 *
 * `fe-p3-report.md` §3.1 afirmava que os drills `tickets-sla`/`tickets-fcr` eram
 * **inalcançáveis** com o período recusado. As três leituras de código daquela afirmação
 * estavam certas e a conclusão estava errada: `useMetricsOverview.ts:29` usa
 * `placeholderData: keepPreviousData`, então **enquanto a requisição do período novo está
 * em voo** o overview ainda não é `isError` e os KPIs seguem renderizados e clicáveis.
 * O QA reproduziu no navegador e o modal mostrou "Ocorreu um erro ao carregar os dados.".
 *
 * ## Por que o teste usa o hook REAL
 *
 * O elo que faltava era o hook **não expor** `error` (só `isError`). Um teste que
 * montasse o `drill` à mão continuaria verde com o hook quebrado — provaria o modal, não
 * a fiação. Aqui `useMetricDrill` é o de verdade, com `getMetricRows` rejeitando: as duas
 * pontas (hook expõe · modal usa) ficam sob a mesma asserção, e as duas mutações
 * dirigidas têm vítima de COMPONENTE.
 */

import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../services/metricsService', () => ({ getMetricRows: vi.fn() }))

import { MetricDrillModal } from './MetricDrillModal'
import { useMetricDrill } from '../hooks/useMetricDrill'
import { getMetricRows } from '../services/metricsService'
import { ToastProvider } from '../../../../components/ui/Toast'
// 125/FE-A11Y-4 (`Q-2`): o medidor do repo é UM SÓ (`utils/contrasteDeTexto.ts`), servido
// pelo harness `test/medidor-de-contraste.ts` — reusado, nunca reescrito.
import { reprovacoesAA, varrer } from '../../../../test/medidor-de-contraste'
import type { ColumnDef } from '../../../../components/ui/DataTable/types'
import type { DrillSpec, MetricsBaseParams, TicketRowDto } from '../types/metrics'

/** Literal do backend (`DateRangeGuard.cs:56-58`), escrito à mão. */
const MENSAGEM_DO_BACKEND =
  'O período não pode ser maior que 1 ano (366 dias). ' +
  'Escolha um intervalo menor — por exemplo um mês, ou o ano corrente — e consulte os ' +
  'períodos anteriores em consultas separadas.'

/** Default do `ErrorState` do app — o genérico que o QA viu na tela. */
const GENERICO = 'Ocorreu um erro ao carregar os dados.'

/** O período grande demais do cenário do QA: mais de 366 dias resolvidos. */
const BASE: MetricsBaseParams = {
  scope: 'management:suporte',
  from: '2020-01-01',
  to: '2026-09-06',
  clientId: null,
}

const SPEC: DrillSpec = {
  metric: 'tickets-sla',
  title: 'Atendidos no prazo (SLA)',
  params: { sla: 'on' },
}

function erroApi(status: number, code: string, message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code, message } },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

/** Colunas vazias: no caminho de erro nenhuma linha é renderizada. */
const SEM_COLUNAS: ColumnDef<TicketRowDto>[] = []

/** Fiação real: hook de verdade → modal de verdade. */
function DrillReal() {
  const drill = useMetricDrill<TicketRowDto>(SPEC, BASE)
  return (
    <MetricDrillModal<TicketRowDto>
      activeDrill={SPEC}
      onClose={() => {}}
      drill={drill}
      columns={SEM_COLUNAS}
      baseParams={BASE}
      exportFilename="drill-down-tickets"
    />
  )
}

async function renderComErro(error: unknown) {
  vi.mocked(getMetricRows).mockRejectedValue(error)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const utils = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <DrillReal />
      </ToastProvider>
    </QueryClientProvider>,
  )
  const alerta = await screen.findByRole('alert')
  return { ...utils, alerta }
}

// ── Contraste: tema derivado da cascata real de CSS do app ────────────────────
/** Varre e exige que nada tenha sido pulado — recusa do medidor reprova aqui (`Q-3`). */
const medir = (raiz: Element) => {
  const { medidas, pulados } = varrer(raiz)
  expect(pulados).toEqual([])
  return medidas
}

describe('MetricDrillModal — 422 DATE_RANGE_TOO_LARGE (FE-P3b · N-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra a MESMA mensagem do dashboard — motivo, limite do servidor e ação', async () => {
    // O que faz este assert ficar vermelho: (a) o hook voltar a não expor `error`
    // (mutação P3B-HOOK-SEM-ERROR) ou (b) o modal ignorar o erro e cair no genérico
    // (mutação P3B-MODAL-SEM-TRATAMENTO). As duas são reversões exatas do defeito do N-1.
    const { alerta } = await renderComErro(
      erroApi(422, 'DATE_RANGE_TOO_LARGE', MENSAGEM_DO_BACKEND),
    )

    expect(alerta).toHaveTextContent('O período não pode ser maior que 1 ano (366 dias).')
    expect(alerta).toHaveTextContent('Escolha um intervalo menor')
    expect(alerta).toHaveTextContent('Ajuste o filtro de período.')
    expect(alerta).not.toHaveTextContent(GENERICO)
  })

  it('a requisição do drill de fato saiu com o período grande demais', async () => {
    // Companheira do teste acima pelo lado do WIRE: sem ela, "o modal mostra a frase"
    // poderia estar sendo provado sem que o caminho do 422 fosse o exercitado.
    await renderComErro(erroApi(422, 'DATE_RANGE_TOO_LARGE', MENSAGEM_DO_BACKEND))

    expect(getMetricRows).toHaveBeenCalledWith(
      expect.objectContaining({
        metric: 'tickets-sla',
        from: '2020-01-01',
        to: '2026-09-06',
        sla: 'on',
      }),
    )
  })

  it('COMPANHEIRA POSITIVA: outro código continua no genérico do modal', async () => {
    const { alerta } = await renderComErro(
      erroApi(500, 'INTERNAL', 'Ocorreu um erro interno. Tente novamente mais tarde.'),
    )

    expect(alerta).toHaveTextContent(GENERICO)
    expect(alerta).not.toHaveTextContent('Ajuste o filtro de período.')
    expect(alerta).not.toHaveTextContent('366')
  })

  it('erro SEM envelope (rede) também continua no genérico', async () => {
    const { alerta } = await renderComErro(new Error('Network Error'))
    expect(alerta).toHaveTextContent(GENERICO)
  })

  it('a mensagem passa no piso AA dentro do modal — medida no DOM renderizado', async () => {
    const { alerta } = await renderComErro(
      erroApi(422, 'DATE_RANGE_TOO_LARGE', MENSAGEM_DO_BACKEND),
    )

    const medidas = medir(alerta)
    expect(medidas.length).toBeGreaterThan(0)
    expect(medidas.some((m) => m.texto.includes('O período não pode ser maior'))).toBe(true)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('CONTROLE POSITIVO do medidor: ele reprova um par sabidamente ruim', () => {
    // Sem isto, o `toEqual([])` acima seria satisfeito por um medidor morto.
    const raiz = document.createElement('div')
    raiz.innerHTML =
      '<div class="bg-card"><p class="text-sm text-primary/30">quase invisível</p></div>'

    expect(reprovacoesAA(medir(raiz))).toHaveLength(1)
  })
})
