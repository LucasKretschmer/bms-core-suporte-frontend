/**
 * 123/FE-PER (D-14 / AUTO-1) — o card "Saúde dos Planos" DIZ o que mede.
 *
 * Contexto medido no backend em 05/09/2026 (não presumido):
 *  · `GET /metrics/plan-health` soma por `te.InicioEm`
 *    (`MetricsQueryRepository.cs:1258-1266`) — medidor **ao vivo**, decisão do usuário na
 *    D-14: *"a saúde dos planos deve ir marcando conforme o time vai lançando os tempos"*;
 *  · `GET /metrics/plan-consumption` soma por `Ticket.FechadoEm`
 *    (`ReportQueryRepository.cs:759-763`) — regra de **fatura**.
 * As duas estão certas. A divergência é legítima e some quando explicada; sem rótulo, ela
 * parece erro — e foi assim que chegou como queixa.
 *
 * O que deixa cada asserção VERMELHA está escrito ao lado de cada caso. O eixo que mais
 * importa: **o rótulo sobrevive aos quatro estados do card**. Explicação que desaparece no
 * vazio/erro é a que falta exatamente no momento em que o leitor precisa dela (é o mesmo
 * motivo pelo qual a `CompetenciaNota` foi para o slot `banner` em FAT-1).
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
import {
  TEXTO_SAUDE_PLANOS_COMPARACAO,
  TEXTO_SAUDE_PLANOS_ROTULO,
} from '../../../reports/shared/utils/competenciaTexts'

/** JSON literal do backend — nunca construído a partir do tipo do front. */
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

/** O card inteiro, escopo das asserções (o rótulo tem de estar DENTRO dele). */
function card(): HTMLElement {
  return screen.getByRole('region', { name: 'Saúde dos Planos' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('o card diz que é um medidor ao vivo', () => {
  it('com dados: rótulo e comparação visíveis dentro do card', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: JSON.parse(WIRE_COM_DADOS) as unknown })
    renderSection()

    expect(await screen.findByTestId('plan-health-chart')).toBeInTheDocument()
    expect(card()).toHaveTextContent(TEXTO_SAUDE_PLANOS_ROTULO)
    expect(card()).toHaveTextContent(TEXTO_SAUDE_PLANOS_COMPARACAO)
  })

  it('no estado VAZIO o rótulo continua na tela', async () => {
    // Sem o rótulo aqui, "Sem dados de planos para o período" é a única informação, e o
    // leitor não tem como saber que o outro relatório usa outra data.
    vi.mocked(api.get).mockResolvedValue({ data: JSON.parse(WIRE_SEM_CLIENTES) as unknown })
    renderSection()

    expect(await screen.findByText('Sem dados de planos para o período.')).toBeInTheDocument()
    expect(card()).toHaveTextContent(TEXTO_SAUDE_PLANOS_ROTULO)
    expect(card()).toHaveTextContent(TEXTO_SAUDE_PLANOS_COMPARACAO)
  })

  it('no estado de ERRO o rótulo continua na tela', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('falha'))
    renderSection()

    expect(
      await screen.findByRole('button', { name: /tentar novamente/i }),
    ).toBeInTheDocument()
    expect(card()).toHaveTextContent(TEXTO_SAUDE_PLANOS_ROTULO)
  })

  it('durante o LOADING o rótulo já está na tela', () => {
    // Promise que nunca resolve: o card fica em skeleton.
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}))
    renderSection()

    expect(card()).toHaveTextContent(TEXTO_SAUDE_PLANOS_ROTULO)
    // Controle positivo do estado observado: é mesmo o loading, não uma resposta vazia.
    expect(screen.queryByTestId('plan-health-chart')).not.toBeInTheDocument()
    expect(screen.queryByText('Sem dados de planos para o período.')).not.toBeInTheDocument()
  })

  it('o rótulo é texto do card, não tooltip escondido atrás de hover', async () => {
    // `InfoIcon` renderiza a explicação só sob hover/foco e com `whitespace-nowrap`; para
    // um parágrafo desta extensão isso seria explicação que ninguém lê.
    vi.mocked(api.get).mockResolvedValue({ data: JSON.parse(WIRE_COM_DADOS) as unknown })
    renderSection()
    await screen.findByTestId('plan-health-chart')

    const paragrafo = screen.getByText(
      `${TEXTO_SAUDE_PLANOS_ROTULO} ${TEXTO_SAUDE_PLANOS_COMPARACAO}`,
    )
    expect(paragrafo.tagName).toBe('P')
    expect(paragrafo.closest('[role="tooltip"]')).toBeNull()
  })
})


// ─── 131 (08/09/2026) — o medidor deixou de acusar "horas de projeto" ─────────

describe('🔴 131: o card não atribui mais a diferença às horas de projeto', () => {
  /**
   * Vítima de COMPONENTE com literal escrito à mão. Os casos acima comparam com
   * `TEXTO_SAUDE_PLANOS_COMPARACAO` e ficariam verdes se a constante voltasse à redação
   * antiga; estes fragmentos vêm da redação decidida em 08/09/2026, digitados aqui.
   */
  it('a frase antiga não volta — e a nova está no card (companheira positiva)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: JSON.parse(WIRE_COM_DADOS) as unknown })
    renderSection()
    await screen.findByTestId('plan-health-chart')

    // Positiva primeiro: o card renderizou e traz a explicação nova.
    expect(card()).toHaveTextContent('Por diferenças como essas')
    expect(card()).toHaveTextContent('Hora de projeto não consome plano em nenhum dos dois')
    // ⚠️ e sem sugerir que projeto saiu da cobrança.
    expect(card()).toHaveTextContent('continua registrado e faturável')

    // Negativas: as duas formas revogadas pela 131.
    expect(card()).not.toHaveTextContent('soma também as horas lançadas em projetos')
    expect(card()).not.toHaveTextContent('Por essas duas razões')
  })

  it('o card nomeia a razão que PERMANECE (a data) e a terceira (quem entra na lista)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: JSON.parse(WIRE_COM_DADOS) as unknown })
    renderSection()
    await screen.findByTestId('plan-health-chart')

    // `MetricsQueryRepository.cs:1465-1473` (InicioEm) × `ReportQueryRepository.cs:777-785`
    // (Ticket.FechadoEm) — lido no backend em 08/09/2026.
    expect(card()).toHaveTextContent('data em que o chamado foi concluído')
    expect(card()).toHaveTextContent('data em que o time lançou a hora')
    // `c.SupportPlanId != null` (`MetricsQueryRepository.cs:1459`) × elegibilidade do
    // plan-consumption (`ReportQueryRepository.cs:683-693`).
    expect(card()).toHaveTextContent('lista também cliente sem plano contratado')
    expect(card()).toHaveTextContent('só quem tem plano')
  })
})
