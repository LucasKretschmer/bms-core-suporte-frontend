/**
 * Estado vazio do card "Saúde dos Planos" — a decisão é da SEÇÃO (123/D4).
 *
 * ## Por que este arquivo existe separado
 *
 * A guarda de "há dado utilizável?" existe em duas camadas irmãs: no `ChartCard`
 * (`isEmpty` da seção) e dentro do `PlanHealthChart`. Camadas irmãs se validam com
 * mutações DIFERENTES: enquanto uma delas segura, reverter a outra não muda nada do que o
 * usuário vê — e um teste que só olha a tela inteira fica verde com uma das duas
 * quebrada.
 *
 * Aqui o `PlanHealthChart` é **mockado** por um marcador, então a única coisa capaz de
 * mostrar a mensagem de vazio é o `isEmpty` da seção. É o que torna
 * `isEmpty = !summary` (o defeito original) detectável.
 *
 * O payload é JSON literal do backend, como em
 * `SupportPlanHealthSection.wire.test.tsx` — nunca construído a partir do tipo do front.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../shared/components/PlanHealthChart', () => ({
  PlanHealthChart: () => <div data-testid="plan-health-chart" />,
}))

vi.mock('../../../../services/api', () => ({ api: { get: vi.fn() } }))

vi.mock('../../../reports/shared/utils/exportTable', () => ({
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { api } from '../../../../services/api'
import { SupportPlanHealthSection } from './SupportPlanHealthSection'
import { ToastProvider } from '../../../../components/ui/Toast'

const WIRE_COM_DADOS = `{
  "data": [
    {
      "clientId": 41,
      "nomeFantasia": "ACME Ltda",
      "planNome": "Premium",
      "horasContratadas": 40,
      "horasConsumidas": 20,
      "percentualConsumo": 50,
      "faixa": "verde"
    }
  ],
  "summary": { "totalClientes": 3, "verde": 2, "amarelo": 1, "vermelho": 0 }
}`

const WIRE_SEM_CLIENTES = `{
  "data": [],
  "summary": { "totalClientes": 0, "verde": 0, "amarelo": 0, "vermelho": 0 }
}`

/** Chaves que o backend não emite (o shape que o front supunha até a 123/D4). */
const WIRE_DIVERGENTE_LEGADO = `{
  "data": [],
  "summary": { "totalVerde": 2, "totalAmarelo": 1, "totalVermelho": 0 }
}`

const MENSAGEM_VAZIO = 'Sem dados de planos para o período.'

function responderCom(json: string) {
  vi.mocked(api.get).mockResolvedValue({ data: JSON.parse(json) as unknown })
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SupportPlanHealthSection from="2026-06-01" to="2026-06-30" />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('SupportPlanHealthSection — quem decide o estado vazio é a seção', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('com dado utilizável → renderiza o gráfico e NÃO a mensagem de vazio', async () => {
    responderCom(WIRE_COM_DADOS)
    renderSection()

    expect(await screen.findByTestId('plan-health-chart')).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_VAZIO)).not.toBeInTheDocument()
  })

  it('zero cliente com plano → mensagem de vazio e o gráfico nem é montado', async () => {
    responderCom(WIRE_SEM_CLIENTES)
    renderSection()

    expect(await screen.findByText(MENSAGEM_VAZIO)).toBeInTheDocument()
    expect(screen.queryByTestId('plan-health-chart')).not.toBeInTheDocument()
  })

  it('summary presente com chaves divergentes → mensagem de vazio, não gráfico', async () => {
    responderCom(WIRE_DIVERGENTE_LEGADO)
    renderSection()

    expect(await screen.findByText(MENSAGEM_VAZIO)).toBeInTheDocument()
    expect(screen.queryByTestId('plan-health-chart')).not.toBeInTheDocument()
  })
})
