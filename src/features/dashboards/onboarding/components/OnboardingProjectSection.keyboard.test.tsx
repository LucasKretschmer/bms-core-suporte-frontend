/**
 * WCAG 2.1.1 — o drill das fatias dos DONUTS de projeto é alcançável por teclado, **com o
 * rótulo da SEÇÃO**, não com o padrão genérico do componente.
 *
 * Por que este arquivo existe: o `DonutChart` é genérico e não sabe o que a fatia
 * representa, então o nome acessível vem de quem o usa (`drillListLabel`/`drillItemLabel`
 * em `OnboardingProjectSection`). O teste de componente
 * (`shared/components/chart-keyboard-drill.test.tsx`) passa esses rótulos **ele mesmo** —
 * logo ele NÃO detecta a seção deixando de passá-los. Foi exatamente o que a mutação
 * `ONBOARDING-DONUT-SEM-ROTULO` mostrou: com ela, a suíte ficava **verde**. Este arquivo é
 * a resposta.
 *
 * O irmão `OnboardingDrillMapping.test.tsx` mocka o `DonutChart` (convenção do repo para
 * Recharts em jsdom); aqui o `DonutChart` é o **real**, porque o alvo do teste é a lista de
 * botões que ele renderiza — que existe fora do `<svg>` e não depende do Recharts medir
 * largura.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DrillSpec, OnboardingProjectStatsDto } from '../../shared/types/metrics'

// jsdom não resolve CSS vars — mesma convenção dos testes de gráfico.
vi.mock('../../shared/utils/chartTokens', () => ({
  getChartTokens: () => ({}),
  getChartPalette: () => ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2'],
  resetChartTokensCache: () => {},
}))

import { OnboardingProjectSection } from './OnboardingProjectSection'

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

type Usuario = ReturnType<typeof userEvent.setup>

function descrever(no: Element | null): string {
  if (!no) return '<null>'
  const nome = no.getAttribute('aria-label') ?? no.textContent?.trim().slice(0, 24) ?? ''
  return `${no.tagName.toLowerCase()}[${nome}]`
}

/** Travessia real de `Tab`; lança com as paradas visitadas se não alcançar o alvo. */
async function tabularAte(user: Usuario, alvo: Element, maxPassos = 40): Promise<string[]> {
  const paradas: string[] = []
  for (let i = 0; i < maxPassos; i += 1) {
    await user.tab()
    paradas.push(descrever(document.activeElement))
    if (document.activeElement === alvo) return paradas
  }
  throw new Error(
    `Alvo ${descrever(alvo)} NÃO foi alcançado por Tab em ${maxPassos} passos. ` +
      `Paradas: ${paradas.join(' → ')}`,
  )
}

function renderSecao(onProjectDrill: (spec: DrillSpec) => void) {
  return render(
    <>
      {/* Âncora fora da seção: ponto de partida explícito da travessia. */}
      <button type="button" data-testid="ancora">
        âncora
      </button>
      <OnboardingProjectSection
        data={PROJ}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onProjectDrill={onProjectDrill}
      />
    </>,
  )
}

describe('OnboardingProjectSection — drill das fatias por teclado (WCAG 2.1.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('donut de ESTÁGIO: Tab alcança a fatia e Enter emite o DrillSpec daquele estágio', async () => {
    const user = userEvent.setup()
    const drills: DrillSpec[] = []
    renderSecao((spec) => drills.push(spec))

    screen.getByTestId('ancora').focus()
    // Nome acessível vindo da SEÇÃO ("estágio"), não do padrão genérico do DonutChart.
    const botao = screen.getByRole('button', { name: 'Ver projetos do estágio Parado (1)' })
    await tabularAte(user, botao)

    await user.keyboard('{Enter}')

    expect(drills).toHaveLength(1)
    expect(drills[0]).toMatchObject({
      metric: 'projetos',
      params: { tipo: 'onboarding', stage: 'parado' },
    })
    // Discriminador de identidade: não é o estágio vizinho.
    expect(drills[0].params?.stage).not.toBe('execucao')
  })

  it('donut de TIPO: Tab alcança a fatia e Enter emite o DrillSpec daquele tipo', async () => {
    const user = userEvent.setup()
    const drills: DrillSpec[] = []
    renderSecao((spec) => drills.push(spec))

    screen.getByTestId('ancora').focus()
    const botao = screen.getByRole('button', { name: 'Ver projetos do tipo POC (2)' })
    await tabularAte(user, botao)

    await user.keyboard('{Enter}')

    expect(drills).toHaveLength(1)
    expect(drills[0]).toMatchObject({ metric: 'projetos', params: { tipo: 'poc' } })
  })

  it('as duas listas de drill têm nomes acessíveis distintos (estágio ≠ tipo)', () => {
    renderSecao(vi.fn())
    expect(screen.getByRole('list', { name: 'Abrir projetos por estágio' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Abrir projetos por tipo' })).toBeInTheDocument()
    // Nenhuma lista anônima com o rótulo padrão do componente genérico.
    expect(screen.queryByRole('list', { name: 'Abrir detalhes por fatia' })).toBeNull()
  })

  it('sem onProjectDrill: nenhum botão de drill de fatia (seção não interativa)', () => {
    render(
      <OnboardingProjectSection
        data={PROJ}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.queryByRole('list', { name: 'Abrir projetos por estágio' })).toBeNull()
    expect(screen.queryByRole('list', { name: 'Abrir projetos por tipo' })).toBeNull()
  })
})
