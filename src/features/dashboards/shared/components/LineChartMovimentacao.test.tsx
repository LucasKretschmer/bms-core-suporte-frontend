/**
 * 123/D3 — Movimentação Diária: a LINHA (D3a) e o isolamento de série (D3b).
 *
 * ## Por que o `ResponsiveContainer` é mockado (e por que sem isso o teste seria INERTE)
 *
 * O jsdom não tem layout: o `ResponsiveContainer` mede 0×0 e o Recharts **não renderiza
 * nenhum `<svg>`**. Medido antes de escrever este arquivo: sem o mock,
 * `container.querySelectorAll('svg').length === 0` para 1, 2 e 10 dias — ou seja, toda
 * asserção sobre paths/dots passaria por VACUIDADE, inclusive as negativas
 * (é a família do AP-FRONTEND-027: propriedade de layout que o ambiente não modela).
 *
 * O mock injeta `width`/`height` no `LineChart` — exatamente o que o container faz em
 * produção quando tem tamanho. E o teste `arnês` abaixo é o **controle positivo**: ele
 * falha se o mock parar de funcionar, matando o falso-verde antes que ele engane alguém.
 *
 * ## Como cada asserção fica VERMELHA (mecanismo medido, recharts 3.8.1)
 *
 * `shouldRenderDots(points, dot)` (`recharts/es6/component/Dots.js`) termina em
 * `return points.length === 1`: com um ponto só, `dot={false}` é ignorado e o Recharts
 * desenha bolinha; e um ponto não forma path. Medição em render real, com as props reais
 * do componente:
 *
 * | dias | `.recharts-line-curve` | `.recharts-line-dot` |
 * |------|------------------------|----------------------|
 * | 0    | 0                      | 0                    |
 * | 1    | 0                      | 5                    |
 * | 2    | 5                      | 0                    |
 * | 10   | 5                      | 0                    |
 *
 * A linha `0` foi acrescentada em 123/FE-A2 (lacuna de detecção registrada pelo QA da
 * FE-D3, §8.1.1). Medida no mesmo arnês: com `data={[]}` o Recharts ainda desenha a
 * superfície e a grade (1 `.recharts-surface`, 4 linhas de grade, 2 eixos) — o que dá
 * âncora POSITIVA às negativas do caso, sem a qual elas passariam por vacuidade.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LineChartMovimentacao } from './LineChartMovimentacao'
import { MOVIMENTACAO_SERIES, AVISO_PONTO_UNICO } from '../utils/movimentacao'
import type { DailyDataPointDto } from '../types/metrics'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.cloneElement(children, { width: 800, height: 300 } as Record<string, unknown>),
  }
})

// Cores DISTINTAS por série: é o `stroke` do path que identifica QUAL série sobrou depois
// de isolar. Com cores iguais, "sobrou 1 linha" passaria com a série errada.
const COR = {
  novos: '#111111',
  andamento: '#222222',
  resolvidos: '#333333',
  cancelados: '#444444',
  aberto: '#555555',
} as const

vi.mock('../utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-novos': '#111111',
    'chart-andamento': '#222222',
    'chart-resolvidos': '#333333',
    'chart-cancelados': '#444444',
    'chart-aberto': '#555555',
  }),
}))

/**
 * `n` dias com valores DIFERENTES por série (nunca simétricos): asserção de contagem com
 * fixture simétrica passa com o alvo trocado (AP-QA-011).
 */
function dias(n: number): DailyDataPointDto[] {
  return Array.from({ length: n }, (_, i) => ({
    data: `2026-06-${String(i + 1).padStart(2, '0')}`,
    novos: i + 1,
    emAndamento: i + 7,
    resolvidos: i + 13,
    cancelados: i + 21,
    emAberto: i + 34,
  }))
}

function curvas(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll<SVGPathElement>('.recharts-line-curve'))
}

function pontos(container: HTMLElement): SVGElement[] {
  return Array.from(container.querySelectorAll<SVGElement>('.recharts-line-dot'))
}

function strokes(elementos: Element[]): string[] {
  return elementos.map((e) => e.getAttribute('stroke') ?? '')
}

/** Descreve uma parada de `Tab` de forma legível — botão pelo rótulo, resto pela tag. */
function descrever(no: Element | null): string {
  if (!no) return '<null>'
  const tag = no.tagName.toLowerCase()
  if (tag === 'button') return `button:${no.textContent?.trim() ?? ''}`
  const classe = no.getAttribute('class')?.split(/\s+/)[0] ?? ''
  return classe ? `${tag}.${classe}` : tag
}

describe('LineChartMovimentacao — identidade das séries', () => {
  // Cardinalidade não discrimina: trava QUAIS séries existem, com literal escrito à mão.
  it('as 5 séries são exatamente estas, nesta ordem', () => {
    expect(MOVIMENTACAO_SERIES.map((s) => s.key)).toEqual([
      'novos',
      'emAndamento',
      'resolvidos',
      'cancelados',
      'emAberto',
    ])
    expect(MOVIMENTACAO_SERIES.map((s) => s.label)).toEqual([
      'Novos',
      'Em atendimento',
      'Resolvidos',
      'Cancelados',
      'Em aberto',
    ])
  })
})

