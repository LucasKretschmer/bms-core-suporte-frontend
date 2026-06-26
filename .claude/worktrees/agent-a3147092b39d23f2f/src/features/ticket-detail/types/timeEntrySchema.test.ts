import { describe, expect, it } from 'vitest'
import { timeEntrySchema } from './timeEntrySchema'

function base() {
  return {
    userId: 'u1',
    serviceCategoryId: 'sc1',
    billableOutsidePlan: false,
    note: '',
    works: [{ start: '2026-06-19T08:00', end: '2026-06-19T09:00' }],
  }
}

/** Extrai as mensagens de erro de um resultado do safeParse. */
function messages(result: ReturnType<typeof timeEntrySchema.safeParse>): string[] {
  if (result.success) return []
  return result.error.issues.map((i) => i.message)
}

describe('timeEntrySchema', () => {
  it('aceita um bloco válido', () => {
    expect(timeEntrySchema.safeParse(base()).success).toBe(true)
  })

  it('categorização vazia → erro', () => {
    const r = timeEntrySchema.safeParse({ ...base(), serviceCategoryId: '' })
    expect(r.success).toBe(false)
    expect(messages(r)).toContain('Selecione a categorização do atendimento.')
  })

  it('atendente vazio → erro', () => {
    const r = timeEntrySchema.safeParse({ ...base(), userId: '' })
    expect(r.success).toBe(false)
    expect(messages(r)).toContain('Selecione o atendente.')
  })

  it('works vazio → erro', () => {
    const r = timeEntrySchema.safeParse({ ...base(), works: [] })
    expect(r.success).toBe(false)
    expect(messages(r)).toContain('Adicione ao menos um apontamento.')
  })

  it('fim <= início → erro', () => {
    const r = timeEntrySchema.safeParse({
      ...base(),
      works: [{ start: '2026-06-19T09:00', end: '2026-06-19T08:00' }],
    })
    expect(r.success).toBe(false)
    expect(messages(r)).toContain('O fim deve ser maior que o início.')
  })

  it('dois blocos sobrepostos → erro', () => {
    const r = timeEntrySchema.safeParse({
      ...base(),
      works: [
        { start: '2026-06-19T08:00', end: '2026-06-19T10:00' },
        { start: '2026-06-19T09:00', end: '2026-06-19T11:00' },
      ],
    })
    expect(r.success).toBe(false)
    expect(messages(r)).toContain(
      'Há apontamentos com horários sobrepostos. Ajuste para que não se cruzem.',
    )
  })

  it('blocos válidos fora de ordem (retroativos) → passa (ordena antes de validar)', () => {
    const r = timeEntrySchema.safeParse({
      ...base(),
      works: [
        { start: '2026-06-19T10:00', end: '2026-06-19T11:00' },
        { start: '2026-06-19T08:00', end: '2026-06-19T09:00' },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('dois blocos contíguos (sem gap) → passa', () => {
    const r = timeEntrySchema.safeParse({
      ...base(),
      works: [
        { start: '2026-06-19T08:00', end: '2026-06-19T09:00' },
        { start: '2026-06-19T09:00', end: '2026-06-19T10:00' },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('observação acima de 2000 chars → erro', () => {
    const r = timeEntrySchema.safeParse({ ...base(), note: 'a'.repeat(2001) })
    expect(r.success).toBe(false)
  })
})
