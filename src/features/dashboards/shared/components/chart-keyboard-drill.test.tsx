/**
 * WCAG 2.1.1 (Teclado, nível A) — o drill de TODO gráfico é alcançável por `Tab` e
 * acionável por `Enter`/`Espaço`, com o MESMO alvo que o clique na fatia passa.
 *
 * ## O que este arquivo prova, e como
 *
 * `el.focus(); expect(el).toHaveFocus()` afirma que o elemento **pode** receber foco —
 * não é a pergunta. A pergunta é se o usuário **chega** nele. Por isso todo caso aqui:
 *
 *  1. **ancora** o foco num `<button>` FORA do gráfico (`user.click` prévio deixaria o
 *     foco herdado de um nó que pode sumir — ver `rules/frontend.md`);
 *  2. **tabula de verdade** (`user.tab()` repetido), coletando as paradas, até alcançar o
 *     botão — o helper `tabularAte` **lança** com a lista de paradas se não alcançar em N
 *     passos, então "não alcançável" é vermelho com diagnóstico, não silêncio;
 *  3. aciona por **`Enter`** e por **`Espaço`** (teclado, não `fireEvent.click`);
 *  4. asserta a **IDENTIDADE do alvo** entregue ao drill (qual categoria/faixa/índice),
 *     nunca "chamou alguma coisa";
 *  5. asserta que, **no instante do disparo**, `document.activeElement` é o próprio botão
 *     — que é exatamente o que o `capture()` do `useReturnFocus` lê para devolver o foco
 *     ao fechar o modal (`src/hooks/useReturnFocus.ts`).
 *
 * ## Limite declarado (jsdom)
 *
 * Sob `ResponsiveContainer` o Recharts não renderiza em jsdom (largura 0), então a
 * `<svg class="recharts-surface">` (que num navegador nasce com `tabindex="0"`, medido no
 * A11Y-3) **não existe aqui** — as paradas de `Tab` medidas são só as dos botões. Isso
 * NÃO invalida o que se prova (a lista é irmã POSTERIOR do gráfico no DOM, logo vem
 * depois dele na ordem de tabulação em qualquer caso), mas a ordem completa
 * "surface → botões" e a visibilidade do anel de foco só se conferem em navegador:
 * está no roteiro manual do relatório da unidade.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CategoryChart } from './CategoryChart'
import { FirstResponseVsSlaChart } from './FirstResponseVsSlaChart'
import { PlanHealthChart } from './PlanHealthChart'
import { DonutChart } from './DonutChart'
import { StatusDistributionChart } from './StatusDistributionChart'
import type {
  CategoryMetricDto,
  PlanHealthSummaryDto,
  StatusDistributionGlobalScopeDto,
  StatusDistributionTeamScopeDto,
} from '../types/metrics'

// Tokens de cor: jsdom não resolve CSS vars (mesmo mock dos testes irmãos).
vi.mock('../utils/chartTokens', () => ({
  getChartTokens: () => ({
    'chart-1': '#2563EB',
    'chart-verde': '#16A34A',
    'chart-amarelo': '#D97706',
    'chart-vermelho': '#DC2626',
  }),
  getChartPalette: () => ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED'],
  resetChartTokensCache: () => {},
}))

type Usuario = ReturnType<typeof userEvent.setup>

function descrever(no: Element | null): string {
  if (!no) return '<null>'
  const nome = no.getAttribute('aria-label') ?? no.textContent?.trim().slice(0, 24) ?? ''
  return `${no.tagName.toLowerCase()}[${nome}]`
}

/**
 * Tabula a partir do foco atual até alcançar `alvo`. Devolve as paradas visitadas.
 * Lança (com a lista de paradas) se não alcançar — é a forma vermelha de "inalcançável
 * por teclado", que é precisamente o defeito que esta unidade corrige.
 */
async function tabularAte(user: Usuario, alvo: Element, maxPassos = 25): Promise<string[]> {
  const paradas: string[] = []
  for (let i = 0; i < maxPassos; i += 1) {
    await user.tab()
    paradas.push(descrever(document.activeElement))
    if (document.activeElement === alvo) return paradas
  }
  throw new Error(
    `Alvo ${descrever(alvo)} NÃO foi alcançado por Tab em ${maxPassos} passos. ` +
      `Paradas visitadas: ${paradas.join(' → ') || '(nenhuma)'}`,
  )
}

