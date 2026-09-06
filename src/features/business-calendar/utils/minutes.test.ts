import { describe, expect, it } from 'vitest'
import {
  MINUTO_MAXIMO,
  MINUTO_MINIMO,
  formatarDuracao,
  formatarJanela,
  horaParaMinuto,
  minutoParaHora,
} from './minutes'

/**
 * A-3 — **minuto do dia, `0..1440`, sem sentinela.**
 *
 * O que faz cada assert daqui ficar vermelho: qualquer volta à sentinela
 * (`1440` renderizado como `00:00`, `00:00` aceito como "fim do dia"), o teto caindo
 * para 1439 (o que tornaria 24/7 inexprimível) ou o parse aceitando `24:30`.
 */
describe('minutes — minuto do dia (A-3)', () => {
  it('os limites são 0 e 1440, e 1440 é hora VÁLIDA, não sentinela', () => {
    expect(MINUTO_MINIMO).toBe(0)
    expect(MINUTO_MAXIMO).toBe(1440)
  })

  it('minutoParaHora distingue as DUAS meia-noites', () => {
    expect(minutoParaHora(0)).toBe('00:00')
    expect(minutoParaHora(1440)).toBe('24:00')
    // A sentinela proibida seria exatamente esta igualdade.
    expect(minutoParaHora(1440)).not.toBe(minutoParaHora(0))
  })

  it('minutoParaHora formata horas comuns com dois dígitos', () => {
    expect(minutoParaHora(480)).toBe('08:00')
    expect(minutoParaHora(720)).toBe('12:00')
    expect(minutoParaHora(1080)).toBe('18:00')
    expect(minutoParaHora(1_050)).toBe('17:30')
    expect(minutoParaHora(5)).toBe('00:05')
  })

  it('minutoParaHora devolve null fora da faixa — sem inventar hora', () => {
    expect(minutoParaHora(-1)).toBeNull()
    expect(minutoParaHora(1441)).toBeNull()
    expect(minutoParaHora(12.5)).toBeNull()
  })

  it('horaParaMinuto lê 24:00 como 1440 — é o que torna 24/7 exprimível', () => {
    expect(horaParaMinuto('24:00')).toBe(1440)
    expect(horaParaMinuto('00:00')).toBe(0)
  })

  it('horaParaMinuto aceita o que um humano digita', () => {
    expect(horaParaMinuto('8:00')).toBe(480)
    expect(horaParaMinuto('08:00')).toBe(480)
    expect(horaParaMinuto('0800')).toBe(480)
    expect(horaParaMinuto('8')).toBe(480)
    expect(horaParaMinuto(' 18:30 ')).toBe(1110)
  })

  it('horaParaMinuto recusa hora que não existe', () => {
    expect(horaParaMinuto('24:01')).toBeNull()
    expect(horaParaMinuto('25:00')).toBeNull()
    expect(horaParaMinuto('12:60')).toBeNull()
    expect(horaParaMinuto('meio-dia')).toBeNull()
    expect(horaParaMinuto('')).toBeNull()
  })

  it('ida e volta preserva o valor em toda a faixa', () => {
    for (const minuto of [0, 1, 59, 60, 480, 720, 1439, 1440]) {
      const hora = minutoParaHora(minuto)
      expect(hora).not.toBeNull()
      expect(horaParaMinuto(hora as string)).toBe(minuto)
    }
  })

  it('formatarJanela e formatarDuracao descrevem a janela para o usuário', () => {
    expect(formatarJanela(480, 1080)).toBe('08:00 às 18:00')
    expect(formatarJanela(0, 1440)).toBe('00:00 às 24:00')
    expect(formatarDuracao(600)).toBe('10h')
    expect(formatarDuracao(630)).toBe('10h30')
    expect(formatarDuracao(30)).toBe('30min')
    expect(formatarDuracao(0)).toBe('0h')
  })
})
