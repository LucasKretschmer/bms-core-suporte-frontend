import { describe, expect, it } from 'vitest'
import {
  MOTIVO_MAX_LENGTH,
  MOTIVO_MIN_LENGTH,
  reabrirCompetenciaSchema,
} from './billingPeriod'

describe('reabrirCompetenciaSchema (C-8)', () => {
  const valido = { motivo: 'Fatura corrigida pelo financeiro', confirmarImpactoEmCreditos: true }

  it('aceita o caso válido', () => {
    expect(reabrirCompetenciaSchema.safeParse(valido).success).toBe(true)
  })

  it('a confirmação de impacto é OBRIGATÓRIA — `false` reprova com mensagem em português', () => {
    // 🔴 C-8. Sem esta trava, o formulário enviaria `false` e o servidor recusaria com 409
    // num laço que o usuário não entende — ou pior, reabriria em silêncio a competência que
    // não tem dependentes, sem que ninguém tivesse lido o aviso de impacto.
    const resultado = reabrirCompetenciaSchema.safeParse({
      ...valido,
      confirmarImpactoEmCreditos: false,
    })

    expect(resultado.success).toBe(false)
    expect(resultado.error?.issues[0].message).toBe(
      'Confirme que leu o impacto sobre os créditos para poder reabrir.',
    )
  })

  it('o motivo respeita os limites do backend (3..255), com mensagem em português', () => {
    // Os números vêm das constantes, que são a mesma fonte do texto exibido — mudar o
    // limite muda schema e mensagem juntos (`AP-FRONTEND-022`).
    const curto = reabrirCompetenciaSchema.safeParse({ ...valido, motivo: 'ab' })
    expect(curto.success).toBe(false)
    expect(curto.error?.issues[0].message).toContain(String(MOTIVO_MIN_LENGTH))

    const longo = reabrirCompetenciaSchema.safeParse({
      ...valido,
      motivo: 'x'.repeat(MOTIVO_MAX_LENGTH + 1),
    })
    expect(longo.success).toBe(false)
    expect(longo.error?.issues[0].message).toContain(String(MOTIVO_MAX_LENGTH))

    // Companheiras positivas nas duas bordas: o limite não pode estar deslocado em 1.
    expect(
      reabrirCompetenciaSchema.safeParse({ ...valido, motivo: 'x'.repeat(MOTIVO_MIN_LENGTH) })
        .success,
    ).toBe(true)
    expect(
      reabrirCompetenciaSchema.safeParse({ ...valido, motivo: 'x'.repeat(MOTIVO_MAX_LENGTH) })
        .success,
    ).toBe(true)
  })

  it('espaços em volta não contam como motivo', () => {
    const resultado = reabrirCompetenciaSchema.safeParse({ ...valido, motivo: '   a   ' })
    expect(resultado.success).toBe(false)
  })

  it('o valor de saída é o motivo já aparado', () => {
    const resultado = reabrirCompetenciaSchema.safeParse({
      ...valido,
      motivo: '  Erro na fatura  ',
    })
    expect(resultado.success && resultado.data.motivo).toBe('Erro na fatura')
  })
})
