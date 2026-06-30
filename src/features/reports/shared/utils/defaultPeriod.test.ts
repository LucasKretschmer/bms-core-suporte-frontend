import { describe, expect, it, vi, afterEach } from 'vitest'
import { format, startOfMonth } from 'date-fns'
import { defaultCurrentMonthPeriod } from './defaultPeriod'

describe('defaultCurrentMonthPeriod', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna 1º dia do mês como from e a data de referência como to', () => {
    const ref = new Date(2026, 5, 30) // 30/06/2026 (mês 5 = junho)
    const period = defaultCurrentMonthPeriod(ref)
    expect(period.from).toBe('2026-06-01')
    expect(period.to).toBe('2026-06-30')
  })

  it('usa o relógio atual quando nenhuma referência é passada', () => {
    const today = new Date()
    const period = defaultCurrentMonthPeriod()
    expect(period.from).toBe(format(startOfMonth(today), 'yyyy-MM-dd'))
    expect(period.to).toBe(format(today, 'yyyy-MM-dd'))
  })

  it('usa fuso LOCAL (format), não UTC — sem off-by-one na virada de mês', () => {
    vi.useFakeTimers()
    // 1º dia do mês à meia-noite local: toISOString daria o dia anterior em fusos negativos.
    vi.setSystemTime(new Date(2024, 2, 1, 0, 0, 0)) // 2024-03-01 00:00 local
    const period = defaultCurrentMonthPeriod()
    expect(period.from).toBe('2024-03-01')
    expect(period.to).toBe('2024-03-01')
  })

  it('from é sempre o dia 01 do mês da referência', () => {
    const period = defaultCurrentMonthPeriod(new Date(2024, 0, 17)) // 17/01/2024
    expect(period.from).toBe('2024-01-01')
    expect(period.to).toBe('2024-01-17')
  })
})
