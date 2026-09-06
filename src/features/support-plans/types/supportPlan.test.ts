import { describe, expect, it } from 'vitest'
import {
  parseDecimalInput,
  parseIntegerInput,
  supportPlanFormSchema,
  toSupportPlanFormValues,
  toSupportPlanRequest,
  type SupportPlanDto,
  type SupportPlanFormValues,
} from './supportPlan'

const planoBase: SupportPlanDto = {
  id: 7,
  nome: 'Support Premium Plus (20min)',
  horasMes: 40,
  precoHoraExtra: 250.5,
  moeda: 'BRL',
  isActive: true,
  hubspotValor: 'premium_plus',
  slaPrimeiroAtendimentoMinutos: 20,
  slaIsento: false,
  calendarioId: 3,
  clientesVinculados: 4,
}

const valoresValidos: SupportPlanFormValues = {
  nome: 'Support Pro',
  horasMes: '40',
  precoHoraExtra: '250,50',
  moeda: 'brl',
  hubspotValor: ' plano_pro ',
  slaPrimeiroAtendimentoMinutos: '30',
  slaIsento: false,
  calendarioId: '3',
}

describe('parseDecimalInput', () => {
  it('aceita ponto e vírgula como separador decimal', () => {
    expect(parseDecimalInput('40.5')).toBe(40.5)
    expect(parseDecimalInput('40,5')).toBe(40.5)
  })

  it('devolve null para vazio, espaço e texto não numérico', () => {
    // `Number('')` e `Number(' ')` são 0, e `Number('0x10')` é 16 — nenhum deles é um
    // decimal digitado por um humano. Este assert fica vermelho se o parsing voltar a
    // delegar ao construtor Number.
    expect(parseDecimalInput('')).toBeNull()
    expect(parseDecimalInput('   ')).toBeNull()
    expect(parseDecimalInput('0x10')).toBeNull()
    expect(parseDecimalInput('abc')).toBeNull()
    expect(parseDecimalInput('1e3')).toBeNull()
    expect(parseDecimalInput('-5')).toBeNull()
  })
})

describe('parseIntegerInput', () => {
  it('aceita inteiro e recusa decimal, negativo e vazio', () => {
    expect(parseIntegerInput('20')).toBe(20)
    expect(parseIntegerInput(' 20 ')).toBe(20)
    expect(parseIntegerInput('20.5')).toBeNull()
    expect(parseIntegerInput('-1')).toBeNull()
    expect(parseIntegerInput('')).toBeNull()
  })
})

