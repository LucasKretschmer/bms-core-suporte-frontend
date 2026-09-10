import { describe, expect, it } from 'vitest'
import {
  editarCreditoSchema,
  normalizarOrigemDoCredito,
  normalizarStatusDoCredito,
  novoCreditoSchema,
  ORIGENS_DO_CREDITO,
  rotuloDaOrigem,
  rotuloDoStatus,
  STATUS_DO_CREDITO,
} from './hourCredit'

describe('vocabulário do servidor (AP-API-002)', () => {
  it('a IDENTIDADE do conjunto de status é esta — não a cardinalidade', () => {
    // 🔴 Vermelho quando alguém acrescenta, remove ou renomeia um status sem cruzar com o
    // servidor. Cardinalidade passaria com um valor entrando e outro saindo.
    expect([...STATUS_DO_CREDITO]).toEqual(['vigente', 'expirado', 'estornado'])
  })

  it('a IDENTIDADE do conjunto de origens é esta', () => {
    expect([...ORIGENS_DO_CREDITO]).toEqual(['automatico', 'manual'])
  })

  it('status desconhecido é fail-closed: nunca vira um dos três conhecidos', () => {
    // Vermelho se o normalizador ganhar um `?? 'vigente'` — que afirmaria que um crédito
    // de estado desconhecido ainda vale.
    expect(normalizarStatusDoCredito('mosaico')).toBe('desconhecido')
    expect(normalizarStatusDoCredito('')).toBe('desconhecido')
    expect(normalizarStatusDoCredito('VIGENTE')).toBe('desconhecido')
  })

  it('🔴 `null` EXPLÍCITO cai no mesmo ramo que ausente (AP-FRONTEND-028)', () => {
    // O caso `null` é o que discrimina `== null` de `=== undefined`: um teste só com
    // `undefined` passa nas DUAS implementações e não prova nada.
    expect(normalizarStatusDoCredito(null)).toBe('desconhecido')
    expect(normalizarStatusDoCredito(undefined)).toBe('desconhecido')
    expect(normalizarOrigemDoCredito(null)).toBe('desconhecido')
    expect(normalizarOrigemDoCredito(undefined)).toBe('desconhecido')
  })

  it('companheira positiva: os valores conhecidos atravessam inteiros', () => {
    // Sem isto, um normalizador que devolvesse 'desconhecido' para TUDO passaria nos
    // asserts acima (a asserção negativa é satisfeita pelo vazio).
    expect(STATUS_DO_CREDITO.map(normalizarStatusDoCredito)).toEqual([
      'vigente',
      'expirado',
      'estornado',
    ])
    expect(ORIGENS_DO_CREDITO.map(normalizarOrigemDoCredito)).toEqual(['automatico', 'manual'])
  })
})

describe('rótulos — um texto por membro, nunca um texto para a família', () => {
  it('traduz os conhecidos, literais escritos à mão', () => {
    expect(rotuloDoStatus('vigente')).toBe('Vigente')
    expect(rotuloDoStatus('expirado')).toBe('Expirado')
    expect(rotuloDoStatus('estornado')).toBe('Estornado')
    expect(rotuloDaOrigem('automatico')).toBe('Automático')
    expect(rotuloDaOrigem('manual')).toBe('Manual')
  })

  it('valor novo do servidor aparece CRU — nunca traduzido para um dos conhecidos', () => {
    expect(rotuloDoStatus('mosaico')).toBe('mosaico')
    expect(rotuloDaOrigem('importado')).toBe('importado')
  })

  it('ausente/`null` vira "—", não um estado inventado', () => {
    expect(rotuloDoStatus(null)).toBe('—')
    expect(rotuloDoStatus(undefined)).toBe('—')
    expect(rotuloDaOrigem(null)).toBe('—')
  })
})

describe('novoCreditoSchema (T-22) — a fronteira string→number', () => {
  it('🔴 coage a string do <input> para number: o form envia, o backend recebe int', () => {
    // Memória `dto-request-id-tipo-int`: com `z.number()` (sem `coerce`) TODA digitação
    // reprovaria e o formulário nunca enviaria nada — e o defeito apareceria como
    // "o botão não faz nada".
    const r = novoCreditoSchema.safeParse({ clientId: '42', horas: '2.5', motivoId: '7' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toEqual({ clientId: 42, horas: 2.5, motivoId: 7 })
      expect(typeof r.data.clientId).toBe('number')
    }
  })

  it('horas "0" reprova, com a mensagem em português', () => {
    const r = novoCreditoSchema.safeParse({ clientId: '1', horas: '0', motivoId: '1' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.find((i) => i.path[0] === 'horas')?.message).toBe(
        'Informe um número de horas maior que zero.',
      )
    }
  })

  it('horas "abc" reprova (NaN não passa por "positivo")', () => {
    const r = novoCreditoSchema.safeParse({ clientId: '1', horas: 'abc', motivoId: '1' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const mensagem = r.error.issues.find((i) => i.path[0] === 'horas')?.message
      expect(mensagem).toBeDefined()
      // A mensagem é em português — nunca o texto cru do Zod em inglês.
      expect(mensagem).not.toMatch(/expected|received|invalid_type/i)
    }
  })

  it('horas negativas reprovam', () => {
    expect(novoCreditoSchema.safeParse({ clientId: '1', horas: '-2', motivoId: '1' }).success).toBe(
      false,
    )
  })

  it('cliente e motivo ausentes reprovam com mensagem própria', () => {
    const r = novoCreditoSchema.safeParse({ clientId: undefined, horas: '2', motivoId: undefined })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.find((i) => i.path[0] === 'clientId')?.message).toBe(
        'Selecione o cliente.',
      )
      expect(r.error.issues.find((i) => i.path[0] === 'motivoId')?.message).toBe(
        'Selecione o motivo.',
      )
    }
  })

  it('🔴 D8′ — o schema tem EXATAMENTE três campos: sem competência e sem período final', () => {
    // Identidade das chaves, não `toMatchObject`: é o que impede um campo de data de
    // voltar ao formulário. O crédito vale UMA competência (D8′ ratificada), derivada no
    // servidor — qualquer campo de data aqui é reprovação.
    expect(Object.keys(novoCreditoSchema.shape).sort()).toEqual(['clientId', 'horas', 'motivoId'])
    expect(Object.keys(editarCreditoSchema.shape).sort()).toEqual(['horas', 'motivoId'])
  })

  it('campo extra no input é descartado — nunca repassado ao body', () => {
    const r = novoCreditoSchema.safeParse({
      clientId: '1',
      horas: '2',
      motivoId: '1',
      competenciaFim: '2026-12',
      origem: 'automatico',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(Object.keys(r.data).sort()).toEqual(['clientId', 'horas', 'motivoId'])
    }
  })
})
