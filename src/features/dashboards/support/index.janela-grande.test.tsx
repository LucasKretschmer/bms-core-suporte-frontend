/**
 * 124/FE-P3 — o `422 DATE_RANGE_TOO_LARGE` no CARD "1º Atendimento vs SLA".
 *
 * O mesmo `/metrics/overview` alimenta os KPIs e este card, então o 422 chega aos dois.
 * Este arquivo cobre o segundo caminho, e cobre-o pela PÁGINA (é ela que tem o objeto de
 * erro do `useMetricsOverview` e decide o texto) — testar só o componente provaria que
 * ele repassa uma prop, não que a prop chega nele.
 *
 * Estrutura de mocks herdada de `index.rbac.test.tsx`: as demais seções saem do caminho,
 * `SupportSlaSection` é o componente REAL.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DashboardSuportePage from './index'
import { useMetricsOverview } from '../shared/hooks/useMetricsOverview'
import { derivarCascataDeCssDoApp, lerTokensDeCor } from '../../../utils/cssCascade'
// Medidor de contraste de `FE-FIX2` — reusado, nunca reescrito.
import {
  medirTextosDoDom,
  reprovacoesAA,
  temaDaCascata,
} from '../../support-plans/utils/contrasteDeTexto'

vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: 'GERENTE',
    isCoordenadorOuAcima: true,
    isGerentePlus: true,
    isAtendente: false,
    isGestor: true,
    isAuthenticated: true,
    primaryTeamId: null,
  }),
}))

// Seções pesadas fora do caminho — a que interessa aqui é a de SLA, que fica REAL.
vi.mock('./components/SupportKpiSection', () => ({ SupportKpiSection: () => null }))
vi.mock('./components/SupportMovimentacaoSection', () => ({
  SupportMovimentacaoSection: () => null,
}))
vi.mock('./components/SupportStatusSection', () => ({ SupportStatusSection: () => null }))
vi.mock('./components/SupportCategorySection', () => ({ SupportCategorySection: () => null }))
vi.mock('./components/SupportPlanHealthSection', () => ({
  SupportPlanHealthSection: () => null,
}))
vi.mock('../panel/PanelMode', () => ({ PanelMode: () => null }))
vi.mock('../shared/components/DashboardFilters', () => ({
  DashboardFilters: () => <div data-testid="dashboard-filters" />,
}))

vi.mock('../shared/hooks/useMetricsOverview', () => ({
  useMetricsOverview: vi.fn(),
}))
vi.mock('../shared/hooks/useMetricsStream', () => ({
  useMetricsStream: () => ({ status: 'idle', pause: vi.fn(), resume: vi.fn() }),
}))
vi.mock('../../reports/shared/services/reportsService', () => ({
  listTeams: vi.fn().mockResolvedValue([]),
}))

const mockedUseMetricsOverview = vi.mocked(useMetricsOverview)

/** Literal do backend (`DateRangeGuard.cs:56-58`), escrito à mão. */
const MENSAGEM_DO_BACKEND =
  'O período não pode ser maior que 1 ano (366 dias). ' +
  'Escolha um intervalo menor — por exemplo um mês, ou o ano corrente — e consulte os ' +
  'períodos anteriores em consultas separadas.'

/** Default do `ErrorState` do app — o genérico que a unidade existe para não repetir. */
const GENERICO_DO_CARD = 'Ocorreu um erro ao carregar os dados.'

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

function renderComErro(error: unknown) {
  mockedUseMetricsOverview.mockReturnValue({
    data: undefined,
    error,
    isLoading: false,
    isError: true,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useMetricsOverview>)

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DashboardSuportePage />
    </QueryClientProvider>,
  )
}

// ── Contraste: tema derivado da cascata real de CSS do app ────────────────────
const lerCssDoDisco = (caminho: string): string =>
  readFileSync(resolve(process.cwd(), caminho), 'utf8')
const CASCATA_CSS = derivarCascataDeCssDoApp(lerCssDoDisco)
const TOKENS = lerTokensDeCor(CASCATA_CSS, lerCssDoDisco)
const TEMA = temaDaCascata(CASCATA_CSS, lerCssDoDisco, TOKENS)

const medirTela = (container: HTMLElement) =>
  medirTextosDoDom(container, { tema: TEMA, fundoPadrao: TOKENS['--color-background'] })

describe('Dashboard Suporte — card de SLA com 422 DATE_RANGE_TOO_LARGE (FE-P3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('o card diz o motivo e o limite do servidor, não o genérico', () => {
    // O que faz este assert ficar vermelho: a página deixar de passar `errorMessage`
    // (mutação P3-SLA-SEM-MENSAGEM) ou o `ChartCard` deixar de repassá-lo ao `ErrorState`
    // (mutação P3-CHARTCARD-IGNORA).
    renderComErro(erroApi(422, 'DATE_RANGE_TOO_LARGE', MENSAGEM_DO_BACKEND))

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('O período não pode ser maior que 1 ano (366 dias).')
    expect(alerta).toHaveTextContent('Ajuste o filtro de período.')
    expect(alerta).not.toHaveTextContent(GENERICO_DO_CARD)
  })

  it('a mensagem passa no piso AA DENTRO do card — medida no DOM renderizado', () => {
    // O fundo aqui é `bg-card` (o `ChartCard`), não o da página — `fundoEfetivo` sobe a
    // cadeia sozinho. Sem esta medição, a frase que a unidade entrega poderia chegar ao
    // usuário ilegível, como aconteceu com o `EmptyState` do DS (1,84:1, FE-F4).
    const { container } = renderComErro(
      erroApi(422, 'DATE_RANGE_TOO_LARGE', MENSAGEM_DO_BACKEND),
    )

    const medidas = medirTela(container)
    expect(medidas.length).toBeGreaterThan(0)
    expect(medidas.some((m) => m.texto.includes('O período não pode ser maior'))).toBe(true)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('CONTROLE POSITIVO do medidor: ele reprova um par sabidamente ruim', () => {
    // Sem isto, o `toEqual([])` acima seria satisfeito por um medidor morto.
    const raiz = document.createElement('div')
    raiz.innerHTML =
      '<div class="bg-card"><p class="text-sm text-primary/30">quase invisível</p></div>'

    expect(reprovacoesAA(medirTela(raiz))).toHaveLength(1)
  })

  it('COMPANHEIRA POSITIVA: outro código continua no genérico do card', () => {
    renderComErro(erroApi(500, 'INTERNAL', 'Ocorreu um erro interno. Tente novamente mais tarde.'))

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent(GENERICO_DO_CARD)
    expect(alerta).not.toHaveTextContent('Ajuste o filtro de período.')
    expect(alerta).not.toHaveTextContent('366')
  })
})