describe('LineChartMovimentacao — D3a: cardinalidade da série', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('arnês: com 10 dias o gráfico REALMENTE renderiza (controle positivo do mock de layout)', () => {
    const { container } = render(<LineChartMovimentacao data={dias(10)} />)
    // Se o mock do ResponsiveContainer morrer, isto fica 0 e o arquivo inteiro reprova —
    // em vez de todas as asserções negativas passarem por vacuidade.
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0)
    expect(curvas(container)).toHaveLength(5)
  })

  it('MUITOS dias (10) → 5 linhas com geometria real, nenhum marcador, nenhum aviso', () => {
    const { container } = render(<LineChartMovimentacao data={dias(10)} />)

    const paths = curvas(container)
    expect(paths).toHaveLength(5)
    // Geometria REAL: `M x,y` seguido de segmento (C ou L). Path degenerado (`M…ZM…Z`,
    // o que aparece quando os valores somem) não casa — e é invisível na tela.
    paths.forEach((p) => expect(p.getAttribute('d') ?? '').toMatch(/^M[\d.,]+[CL]/))
    // Identidade: uma linha por série, com a cor daquela série.
    expect(strokes(paths).sort()).toEqual(
      [COR.novos, COR.andamento, COR.resolvidos, COR.cancelados, COR.aberto].sort(),
    )

    // Negativas — acompanhadas das positivas acima, na MESMA execução.
    expect(pontos(container)).toHaveLength(0)
    expect(screen.queryByText(/período de um único dia/i)).toBeNull()
  })

  it('DOIS dias → já há linha (segmento reto), sem marcador e sem aviso', () => {
    const { container } = render(<LineChartMovimentacao data={dias(2)} />)

    const paths = curvas(container)
    expect(paths).toHaveLength(5)
    paths.forEach((p) => expect(p.getAttribute('d') ?? '').toMatch(/^M[\d.,]+L[\d.,]+$/))
    expect(pontos(container)).toHaveLength(0)
    expect(screen.queryByText(/período de um único dia/i)).toBeNull()
  })

  it('UM dia → marcador INTENCIONAL (r=4, preenchido) em cada série + aviso do porquê', () => {
    const { container } = render(<LineChartMovimentacao data={dias(1)} />)

    // Positiva: os 5 marcadores existem (não é tela vazia).
    const dots = pontos(container)
    expect(dots).toHaveLength(5)
    // O que distingue "marcador deliberado" do dot que o Recharts força quando
    // `dot={false}` e há 1 ponto: raio 4 e preenchimento do fundo do card.
    dots.forEach((d) => {
      expect(d.getAttribute('r')).toBe('4')
      expect(d.getAttribute('fill')).toBe('var(--color-card)')
    })
    // Identidade: um marcador por série, com a cor daquela série.
    expect(strokes(dots).sort()).toEqual(
      [COR.novos, COR.andamento, COR.resolvidos, COR.cancelados, COR.aberto].sort(),
    )
    // O usuário fica sabendo POR QUE não há linha (texto ancorado em data.length === 1).
    expect(screen.getByText(/período de um único dia/i)).toBeInTheDocument()
    // E não há linha mesmo — negativa com as positivas acima na mesma execução.
    expect(curvas(container)).toHaveLength(0)
  })

  it('ZERO dias → nada desenhado, NENHUM aviso de "um único dia", e a legenda continua', () => {
    const { container } = render(<LineChartMovimentacao data={[]} />)

    // POSITIVAS primeiro. Sem elas as negativas abaixo passariam por vacuidade se o
    // arnês do `ResponsiveContainer` morresse (medido: sem o mock, `svg.length === 0`
    // para TODO n, inclusive 0 — e "0 curvas, 0 dots, sem aviso" ficaria verde com o
    // gráfico inexistente). Medido COM o arnês, n = 0: 1 surface, 4 linhas de grade.
    expect(container.querySelectorAll('.recharts-surface')).toHaveLength(1)
    expect(container.querySelectorAll('.recharts-cartesian-grid line').length).toBeGreaterThan(0)

    // Sem dado não há o que traçar nem o que marcar.
    expect(curvas(container)).toHaveLength(0)
    expect(pontos(container)).toHaveLength(0)

    // ── A asserção que discrimina ──────────────────────────────────────────────────
    // `AVISO_PONTO_UNICO` AFIRMA "Período de um único dia". Com zero dias isso é FALSO
    // (AP-FRONTEND-022: texto de UI que afirma comportamento do sistema é código).
    // O aviso está ancorado em `data.length === 1`; trocar por `data.length <= 1`
    // (fronteira frouxa, a mutação que o QA da FE-D3 apontou como indetectável)
    // faria o aviso aparecer aqui e ESTE assert fica vermelho. É o único assert do
    // arquivo que cai sob essa mutação — os outros casos (n = 1, 2, 10) passam nas
    // duas versões.
    expect(screen.queryByText(/período de um único dia/i)).toBeNull()

    // Guarda contra negativa morta: se a copy do aviso mudar, a regex acima deixaria
    // de casar e o assert passaria por vacuidade. Aqui ela é confrontada com a
    // constante real, na MESMA execução.
    expect(AVISO_PONTO_UNICO).toMatch(/período de um único dia/i)

    // Período vazio não é tela morta: a legenda interativa continua alcançável.
    expect(screen.getByRole('button', { name: 'Todas' })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  it('isLoading → skeleton, sem gráfico e sem legenda interativa', () => {
    const { container } = render(<LineChartMovimentacao data={dias(10)} isLoading />)
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    expect(curvas(container)).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Cancelados' })).toBeNull()
  })
})

describe('LineChartMovimentacao — D3b: isolar uma série', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('estado inicial: todas visíveis e "Todas" é a opção vigente', () => {
    const { container } = render(<LineChartMovimentacao data={dias(10)} />)
    expect(curvas(container)).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Cancelados' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('clicar em "Cancelados" deixa SÓ Cancelados — e é Cancelados mesmo (cor), não "alguma" série', async () => {
    const user = userEvent.setup()
    const { container } = render(<LineChartMovimentacao data={dias(10)} />)

    await user.click(screen.getByRole('button', { name: 'Cancelados' }))

    const paths = curvas(container)
    expect(paths).toHaveLength(1)
    expect(paths[0].getAttribute('stroke')).toBe(COR.cancelados)
    // Estado anunciado ao leitor de tela (não só a cor do chip).
    expect(screen.getByRole('button', { name: 'Cancelados' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('isolar OUTRA série troca de fato a linha exibida (a asserção discrimina)', async () => {
    const user = userEvent.setup()
    const { container } = render(<LineChartMovimentacao data={dias(10)} />)

    await user.click(screen.getByRole('button', { name: 'Resolvidos' }))
    expect(strokes(curvas(container))).toEqual([COR.resolvidos])

    await user.click(screen.getByRole('button', { name: 'Novos' }))
    expect(strokes(curvas(container))).toEqual([COR.novos])
  })

  it('caminho de volta 1: "Todas" devolve as 5 séries', async () => {
    const user = userEvent.setup()
    const { container } = render(<LineChartMovimentacao data={dias(10)} />)

    await user.click(screen.getByRole('button', { name: 'Cancelados' }))
    expect(curvas(container)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Todas' }))
    expect(curvas(container)).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('caminho de volta 2: acionar de novo a série já isolada devolve as 5', async () => {
    const user = userEvent.setup()
    const { container } = render(<LineChartMovimentacao data={dias(10)} />)

    await user.click(screen.getByRole('button', { name: 'Cancelados' }))
    expect(curvas(container)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Cancelados' }))
    expect(curvas(container)).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Cancelados' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('isolar não muda o dado: com 1 dia o marcador continua e o aviso continua', async () => {
    const user = userEvent.setup()
    const { container } = render(<LineChartMovimentacao data={dias(1)} />)

    await user.click(screen.getByRole('button', { name: 'Cancelados' }))

    const dots = pontos(container)
    expect(dots).toHaveLength(1)
    expect(dots[0].getAttribute('stroke')).toBe(COR.cancelados)
    expect(screen.getByText(/período de um único dia/i)).toBeInTheDocument()
  })

  it('TECLADO: a partir de âncora FORA, Tab percorre a legenda na ordem e Enter isola', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <>
        <button type="button" data-testid="ancora">
          âncora
        </button>
        <LineChartMovimentacao data={dias(10)} />
      </>,
    )

    // Ponto de partida explícito, fora do componente (nunca `el.focus()` no alvo).
    screen.getByTestId('ancora').focus()

    const paradas: string[] = []
    for (let i = 0; i < 7; i += 1) {
      await user.tab()
      paradas.push(descrever(document.activeElement))
    }

    // Ordem INTEIRA esperada — não só "o alvo é alcançável".
    // A 1ª parada é a superfície do Recharts: a v3 marca o `<svg>` com
    // `role="application" tabindex="0"`. Está aqui de propósito, para que a travessia
    // descreva o que o usuário de teclado encontra de verdade.
    expect(paradas).toEqual([
      'svg.recharts-surface',
      'button:Todas',
      'button:Novos',
      'button:Em atendimento',
      'button:Resolvidos',
      'button:Cancelados',
      'button:Em aberto',
    ])

    // Volta até "Cancelados" e aciona por teclado.
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelados' }))

    await user.keyboard('{Enter}')

    expect(strokes(curvas(container))).toEqual([COR.cancelados])
    expect(screen.getByRole('button', { name: 'Cancelados' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('TECLADO: Espaço no botão "Todas" devolve todas as séries', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <>
        <button type="button" data-testid="ancora">
          âncora
        </button>
        <LineChartMovimentacao data={dias(10)} />
      </>,
    )

    await user.click(screen.getByRole('button', { name: 'Em aberto' }))
    expect(curvas(container)).toHaveLength(1)

    screen.getByTestId('ancora').focus()
    await user.tab() // superfície do gráfico
    await user.tab() // "Todas"
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Todas' }))

    await user.keyboard(' ')
    expect(curvas(container)).toHaveLength(5)
  })
})
