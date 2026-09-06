/**
 * Testes de PlanHealthChart.
 *
 * Demanda 015 — a tabela de clientes abaixo do gráfico foi removida.
 * Estes testes garantem que NENHUMA <table> é renderizada (regressão da 015)
 * e que os estados de loading/empty continuam funcionando.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlanHealthChart } from './PlanHealthChart'
import type { PlanHealthSummaryDto } from '../types/metrics'

vi.mock('../utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-verde': '#16A34A',
    'chart-amarelo': '#D97706',
    'chart-vermelho': '#DC2626',
  }),
}))

// Chaves do WIRE do backend (`MetricsDtos.cs:132`) — ver 123/D4. Quantidades diferentes
// por faixa de propósito: com 1/1/1 uma asserção de contagem passa com o alvo trocado.
const SUMMARY: PlanHealthSummaryDto = {
  totalClientes: 8,
  verde: 5,
  amarelo: 2,
  vermelho: 1,
}

describe('PlanHealthChart', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('não renderiza nenhuma tabela (015 — tabela vazia removida)', () => {
    const { container } = render(<PlanHealthChart summary={SUMMARY} />)
    expect(container.querySelector('table')).toBeNull()
  })

  it('summary nulo → renderiza empty state', () => {
    render(<PlanHealthChart summary={null} />)
    expect(screen.getByText(/sem dados de planos/i)).toBeInTheDocument()
  })

  it('isLoading=true → renderiza skeleton, não gráfico', () => {
    render(<PlanHealthChart summary={SUMMARY} isLoading />)
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy()
  })

  it('renderiza sem crash com summary válido', () => {
    expect(() => render(<PlanHealthChart summary={SUMMARY} />)).not.toThrow()
  })

  it('aceita height customizado', () => {
    expect(() =>
      render(<PlanHealthChart summary={SUMMARY} height={400} />),
    ).not.toThrow()
  })

  // ── Guarda de dado utilizável (123/D4) ──────────────────────────────────────
  //
  // `!summary` não era o teste certo: o objeto pode existir e não ter total nenhum para
  // desenhar. Os dois casos abaixo cobrem as duas formas disso, e cada um traz a
  // companheira POSITIVA na mesma execução — asserção de ausência sozinha é satisfeita
  // por "nada renderizou".

  it('summary sem nenhum cliente → empty state (nunca três barras zeradas)', () => {
    const semClientes: PlanHealthSummaryDto = {
      totalClientes: 0,
      verde: 0,
      amarelo: 0,
      vermelho: 0,
    }
    const { unmount } = render(
      <PlanHealthChart summary={semClientes} onFaixaClick={() => {}} />,
    )
    expect(screen.getByText(/sem dados de planos/i)).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    unmount()

    // Positiva: o MESMO componente, com clientes, desenha e oferece o drill.
    render(<PlanHealthChart summary={SUMMARY} onFaixaClick={() => {}} />)
    expect(screen.queryByText(/sem dados de planos/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ver clientes com consumo abaixo de 80% do plano (5)' }),
    ).toBeInTheDocument()
  })

  it('summary com as chaves ANTIGAS do front → empty state, não moldura em branco', () => {
    // JSON cru: o shape que o frontend acreditava receber até a 123/D4. Um literal tipado
    // não conseguiria expressar este defeito — é justamente por isso que ele passou.
    const divergente = JSON.parse(
      '{"totalVerde": 5, "totalAmarelo": 2, "totalVermelho": 1}',
    ) as PlanHealthSummaryDto

    const { unmount } = render(
      <PlanHealthChart summary={divergente} onFaixaClick={() => {}} />,
    )
    expect(screen.getByText(/sem dados de planos/i)).toBeInTheDocument()
    unmount()

    render(<PlanHealthChart summary={SUMMARY} onFaixaClick={() => {}} />)
    expect(screen.queryByText(/sem dados de planos/i)).not.toBeInTheDocument()
  })

  it('a legenda de drill mostra o total de CADA faixa vindo do summary', () => {
    render(<PlanHealthChart summary={SUMMARY} onFaixaClick={() => {}} />)

    // Números literais do SUMMARY (5/2/1), um por faixa — se o componente ler uma chave
    // que o backend não emite, o nome acessível vira "(undefined)" e isto fica vermelho.
    expect(
      screen.getByRole('button', { name: 'Ver clientes com consumo abaixo de 80% do plano (5)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ver clientes com consumo entre 80% e 95% do plano (2)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ver clientes com consumo de 95% ou mais do plano (1)' }),
    ).toBeInTheDocument()
  })
})
