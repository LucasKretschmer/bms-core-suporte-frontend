/**
 * Testes de StatusDistributionChart.
 *
 * Cobre:
 *  - Funções puras (buildColorByStatus, toStackedRows, collectStatuses) — AP-FRONTEND-006.
 *  - Comportamento: modo equipe (byTeam:false) vs global (byTeam:true), loading, empty.
 *  - AP-SECURITY-001: nenhum literal de CATEGORIAS_PROIBIDAS aparece no DOM.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  StatusDistributionChart,
  buildColorByStatus,
  toStackedRows,
  collectStatuses,
  buildStatusKeyByStatus,
} from './StatusDistributionChart'
import { CATEGORIAS_PROIBIDAS } from '../utils/kpiCatalog'
import type {
  StatusDistributionDto,
  StatusDistributionGlobalScopeDto,
  StatusDistributionTeamScopeDto,
} from '../types/metrics'

// Mock de getChartPalette para evitar dependência de CSS vars
const PALETTE = ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D']
vi.mock('../utils/chartTokens', () => ({
  getChartTokens: () => ({}),
  getChartPalette: () => ['#2563EB', '#16A34A', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'],
  resetChartTokensCache: () => {},
}))

// ── Dados ─────────────────────────────────────────────────────────────────────

// 020: stageId carrega a chave do grupo por retrocompat; statusKey é a identidade real.
const TEAM_DATA: StatusDistributionTeamScopeDto = {
  byTeam: false,
  data: [
    { stageId: 'em atendimento', statusKey: 'em atendimento', status: 'Em atendimento', count: 8 },
    { stageId: 'aguardando cliente', statusKey: 'aguardando cliente', status: 'Aguardando Cliente', count: 3 },
    { stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 5 },
  ],
}

const GLOBAL_DATA: StatusDistributionGlobalScopeDto = {
  byTeam: true,
  data: [
    {
      equipe: 'Suporte N1',
      porStatus: [
        { stageId: 'em atendimento', statusKey: 'em atendimento', status: 'Em atendimento', count: 8 },
        { stageId: 'aguardando cliente', statusKey: 'aguardando cliente', status: 'Aguardando Cliente', count: 3 },
      ],
    },
    {
      equipe: 'Suporte N2',
      porStatus: [
        { stageId: 'em atendimento', statusKey: 'em atendimento', status: 'Em atendimento', count: 2 },
        // 'Aguardando Cliente' ausente nesta equipe — não deve quebrar
        { stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 4 },
      ],
    },
  ],
}

// ── Funções puras ──────────────────────────────────────────────────────────────

describe('buildColorByStatus — cor estável por status', () => {
  it('atribui cores por ordem alfabética de status', () => {
    const map = buildColorByStatus(['Novo', 'Aguardando', 'Em atendimento'], PALETTE)
    // ordem alfabética: Aguardando, Em atendimento, Novo
    expect(map['Aguardando']).toBe(PALETTE[0])
    expect(map['Em atendimento']).toBe(PALETTE[1])
    expect(map['Novo']).toBe(PALETTE[2])
  })

  it('é estável: mesmo conjunto em ordem diferente produz o mesmo mapa', () => {
    const a = buildColorByStatus(['Novo', 'Aguardando', 'Em atendimento'], PALETTE)
    const b = buildColorByStatus(['Em atendimento', 'Novo', 'Aguardando'], PALETTE)
    expect(a).toEqual(b)
  })

  it('deduplica status repetidos', () => {
    const map = buildColorByStatus(['Novo', 'Novo', 'Aguardando'], PALETTE)
    expect(Object.keys(map)).toHaveLength(2)
  })

  it('cicla a paleta quando há mais status que cores', () => {
    const many = Array.from({ length: 9 }, (_, i) => `S${i}`)
    const map = buildColorByStatus(many, PALETTE)
    // S0..S8 ordenado → S8 é o 9º (índice 8) → 8 % 8 = 0 → mesma cor de S0
    expect(map['S8']).toBe(map['S0'])
  })
})

describe('toStackedRows — pivot equipe × status', () => {
  it('transforma cada equipe em uma linha com chaves por status', () => {
    const rows = toStackedRows(GLOBAL_DATA.data)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      equipe: 'Suporte N1',
      'Em atendimento': 8,
      'Aguardando Cliente': 3,
    })
    expect(rows[1]).toEqual({
      equipe: 'Suporte N2',
      'Em atendimento': 2,
      Novo: 4,
    })
  })

  it('soma contagens de status duplicado na mesma equipe', () => {
    const rows = toStackedRows([
      {
        equipe: 'X',
        porStatus: [
          { stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 2 },
          { stageId: 'novo', statusKey: 'novo', status: 'Novo', count: 3 },
        ],
      },
    ])
    expect(rows[0]['Novo']).toBe(5)
  })

  it('equipe sem status vira linha só com equipe', () => {
    const rows = toStackedRows([{ equipe: 'Vazia', porStatus: [] }])
    expect(rows[0]).toEqual({ equipe: 'Vazia' })
  })
})

describe('collectStatuses — conjunto único alfabético', () => {
  it('escopo equipe: coleta e ordena status', () => {
    expect(collectStatuses(TEAM_DATA)).toEqual([
      'Aguardando Cliente',
      'Em atendimento',
      'Novo',
    ])
  })

  it('escopo global: une status de todas as equipes sem duplicar', () => {
    expect(collectStatuses(GLOBAL_DATA)).toEqual([
      'Aguardando Cliente',
      'Em atendimento',
      'Novo',
    ])
  })
})

describe('buildStatusKeyByStatus — mapa rótulo → chave de grupo (020)', () => {
  it('escopo equipe: mapeia cada status para seu statusKey', () => {
    const map = buildStatusKeyByStatus(TEAM_DATA)
    expect(map['Em atendimento']).toBe('em atendimento')
    expect(map['Aguardando Cliente']).toBe('aguardando cliente')
    expect(map['Novo']).toBe('novo')
  })

  it('escopo global: usa a primeira ocorrência de cada status', () => {
    const map = buildStatusKeyByStatus(GLOBAL_DATA)
    expect(map['Em atendimento']).toBe('em atendimento')
    expect(map['Novo']).toBe('novo')
  })
})

// ── Comportamento do componente ─────────────────────────────────────────────────

describe('StatusDistributionChart — render', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('modo equipe (byTeam:false) renderiza sem crash', () => {
    expect(() => render(<StatusDistributionChart data={TEAM_DATA} />)).not.toThrow()
  })

  it('modo global (byTeam:true) renderiza sem crash mesmo com status ausente em uma equipe', () => {
    expect(() => render(<StatusDistributionChart data={GLOBAL_DATA} />)).not.toThrow()
  })

  it('isLoading=true → renderiza skeleton, não gráfico', () => {
    render(<StatusDistributionChart data={TEAM_DATA} isLoading />)
    const skeleton = document.querySelector('[aria-busy="true"]')
    expect(skeleton).toBeTruthy()
    expect(screen.queryByText('Novo')).not.toBeInTheDocument()
  })

  it('escopo equipe vazio → não crasha e não renderiza gráfico', () => {
    const empty: StatusDistributionDto = { byTeam: false, data: [] }
    const { container } = render(<StatusDistributionChart data={empty} />)
    expect(container).toBeTruthy()
    expect(screen.queryByText('Novo')).not.toBeInTheDocument()
  })

  it('escopo global vazio → não crasha', () => {
    const empty: StatusDistributionDto = { byTeam: true, data: [] }
    expect(() => render(<StatusDistributionChart data={empty} />)).not.toThrow()
  })

  it('aceita onSliceClick e height sem erro de tipo/runtime', () => {
    const onSliceClick = vi.fn()
    expect(() =>
      render(<StatusDistributionChart data={TEAM_DATA} onSliceClick={onSliceClick} height={300} />),
    ).not.toThrow()
  })

  it('modo equipe: botão acessível de cada status dispara drill com (statusKey, status) — OBS-1', () => {
    const onSliceClick = vi.fn()
    render(<StatusDistributionChart data={TEAM_DATA} onSliceClick={onSliceClick} />)

    // Botões focáveis por teclado (alternativa às barras do Recharts).
    const btn = screen.getByRole('button', { name: /Ver tickets do status Em atendimento/i })
    fireEvent.click(btn)

    expect(onSliceClick).toHaveBeenCalledTimes(1)
    expect(onSliceClick).toHaveBeenCalledWith('em atendimento', 'Em atendimento')
  })

  it('modo equipe: um botão de drill por status agrupado', () => {
    const onSliceClick = vi.fn()
    render(<StatusDistributionChart data={TEAM_DATA} onSliceClick={onSliceClick} />)
    expect(screen.getAllByRole('button')).toHaveLength(TEAM_DATA.data.length)
  })

  it('sem onSliceClick: não renderiza botões de drill (não interativo)', () => {
    render(<StatusDistributionChart data={TEAM_DATA} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('AP-SECURITY-001: nenhuma categoria proibida aparece no DOM', () => {
    render(<StatusDistributionChart data={GLOBAL_DATA} />)
    for (const proibida of CATEGORIAS_PROIBIDAS) {
      expect(
        document.body.textContent,
        `Categoria proibida "${proibida}" não deve aparecer no DOM`,
      ).not.toContain(proibida)
    }
  })
})
