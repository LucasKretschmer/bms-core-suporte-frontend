/**
 * Testes do mapeamento clique→DrillSpec das seções do Suporte (016).
 * Os charts são mockados para expor o handler de clique (não testamos Recharts/SVG em jsdom).
 * Verifica que cada seção emite o DrillSpec correto (metric + params da família certa).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { DrillSpec } from '../../shared/types/metrics'

// ── Mock dos charts: viram botões que disparam o handler com um valor fixo ──────
vi.mock('../../shared/components/CategoryChart', () => ({
  CategoryChart: ({ onBarClick }: { onBarClick?: (c: string) => void }) => (
    <button onClick={() => onBarClick?.('Dúvida')}>cat-bar</button>
  ),
}))

vi.mock('../../shared/components/PlanHealthChart', () => ({
  PlanHealthChart: ({
    onFaixaClick,
  }: {
    onFaixaClick?: (f: 'verde' | 'amarelo' | 'vermelho') => void
  }) => <button onClick={() => onFaixaClick?.('vermelho')}>faixa-vermelho</button>,
}))

// ── Mock dos hooks de dados ─────────────────────────────────────────────────────
vi.mock('../../shared/hooks/useByCategory', () => ({
  useByCategory: () => ({
    data: { data: [{ categoria: 'Dúvida', count: 3, totalSegundos: 100 }] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('../../shared/hooks/usePlanHealth', () => ({
  usePlanHealth: () => ({
    data: {
      data: [],
      summary: { totalVerde: 1, totalAmarelo: 1, totalVermelho: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

import { SupportCategorySection } from './SupportCategorySection'
import { SupportPlanHealthSection } from './SupportPlanHealthSection'
import { ToastProvider } from '../../../../components/ui/Toast'

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe('SupportCategorySection — drill por categoria', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clique na barra emite metric=apontamentos com categoria', () => {
    let spec: DrillSpec | null = null
    renderWithToast(
      <SupportCategorySection
        scope="management:suporte"
        from="2026-06-01"
        to="2026-06-26"
        onCategoryDrill={(s) => (spec = s)}
      />,
    )
    fireEvent.click(screen.getByText('cat-bar'))
    expect(spec).toEqual({
      metric: 'apontamentos',
      title: 'Apontamentos — Dúvida',
      params: { categoria: 'Dúvida' },
    })
  })
})

describe('SupportPlanHealthSection — drill por faixa', () => {
  beforeEach(() => vi.clearAllMocks())

  it('clique na faixa vermelha emite metric=plan-health-clientes com faixa', () => {
    let spec: DrillSpec | null = null
    renderWithToast(
      <SupportPlanHealthSection
        from="2026-06-01"
        to="2026-06-26"
        onFaixaDrill={(s) => (spec = s)}
      />,
    )
    fireEvent.click(screen.getByText('faixa-vermelho'))
    expect(spec).toMatchObject({
      metric: 'plan-health-clientes',
      params: { faixa: 'vermelho' },
    })
  })
})