/** Âncora fora do gráfico: ponto de partida explícito da travessia. */
function Ancora() {
  return (
    <button type="button" data-testid="ancora">
      âncora fora do gráfico
    </button>
  )
}

function ancorar(): HTMLElement {
  const ancora = screen.getByTestId('ancora')
  ancora.focus()
  expect(ancora).toHaveFocus()
  return ancora
}

// ── Dados ─────────────────────────────────────────────────────────────────────

const CATEGORIAS: CategoryMetricDto[] = [
  { categoria: 'Dúvida', count: 7, totalSegundos: 3600 },
  { categoria: 'Erro de sistema', count: 3, totalSegundos: 1800 },
]

// Quantidades DIFERENTES por faixa de propósito: com 1/1/1 uma asserção de contagem
// passaria com o alvo trocado.
const PLANOS: PlanHealthSummaryDto = {
  totalVerde: 12,
  totalAmarelo: 4,
  totalVermelho: 2,
}

const STATUS_EQUIPE: StatusDistributionTeamScopeDto = {
  byTeam: false,
  data: [
    { stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 5 },
    { stageId: 'em atendimento', statusKey: 'em atendimento', status: 'Em atendimento', count: 8 },
  ],
}

const STATUS_GLOBAL: StatusDistributionGlobalScopeDto = {
  byTeam: true,
  data: [
    {
      equipe: 'Suporte N1',
      porStatus: [
        { stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 5 },
        { stageId: 'em atendimento', statusKey: 'em atendimento', status: 'Em atendimento', count: 8 },
      ],
    },
    {
      equipe: 'Suporte N2',
      porStatus: [{ stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 2 }],
    },
  ],
}

