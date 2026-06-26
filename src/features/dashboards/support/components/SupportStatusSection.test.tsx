/**
 * Testes da SupportStatusSection (020).
 * Verifica:
 *  - Título "Status em Aberto" no escopo equipe (byTeam:false) — sem "(por etapa)".
 *  - Título "Status por Equipe" no escopo global (byTeam:true).
 *  - Drill por statusKey: clique numa barra/botão de status → DrillSpec correto
 *    (metric=tickets-backlog, params.statusKey = chave do grupo).
 *  - Estados loading / erro / empty propagam ao ChartCard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SupportStatusSection } from './SupportStatusSection'
import type {
  StatusDistributionDto,
  StatusDistributionTeamScopeDto,
  StatusDistributionGlobalScopeDto,
} from '../../shared/types/metrics'

// Mock do hook de dados — controlamos o retorno por teste.
const useStatusDistributionMock = vi.fn()
vi.mock('../../shared/hooks/useStatusDistribution', () => ({
  useStatusDistribution: (...args: unknown[]) => useStatusDistributionMock(...args),
}))

// Mock de tokens para evitar dependência de CSS vars no jsdom.
vi.mock('../../shared/utils/chartTokens', () => ({
  getChartTokens: () => ({}),
  getChartPalette: () => ['#2563EB', '#16A34A', '#D97706', '#DC2626'],
  resetChartTokensCache: () => {},
}))

type HookReturn = {
  data: StatusDistributionDto | undefined
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

function setHook(partial: Partial<HookReturn>) {
  useStatusDistributionMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...partial,
  })
}

const TEAM_DATA: StatusDistributionTeamScopeDto = {
  byTeam: false,
  data: [
    { stageId: 'em atendimento', statusKey: 'em atendimento', status: 'Em atendimento', count: 8 },
    { stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 5 },
  ],
}

const GLOBAL_DATA: StatusDistributionGlobalScopeDto = {
  byTeam: true,
  data: [
    {
      equipe: 'Suporte N1',
      porStatus: [
        { stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 5 },
      ],
    },
  ],
}

const props = { scope: 'management:suporte' as const, from: null, to: null }

describe('SupportStatusSection', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    useStatusDistributionMock.mockReset()
  })

  it('escopo equipe (byTeam:false) → título "Status em Aberto" (sem "por etapa")', () => {
    setHook({ data: TEAM_DATA })
    render(<SupportStatusSection {...props} />)
    expect(screen.getByText('Status em Aberto')).toBeInTheDocument()
    expect(screen.queryByText(/por etapa/i)).not.toBeInTheDocument()
  })

  it('escopo global (byTeam:true) → título "Status por Equipe"', () => {
    setHook({ data: GLOBAL_DATA })
    render(<SupportStatusSection {...props} scope="global" />)
    expect(screen.getByText('Status por Equipe')).toBeInTheDocument()
  })

  it('clique numa barra de status → DrillSpec com metric=tickets-backlog e statusKey do grupo', () => {
    setHook({ data: TEAM_DATA })
    const onStatusDrill = vi.fn()
    render(<SupportStatusSection {...props} onStatusDrill={onStatusDrill} />)

    const btn = screen.getByRole('button', { name: /Ver tickets do status Em atendimento/i })
    fireEvent.click(btn)

    expect(onStatusDrill).toHaveBeenCalledTimes(1)
    expect(onStatusDrill).toHaveBeenCalledWith({
      metric: 'tickets-backlog',
      title: 'Tickets — Em atendimento',
      params: { statusKey: 'em atendimento' },
    })
  })

  it('sem onStatusDrill → não renderiza botões de drill (gráfico não interativo)', () => {
    setHook({ data: TEAM_DATA })
    render(<SupportStatusSection {...props} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('data vazia → empty no ChartCard', () => {
    setHook({ data: { byTeam: false, data: [] } as StatusDistributionDto })
    render(<SupportStatusSection {...props} />)
    expect(screen.getByText(/sem dados de status/i)).toBeInTheDocument()
  })

  it('isLoading → skeleton, não empty', () => {
    setHook({ isLoading: true })
    render(<SupportStatusSection {...props} />)
    const skeleton = document.querySelector('[aria-busy="true"]')
    expect(skeleton).toBeTruthy()
    expect(screen.queryByText(/sem dados de status/i)).not.toBeInTheDocument()
  })
})
