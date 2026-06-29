/**
 * Testes de navegação dos modais de drill por família (016).
 * - ApontamentoDrillModal: linha navega ao TICKET do apontamento (id interno).
 * - ClientDrillModal: linha navega à tela do cliente (id interno).
 * - ProjectDrillModal: linha NÃO navega (R5 — sem tela de detalhe de projeto).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

const navigateSpy = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateSpy,
}))

vi.mock('../services/metricsService', () => ({
  getMetricRows: vi.fn(),
}))

import { ApontamentoDrillModal } from './ApontamentoDrillModal'
import { ClientDrillModal } from './ClientDrillModal'
import { ProjectDrillModal } from './ProjectDrillModal'
import { ToastProvider } from '../../../../components/ui/Toast'
import type { PaginatedResponse } from '../../../../types/api'
import type {
  ClientRowDto,
  DrillSpec,
  MetricsBaseParams,
  ProjectRowDto,
  TimeEntryDrillRowDto,
} from '../types/metrics'
import type { UseMetricDrillReturn } from '../hooks/useMetricDrill'

const BASE: MetricsBaseParams = { scope: 'management:suporte', from: '2026-06-01', to: '2026-06-26' }

function makeDrill<T>(items: T[]): UseMetricDrillReturn<T> {
  const page: PaginatedResponse<T> = {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 25,
    totalPages: 1,
  }
  return {
    data: page,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    page: 1,
    pageSize: 25,
    sortBy: null,
    sortDirection: 'desc',
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    isActive: true,
  }
}

describe('ApontamentoDrillModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('linha navega ao ticket do apontamento pelo id INTERNO', () => {
    const row: TimeEntryDrillRowDto = {
      timeEntryId: 1,
      ticketId: 55,
      hubspotTicketId: '900',
      assunto: 'Falha',
      atendente: 'Fulano',
      equipe: 'Suporte',
      dataApontamento: '2026-06-10',
      totalSegundos: 1800,
      categorizacaoAtendimento: 'Plantão',
    }
    const spec: DrillSpec = { metric: 'apontamentos', title: 'Apontamentos' }
    render(
      <ToastProvider>
        <ApontamentoDrillModal
          activeDrill={spec}
          onClose={vi.fn()}
          drill={makeDrill([row])}
          baseParams={BASE}
        />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('#900'))
    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/relatorios/tickets/$ticketId',
      params: { ticketId: '55' },
      search: { from: 'dashboard' },
    })
  })
})

describe('ClientDrillModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('linha navega à tela do cliente pelo id INTERNO', () => {
    const row: ClientRowDto = {
      clientId: 33,
      nomeFantasia: 'ACME',
      planNome: 'Premium',
      horasContratadas: 100,
      horasConsumidas: 96,
      percentualConsumo: 96,
      faixa: 'vermelho',
    }
    const spec: DrillSpec = {
      metric: 'plan-health-clientes',
      title: 'Críticos',
      params: { faixa: 'vermelho' },
    }
    render(
      <ToastProvider>
        <ClientDrillModal
          activeDrill={spec}
          onClose={vi.fn()}
          drill={makeDrill([row])}
          baseParams={BASE}
        />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('ACME'))
    expect(navigateSpy).toHaveBeenCalledWith({
      to: '/relatorios/clientes/$clientId',
      params: { clientId: '33' },
      search: { from: 'dashboard' },
    })
  })
})

describe('ProjectDrillModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('linha NÃO navega (R5 — sem tela de detalhe de projeto)', () => {
    const row: ProjectRowDto = {
      projetoId: 7,
      nome: 'Onboarding ACME',
      clienteNome: 'ACME',
      tipo: 'Onboarding',
      stage: 'Em Execução',
      ownerNome: 'Fulano',
      equipe: 'Integração',
      iniciadoEm: '2026-06-01',
      concluidoEm: null,
    }
    const spec: DrillSpec = {
      metric: 'projetos',
      title: 'Em execução',
      params: { tipo: 'onboarding', stage: 'execucao' },
    }
    render(
      <ToastProvider>
        <ProjectDrillModal
          activeDrill={spec}
          onClose={vi.fn()}
          drill={makeDrill([row])}
          baseParams={BASE}
        />
      </ToastProvider>,
    )
    // A linha existe, mas clicar nela não dispara navegação (sem onRowClick).
    fireEvent.click(screen.getByText('Onboarding ACME'))
    expect(navigateSpy).not.toHaveBeenCalled()
  })

  it('exibe o título do drill de projeto', () => {
    const spec: DrillSpec = {
      metric: 'projetos',
      title: 'Projetos em execução',
      params: { stage: 'execucao' },
    }
    render(
      <ToastProvider>
        <ProjectDrillModal
          activeDrill={spec}
          onClose={vi.fn()}
          drill={makeDrill<ProjectRowDto>([])}
          baseParams={BASE}
        />
      </ToastProvider>,
    )
    expect(screen.getByText('Projetos em execução')).toBeInTheDocument()
  })
})