describe('supportPlanFormSchema', () => {
  it('aprova o formulário preenchido corretamente', () => {
    expect(supportPlanFormSchema.safeParse(valoresValidos).success).toBe(true)
  })

  it('exige nome', () => {
    const r = supportPlanFormSchema.safeParse({ ...valoresValidos, nome: '   ' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe('Informe o nome do plano.')
    }
  })

  it('recusa horas mensais igual a zero (o backend exige > 0)', () => {
    // `CreateSupportPlanValidator.cs` → `GreaterThan(0)`. Sem esta trava o usuário só
    // descobre pelo 422.
    const r = supportPlanFormSchema.safeParse({ ...valoresValidos, horasMes: '0' })
    expect(r.success).toBe(false)
  })

  it('recusa moeda fora do formato ISO 4217 de 3 letras', () => {
    expect(supportPlanFormSchema.safeParse({ ...valoresValidos, moeda: 'REAL' }).success).toBe(false)
    expect(supportPlanFormSchema.safeParse({ ...valoresValidos, moeda: 'R$1' }).success).toBe(false)
    expect(supportPlanFormSchema.safeParse({ ...valoresValidos, moeda: 'usd' }).success).toBe(true)
  })

  it('aceita meta de SLA vazia (herda o padrão do calendário)', () => {
    const r = supportPlanFormSchema.safeParse({
      ...valoresValidos,
      slaPrimeiroAtendimentoMinutos: '',
    })
    expect(r.success).toBe(true)
  })

  it('recusa meta de SLA zero ou fracionada', () => {
    expect(
      supportPlanFormSchema.safeParse({ ...valoresValidos, slaPrimeiroAtendimentoMinutos: '0' })
        .success,
    ).toBe(false)
    expect(
      supportPlanFormSchema.safeParse({ ...valoresValidos, slaPrimeiroAtendimentoMinutos: '1,5' })
        .success,
    ).toBe(false)
  })

  it('recusa isento COM meta preenchida e aponta o erro para o campo da meta', () => {
    // Espelha `ck_suporte_supportplans_slaisento` (M2): é estado proibido no banco, e o
    // backend responde `422 PLAN_SLA_CONFLICT`.
    const r = supportPlanFormSchema.safeParse({
      ...valoresValidos,
      slaIsento: true,
      slaPrimeiroAtendimentoMinutos: '20',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['slaPrimeiroAtendimentoMinutos'])
    }
  })

  it('aceita isento SEM meta — companheira positiva do caso acima', () => {
    const r = supportPlanFormSchema.safeParse({
      ...valoresValidos,
      slaIsento: true,
      slaPrimeiroAtendimentoMinutos: '',
    })
    expect(r.success).toBe(true)
  })
})

describe('toSupportPlanFormValues', () => {
  it('converte nulos em string vazia — nunca "null" no input', () => {
    const values = toSupportPlanFormValues({
      ...planoBase,
      precoHoraExtra: null,
      hubspotValor: null,
      slaPrimeiroAtendimentoMinutos: null,
      calendarioId: null,
    })
    expect(values.precoHoraExtra).toBe('')
    expect(values.hubspotValor).toBe('')
    expect(values.slaPrimeiroAtendimentoMinutos).toBe('')
    expect(values.calendarioId).toBe('')
  })

  it('preenche a partir do plano na edição', () => {
    const values = toSupportPlanFormValues(planoBase)
    expect(values).toEqual({
      nome: 'Support Premium Plus (20min)',
      horasMes: '40',
      precoHoraExtra: '250.5',
      moeda: 'BRL',
      hubspotValor: 'premium_plus',
      slaPrimeiroAtendimentoMinutos: '20',
      slaIsento: false,
      calendarioId: '3',
    })
  })

  it('na criação usa BRL e o identificador pré-preenchido do card de não correspondentes', () => {
    const values = toSupportPlanFormValues(null, 'Support Gold')
    expect(values.moeda).toBe('BRL')
    expect(values.hubspotValor).toBe('Support Gold')
    expect(values.nome).toBe('')
  })

  it('o identificador pré-preenchido NÃO sobrescreve o do plano em edição', () => {
    const values = toSupportPlanFormValues(planoBase, 'Support Gold')
    expect(values.hubspotValor).toBe('premium_plus')
  })
})

describe('toSupportPlanRequest — R-10: tipo do id no WIRE', () => {
  it('serializa calendarioId e a meta de SLA como NÚMERO no JSON, não string', () => {
    // R-10 (`arquitetura.md` §6): DTO de request com id `string` produz 400 de model
    // binding silencioso, mascarado por toast genérico. A asserção é sobre o JSON
    // **serializado** — o objeto em memória passaria nos dois mundos se alguém trocasse
    // `number` por `string` no tipo, porque TypeScript some em runtime.
    const payload = toSupportPlanRequest(valoresValidos)
    const wire: unknown = JSON.parse(JSON.stringify(payload))
    const corpo = wire as Record<string, unknown>

    expect(typeof corpo.calendarioId).toBe('number')
    expect(corpo.calendarioId).toBe(3)
    expect(typeof corpo.slaPrimeiroAtendimentoMinutos).toBe('number')
    expect(corpo.slaPrimeiroAtendimentoMinutos).toBe(30)
    expect(typeof corpo.horasMes).toBe('number')
    expect(corpo.horasMes).toBe(40)
    expect(typeof corpo.precoHoraExtra).toBe('number')
    expect(corpo.precoHoraExtra).toBe(250.5)
    expect(typeof corpo.slaIsento).toBe('boolean')
  })

  it('campo vazio vira null no wire — nunca "" nem 0', () => {
    // `""` em `hubspotValor` colidiria no índice único `lower(hubspotvalor)` (M1) do
    // segundo plano em diante; `0` em `calendarioId` seria FK inexistente.
    const payload = toSupportPlanRequest({
      ...valoresValidos,
      precoHoraExtra: '',
      hubspotValor: '   ',
      slaPrimeiroAtendimentoMinutos: '',
      calendarioId: '',
    })
    const corpo = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>

    expect(corpo.precoHoraExtra).toBeNull()
    expect(corpo.hubspotValor).toBeNull()
    expect(corpo.slaPrimeiroAtendimentoMinutos).toBeNull()
    expect(corpo.calendarioId).toBeNull()
  })

  it('plano isento nunca manda meta preenchida (CHECK do banco)', () => {
    const payload = toSupportPlanRequest({
      ...valoresValidos,
      slaIsento: true,
      slaPrimeiroAtendimentoMinutos: '20',
    })
    expect(payload.slaIsento).toBe(true)
    expect(payload.slaPrimeiroAtendimentoMinutos).toBeNull()
  })

  it('normaliza nome (trim), identificador (trim) e moeda (maiúscula)', () => {
    const payload = toSupportPlanRequest({ ...valoresValidos, nome: '  Support Pro  ' })
    expect(payload.nome).toBe('Support Pro')
    expect(payload.hubspotValor).toBe('plano_pro')
    expect(payload.moeda).toBe('BRL')
  })

  it('aceita horas com vírgula digitadas em pt-BR', () => {
    const payload = toSupportPlanRequest({ ...valoresValidos, horasMes: '7,5' })
    expect(payload.horasMes).toBe(7.5)
  })
})
