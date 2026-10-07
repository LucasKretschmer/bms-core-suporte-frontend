import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductivitySummaryCards } from './ProductivitySummaryCards'
import { getProductivitySummary } from '../../shared/services/reportsService'
import type { ProductivitySummaryDto } from '../../shared/types/reports'

vi.mock('../../shared/services/reportsService', () => ({
  getProductivitySummary: vi.fn(),
}))

const mockedSummary = vi.mocked(getProductivitySummary)

function renderCards() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductivitySummaryCards
        params={{ from: '2026-10-01', to: '2026-10-07', teamId: '3' }}
        variant="global"
        ariaLabel="Resumo"
      />
    </QueryClientProvider>,
  )
}

describe('ProductivitySummaryCards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loading: mostra skeleton nos cards', () => {
    mockedSummary.mockReturnValue(new Promise(() => {}))
    renderCards()

    expect(screen.getByText('Tempo total')).toBeInTheDocument()
    expect(screen.getAllByLabelText('Carregando…').length).toBeGreaterThan(0)
  })

  it('erro: mostra ErrorState com nova tentativa', async () => {
    mockedSummary.mockRejectedValue(new Error('falhou'))
    renderCards()

    expect(
      await screen.findByText('Não foi possível carregar o resumo de produtividade.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Tempo total')).not.toBeInTheDocument()
  })

  it('sucesso com chave ausente: valor formatado e "-" no campo ausente', async () => {
    mockedSummary.mockResolvedValue(
      JSON.parse(
        '{"totalSegundos":3600,"totalAtendentes":1,"totalAtendimentos":2,' +
          '"mediaAtendimentosPorAtendente":2,"medianaAtendimentosPorAtendente":2,"totalTickets":0}',
      ) as ProductivitySummaryDto,
    )
    renderCards()

    expect(await screen.findByText('1h 0m')).toBeInTheDocument()
    expect(screen.getAllByText('-')).toHaveLength(2)
    expect(mockedSummary).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-07', teamId: '3' })
  })
})
