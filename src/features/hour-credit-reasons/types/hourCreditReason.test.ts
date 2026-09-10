import { describe, expect, it } from 'vitest'
import {
  editarMotivoSchema,
  ehMotivoDeSistema,
  MAX_NOME_MOTIVO,
  novoMotivoSchema,
  rotuloSituacaoDoMotivo,
} from './hourCreditReason'

describe('ehMotivoDeSistema — guard FAIL-CLOSED (R-19)', () => {
  it('🔴 só `isSistema === false` libera as ações', () => {
    // Literal escrito à mão, os quatro estados possíveis do campo na rede.
    expect(ehMotivoDeSistema({ isSistema: false })).toBe(false)
    expect(ehMotivoDeSistema({ isSistema: true })).toBe(true)
    // `null` EXPLÍCITO: um teste só com `undefined` passaria numa implementação
    // `=== undefined` e não discriminaria (`AP-FRONTEND-028`).
    expect(ehMotivoDeSistema({ isSistema: null })).toBe(true)
    expect(ehMotivoDeSistema({})).toBe(true)
    expect(ehMotivoDeSistema(undefined)).toBe(true)
    expect(ehMotivoDeSistema(null)).toBe(true)
  })

  it('a assimetria é deliberada: 1 valor libera, 4 bloqueiam', () => {
    // Cardinalidade simétrica não discrimina: com um caso de cada lado, inverter o
    // predicado passaria. Aqui a inversão (`=== true`) deixaria 3 casos vermelhos.
    const entradas = [{ isSistema: false }, { isSistema: true }, { isSistema: null }, {}]
    expect(entradas.map(ehMotivoDeSistema)).toEqual([false, true, true, true])
  })
})

describe('rotuloSituacaoDoMotivo', () => {
  it('`null`/ausente vira "—" — nunca "Inativo"', () => {
    // Afirmar "inativo" sobre um valor que o servidor não mandou é o defeito literal do
    // `AP-FRONTEND-028`.
    expect(rotuloSituacaoDoMotivo({ isActive: null })).toBe('—')
    expect(rotuloSituacaoDoMotivo({})).toBe('—')
  })

  it('companheira positiva: true → "Ativo", false → "Inativo"', () => {
    expect(rotuloSituacaoDoMotivo({ isActive: true })).toBe('Ativo')
    expect(rotuloSituacaoDoMotivo({ isActive: false })).toBe('Inativo')
  })
})

describe('schemas de motivo', () => {
  it('nome vazio ou só espaços reprova, com mensagem em português', () => {
    const r = novoMotivoSchema.safeParse({ nome: '   ' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Informe o nome do motivo.')
  })

  it('nome é trimado antes de sair para o servidor', () => {
    const r = novoMotivoSchema.safeParse({ nome: '  Cortesia comercial  ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.nome).toBe('Cortesia comercial')
  })

  it('🔴 o limite é 120 — o MESMO do banco, e a mensagem cita esse número', () => {
    // Âncora: `suporte.motivoscredito.nome` é `varchar(120)` com
    // `CHECK length(btrim(nome)) BETWEEN 1 AND 120`. Um limite maior aqui deixaria o
    // servidor recusar com 422/23514 depois de o usuário digitar tudo.
    expect(MAX_NOME_MOTIVO).toBe(120)
    expect(novoMotivoSchema.safeParse({ nome: 'a'.repeat(120) }).success).toBe(true)
    const r = novoMotivoSchema.safeParse({ nome: 'a'.repeat(121) })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].message).toBe('O nome deve ter no máximo 120 caracteres.')
    }
  })

  it('edição tem o mesmo campo e a mesma regra que a criação', () => {
    expect(Object.keys(editarMotivoSchema.shape)).toEqual(['nome'])
    expect(editarMotivoSchema.safeParse({ nome: '' }).success).toBe(false)
  })
})