describe('Drill de gráfico alcançável por teclado (WCAG 2.1.1)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── CategoryChart ───────────────────────────────────────────────────────────

  it('CategoryChart: Tab alcança o gatilho e Enter abre o drill da CATEGORIA certa', async () => {
    const user = userEvent.setup()
    let ativoNoDisparo: Element | null = null
    const onBarClick = vi.fn(() => {
      ativoNoDisparo = document.activeElement
    })

    render(
      <>
        <Ancora />
        <CategoryChart data={CATEGORIAS} onBarClick={onBarClick} />
      </>,
    )

    ancorar()
    const botao = screen.getByRole('button', { name: 'Ver chamados da categoria Erro de sistema (3)' })
    await tabularAte(user, botao)

    await user.keyboard('{Enter}')

    // IDENTIDADE: a categoria do botão alcançado, não "alguma" categoria.
    expect(onBarClick).toHaveBeenCalledTimes(1)
    expect(onBarClick).toHaveBeenCalledWith('Erro de sistema')
    // É este nó que o `capture()` do useReturnFocus guarda para devolver o foco depois.
    expect(ativoNoDisparo).toBe(botao)
  })

  it('CategoryChart: Espaço também aciona (papel de button nativo)', async () => {
    const user = userEvent.setup()
    const onBarClick = vi.fn()

    render(
      <>
        <Ancora />
        <CategoryChart data={CATEGORIAS} onBarClick={onBarClick} />
      </>,
    )

    ancorar()
    const botao = screen.getByRole('button', { name: 'Ver chamados da categoria Dúvida (7)' })
    await tabularAte(user, botao)

    await user.keyboard(' ')

    expect(onBarClick).toHaveBeenCalledTimes(1)
    expect(onBarClick).toHaveBeenCalledWith('Dúvida')
  })

  it('CategoryChart sem onBarClick: nenhum botão de drill (gráfico não interativo)', () => {
    render(<CategoryChart data={CATEGORIAS} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  // ── FirstResponseVsSlaChart ─────────────────────────────────────────────────

  it('FirstResponseVsSlaChart: Tab + Enter abrem o drill do segmento certo (on ≠ late)', async () => {
    const user = userEvent.setup()
    let ativoNoDisparo: Element | null = null
    const onSegmentClick = vi.fn(() => {
      ativoNoDisparo = document.activeElement
    })

    render(
      <>
        <Ancora />
        <FirstResponseVsSlaChart
          respondidosNoPrazo={40}
          respondidosForaDoPrazo={8}
          onSegmentClick={onSegmentClick}
        />
      </>,
    )

    ancorar()
    const fora = screen.getByRole('button', { name: 'Ver tickets respondidos fora do prazo (8)' })
    await tabularAte(user, fora)

    await user.keyboard('{Enter}')

    expect(onSegmentClick).toHaveBeenCalledTimes(1)
    expect(onSegmentClick).toHaveBeenCalledWith('late')
    expect(ativoNoDisparo).toBe(fora)
  })

  it('FirstResponseVsSlaChart: o outro segmento entrega "on" — o alvo discrimina', async () => {
    const user = userEvent.setup()
    const onSegmentClick = vi.fn()

    render(
      <>
        <Ancora />
        <FirstResponseVsSlaChart
          respondidosNoPrazo={40}
          respondidosForaDoPrazo={8}
          onSegmentClick={onSegmentClick}
        />
      </>,
    )

    ancorar()
    const noPrazo = screen.getByRole('button', { name: 'Ver tickets respondidos no prazo (40)' })
    await tabularAte(user, noPrazo)
    await user.keyboard('{Enter}')

    expect(onSegmentClick).toHaveBeenCalledWith('on')
    expect(onSegmentClick).not.toHaveBeenCalledWith('late')
  })

  it('FirstResponseVsSlaChart sem onSegmentClick: nenhum botão de drill', () => {
    render(<FirstResponseVsSlaChart respondidosNoPrazo={40} respondidosForaDoPrazo={8} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  // ── PlanHealthChart ─────────────────────────────────────────────────────────

  it('PlanHealthChart: Tab + Enter abrem o drill da FAIXA certa', async () => {
    const user = userEvent.setup()
    let ativoNoDisparo: Element | null = null
    const onFaixaClick = vi.fn(() => {
      ativoNoDisparo = document.activeElement
    })

    render(
      <>
        <Ancora />
        <PlanHealthChart summary={PLANOS} onFaixaClick={onFaixaClick} />
      </>,
    )

    ancorar()
    const critico = screen.getByRole('button', {
      name: 'Ver clientes com consumo de 95% ou mais do plano (2)',
    })
    await tabularAte(user, critico)

    await user.keyboard('{Enter}')

    expect(onFaixaClick).toHaveBeenCalledTimes(1)
    expect(onFaixaClick).toHaveBeenCalledWith('vermelho')
    expect(onFaixaClick).not.toHaveBeenCalledWith('verde')
    expect(ativoNoDisparo).toBe(critico)
  })

  it('PlanHealthChart: as três faixas são alcançáveis, cada uma com o seu alvo', async () => {
    const user = userEvent.setup()
    const onFaixaClick = vi.fn()

    render(
      <>
        <Ancora />
        <PlanHealthChart summary={PLANOS} onFaixaClick={onFaixaClick} />
      </>,
    )

    ancorar()
    for (const [nome, alvo] of [
      ['Ver clientes com consumo abaixo de 80% do plano (12)', 'verde'],
      ['Ver clientes com consumo entre 80% e 95% do plano (4)', 'amarelo'],
      ['Ver clientes com consumo de 95% ou mais do plano (2)', 'vermelho'],
    ] as const) {
      await user.tab()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: nome }))
      await user.keyboard('{Enter}')
      expect(onFaixaClick).toHaveBeenLastCalledWith(alvo)
    }
    expect(onFaixaClick).toHaveBeenCalledTimes(3)
  })

  it('PlanHealthChart sem onFaixaClick: nenhum botão de drill', () => {
    render(<PlanHealthChart summary={PLANOS} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  // ── DonutChart (Onboarding) ─────────────────────────────────────────────────

  it('DonutChart: Tab + Enter abrem o drill do ÍNDICE certo da fatia', async () => {
    const user = userEvent.setup()
    let ativoNoDisparo: Element | null = null
    const onSliceClick = vi.fn(() => {
      ativoNoDisparo = document.activeElement
    })

    render(
      <>
        <Ancora />
        <DonutChart
          data={[
            { name: 'Iniciado', value: 3 },
            { name: 'Em Execução', value: 9 },
            { name: 'Parado', value: 1 },
          ]}
          onSliceClick={onSliceClick}
          drillListLabel="Abrir projetos por estágio"
          drillItemLabel={(item) => `Ver projetos do estágio ${item.name} (${item.value})`}
        />
      </>,
    )

    ancorar()
    const parado = screen.getByRole('button', { name: 'Ver projetos do estágio Parado (1)' })
    await tabularAte(user, parado)

    await user.keyboard('{Enter}')

    // Índice 2 = 'Parado' na ordem de `data`, exatamente o que o clique na fatia passa.
    expect(onSliceClick).toHaveBeenCalledTimes(1)
    expect(onSliceClick).toHaveBeenCalledWith(2)
    expect(ativoNoDisparo).toBe(parado)
  })

  it('DonutChart: a lista de drill tem nome acessível vindo de quem usa o componente', () => {
    render(
      <DonutChart
        data={[{ name: 'POC', value: 4 }]}
        onSliceClick={vi.fn()}
        drillListLabel="Abrir projetos por tipo"
      />,
    )
    expect(screen.getByRole('list', { name: 'Abrir projetos por tipo' })).toBeInTheDocument()
    // Sem `drillItemLabel` o nome do botão cai no padrão genérico — e continua descrevendo
    // a ação com o alvo, nunca só o rótulo da fatia.
    expect(screen.getByRole('button', { name: 'Ver POC (4)' })).toBeInTheDocument()
  })

  it('DonutChart sem onSliceClick: nenhum botão de drill', () => {
    render(<DonutChart data={[{ name: 'POC', value: 4 }]} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  // ── StatusDistributionChart ─────────────────────────────────────────────────

  it('StatusDistributionChart (equipe): Tab + Enter entregam (statusKey, status)', async () => {
    const user = userEvent.setup()
    let ativoNoDisparo: Element | null = null
    const onSliceClick = vi.fn(() => {
      ativoNoDisparo = document.activeElement
    })

    render(
      <>
        <Ancora />
        <StatusDistributionChart data={STATUS_EQUIPE} onSliceClick={onSliceClick} />
      </>,
    )

    ancorar()
    const botao = screen.getByRole('button', { name: 'Ver tickets do status Em atendimento (8)' })
    await tabularAte(user, botao)

    await user.keyboard('{Enter}')

    expect(onSliceClick).toHaveBeenCalledTimes(1)
    expect(onSliceClick).toHaveBeenCalledWith('em atendimento', 'Em atendimento')
    expect(ativoNoDisparo).toBe(botao)
  })

  it('StatusDistributionChart (global/empilhado): a série também é alcançável por Tab, com o total das equipes', async () => {
    const user = userEvent.setup()
    let ativoNoDisparo: Element | null = null
    const onSliceClick = vi.fn(() => {
      ativoNoDisparo = document.activeElement
    })

    render(
      <>
        <Ancora />
        <StatusDistributionChart data={STATUS_GLOBAL} onSliceClick={onSliceClick} />
      </>,
    )

    ancorar()
    // 5 (N1) + 2 (N2) = 7 — o clique na série empilhada conhece só o status, e o botão
    // reflete o mesmo recorte.
    const botao = screen.getByRole('button', { name: 'Ver tickets do status Novo (7)' })
    await tabularAte(user, botao)

    await user.keyboard('{Enter}')

    expect(onSliceClick).toHaveBeenCalledTimes(1)
    expect(onSliceClick).toHaveBeenCalledWith('novo', 'Novo')
    expect(ativoNoDisparo).toBe(botao)
  })

  it('StatusDistributionChart (global) sem onSliceClick: nenhum botão de drill', () => {
    render(<StatusDistributionChart data={STATUS_GLOBAL} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  // ── Piso de acessibilidade do gatilho ───────────────────────────────────────

  it('o gatilho é <button> nativo com anel de foco visível (não basta ser focável)', async () => {
    const user = userEvent.setup()
    render(
      <>
        <Ancora />
        <CategoryChart data={CATEGORIAS} onBarClick={vi.fn()} />
      </>,
    )

    ancorar()
    const botao = screen.getByRole('button', { name: 'Ver chamados da categoria Dúvida (7)' })
    await tabularAte(user, botao)

    // Papel correto vindo do elemento nativo (sem role/tabIndex manuais).
    expect(botao.tagName).toBe('BUTTON')
    expect(botao).toHaveAttribute('type', 'button')
    expect(botao).not.toHaveAttribute('tabindex')
    // Foco VISÍVEL: jsdom não aplica CSS, então esta asserção é ESTRUTURAL — ela detecta a
    // remoção do anel de tokens, não mede contraste nem visibilidade real (roteiro manual).
    expect(botao.className).toContain('focus:ring-2')
    expect(botao.className).toContain('focus:ring-primary')
  })
})
