/**
 * Testes do mapeamento clique→DrillSpec das seções do Onboarding (016).
 * - Projetos: KPI de estágio/tipo clicável → metric=projetos com tipo/stage.
 * - Tickets: linha de atendente clicável → metric=apontamentos com userId.
 * Os DonutCharts são mockados (Recharts/SVG não é exercido em jsdom).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { DrillSpec } from '../../shared/types/metrics'

vi.mock('../../shared/components/DonutChart', () => ({
  DonutChart: () => <div data-testid="donut" />,
}))

vi.mock('../../shared/components/ChartCard', () => ({
  ChartCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

import { OnboardingProjectSection } from './OnboardingProjectSection'
import { OnboardingTicketSection } from './OnboardingTicketSection'
import { ToastProvider } from '../../../../components/ui/Toast'
import type {
  OnboardingProjectStatsDto,
  OnboardingTicketStatsDto,
} from '../../shared/types/metrics'

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

const PROJ: OnboardingProjectStatsDto = {
  iniciados: 5,
  emExecucao: 4,
  parados: 1,
  emFechamento: 2,
  concluidos: 3,
  cancelados: 1,
  pocIniciadas: 2,
  treinamentos: 1,
  totalAtivos: 12,
}

describe('OnboardingProjectSection — drill por estágio/tipo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('KPI "Em execução" emite metric=projetos tipo=onboarding stage=execucao', () => {
    let spec: DrillSpec | null = null
    render(
      <OnboardingProjectSection
        data={PROJ}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onProjectDrill={(s) => (spec = s)}
      />,
    )
    fireEvent.click(screen.getByText('Em execução'))
    expect(spec).toMatchObject({
      metric: 'projetos',
      params: { tipo: 'onboarding', stage: 'execucao' },
    })
  })

  it('KPI "POC iniciadas" emite metric=projetos tipo=poc', () => {
    let spec: DrillSpec | null = null
    render(
      <OnboardingProjectSection
        data={PROJ}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onProjectDrill={(s) => (spec = s)}
      />,
    )
    fireEvent.click(screen.getByText('POC iniciadas'))
    expect(spec).toMatchObject({ metric: 'projetos', params: { tipo: 'poc' } })
  })

  it('sem onProjectDrill — KPI "Em execução" não é clicável (sem role button)', () => {
    render(
      <OnboardingProjectSection
        data={PROJ}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    )
    // O card "Em execução" não tem tooltip, então não deve haver nenhum elemento
    // com role="button" associado a esse rótulo (KpiCard só vira button com onClick).
    const label = screen.getByText('Em execução')
    expect(label.closest('[role="button"]')).toBeNull()
  })
})

const TICKETS: OnboardingTicketStatsDto = {
  emAberto: 8,
  resolvidos: 12,
  porAtendente: [
    { userId: 7, nome: 'Fulano', equipe: 'Integração', nAtendimentos: 10, totalSegundos: 3600 },
  ],
}

describe('OnboardingTicketSection — drill de atendente', () => {
  beforeEach(() => vi.clearAllMocks())

  it('linha de atendente emite metric=apontamentos com userId', () => {
    let spec: DrillSpec | null = null
    renderWithToast(
      <OnboardingTicketSection
        data={TICKETS}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onAgentDrill={(s) => (spec = s)}
      />,
    )
    fireEvent.click(screen.getByText('Fulano'))
    expect(spec).toMatchObject({
      metric: 'apontamentos',
      params: { userId: '7' },
    })
  })

  it('KPI "Em aberto" emite metric=tickets-backlog (família ticket)', () => {
    let spec: DrillSpec | null = null
    renderWithToast(
      <OnboardingTicketSection
        data={TICKETS}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onTicketDrill={(s) => (spec = s)}
      />,
    )
    fireEvent.click(screen.getByText('Em aberto'))
    expect(spec).toMatchObject({ metric: 'tickets-backlog' })
  })
})
