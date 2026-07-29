import { describe, expect, it } from 'vitest'

import {
  CONTRAST_AUDIT_PAIRS,
  INVOICY_TONE,
  STATUS_LEGEND_ITEMS,
  contrastRatio,
  statusTone,
} from './statusColors'
import type { TicketStatusCategoria } from '../shared/types/reports'

describe('statusTone', () => {
  it.each<[TicketStatusCategoria, string, string]>([
    ['aberto', 'var(--color-status-aberto-fg)', 'var(--color-status-aberto-bg)'],
    ['emandamento', 'var(--color-info-fg)', 'var(--color-info-bg)'],
    ['fechado', 'var(--color-success-fg)', 'var(--color-success-bg)'],
    ['cancelado', 'var(--color-status-cancelado-fg)', 'var(--color-status-cancelado-bg)'],
  ])('retorna o tom correto para categoria "%s"', (categoria, color, backgroundColor) => {
    expect(statusTone(categoria, false)).toEqual({ color, backgroundColor })
  })

  it('retorna o tom neutro quando statusCategoria é null', () => {
    expect(statusTone(null, false)).toEqual({
      color: 'var(--color-badge-neutro-fg)',
      backgroundColor: 'var(--color-badge-neutro-bg)',
    })
  })

  it('retorna o tom neutro quando statusCategoria é undefined', () => {
    expect(statusTone(undefined, false)).toEqual({
      color: 'var(--color-badge-neutro-fg)',
      backgroundColor: 'var(--color-badge-neutro-bg)',
    })
  })

  it('nunca lança para categoria desconhecida — cai no neutro', () => {
    const desconhecida = 'categoria-desconhecida' as unknown as TicketStatusCategoria
    expect(() => statusTone(desconhecida, false)).not.toThrow()
    expect(statusTone(desconhecida, false)).toEqual({
      color: 'var(--color-badge-neutro-fg)',
      backgroundColor: 'var(--color-badge-neutro-bg)',
    })
  })

  it('isInvoicy tem prioridade sobre a categoria, mesmo com "cancelado"', () => {
    expect(statusTone('cancelado', true)).toEqual(INVOICY_TONE)
  })

  it('isInvoicy tem prioridade mesmo sem categoria (null)', () => {
    expect(statusTone(null, true)).toEqual(INVOICY_TONE)
  })
})

describe('STATUS_LEGEND_ITEMS', () => {
  it('tem exatamente 5 itens (4 categorias + Invoicy)', () => {
    expect(STATUS_LEGEND_ITEMS).toHaveLength(5)
  })

  it('nenhum item repete a cor de fundo entre si', () => {
    const backgrounds = STATUS_LEGEND_ITEMS.map((i) => i.tone.backgroundColor)
    expect(new Set(backgrounds).size).toBe(5)
  })

  it('todos os itens têm um label de texto (nunca depende só de cor)', () => {
    for (const item of STATUS_LEGEND_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0)
    }
  })
})

describe('contrastRatio (WCAG, luminância relativa)', () => {
  it('preto sobre branco = 21:1 (referência de corretude da fórmula)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('mesma cor sobre si mesma = 1:1', () => {
    expect(contrastRatio('#a85800', '#a85800')).toBeCloseTo(1, 5)
  })

  it('é simétrica (ordem fg/bg não importa)', () => {
    expect(contrastRatio('#a85800', '#fffbef')).toBeCloseTo(
      contrastRatio('#fffbef', '#a85800'),
      5,
    )
  })
})

describe('CONTRAST_AUDIT_PAIRS — AA obrigatório (D11/AP-FRONTEND-015)', () => {
  it.each(CONTRAST_AUDIT_PAIRS)(
    'par "$label" atinge contraste >= 4.5:1 (texto pequeno, WCAG AA)',
    ({ fg, bg }) => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
    },
  )

  it('cobre os 4 status + o override Invoicy (5 pares no total)', () => {
    expect(CONTRAST_AUDIT_PAIRS).toHaveLength(5)
  })
})
