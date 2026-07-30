import { describe, expect, it } from 'vitest'
import { contrastRatio, hexToRgb, relativeLuminance } from './colorContrast'

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

describe('hexToRgb', () => {
  it('converte hex válido em [r,g,b]', () => {
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255])
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
  })

  it('lança em hex curto demais ("#fff")', () => {
    expect(() => hexToRgb('#fff')).toThrow(/Cor hex inválida/)
  })

  it('lança em hex com caracteres inválidos ("zzzzzz")', () => {
    expect(() => hexToRgb('zzzzzz')).toThrow(/Cor hex inválida/)
  })
})

describe('relativeLuminance', () => {
  it('branco tem luminância 1, preto tem luminância 0', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })
})
