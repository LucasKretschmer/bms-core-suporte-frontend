import { describe, expect, it } from 'vitest'
import {
  editCategorySchema,
  forcaCobrancaForaDoPlano,
  MAX_CATEGORY_NAME_LENGTH,
  newCategorySchema,
  rotuloCobrancaForaDoPlano,
} from './serviceCategory'

/**
 * 123/FE-2 — o limite era **120** aqui e **255** no backend
 * (`ServiceCategoryValidators.cs:13,24` + coluna `nome` `HasMaxLength(255)`).
 * A divergência foi resolvida a favor do backend, que é a fonte de verdade; estes testes
 * travam o novo limite nas DUAS pontas (aceita 255, recusa 256) — asserção só do lado que
 * recusa passaria também com o limite antigo.
 */
describe('limite de caracteres alinhado ao backend', () => {
  it('a constante vale 255 — o mesmo MaximumLength do validator e da coluna', () => {
    expect(MAX_CATEGORY_NAME_LENGTH).toBe(255)
  })

  it('aceita exatamente 255 caracteres (o limite antigo de 120 reprovaria aqui)', () => {
    expect(newCategorySchema.safeParse({ nome: 'a'.repeat(255), forcesBillableOutsidePlan: false }).success).toBe(true)
  })

  it('recusa 256 caracteres', () => {
    const r = newCategorySchema.safeParse({ nome: 'a'.repeat(256), forcesBillableOutsidePlan: false })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0].message).toBe('O nome deve ter no máximo 255 caracteres.')
  })

  it('a mensagem cita o MESMO número da constante (texto e regra da mesma fonte)', () => {
    const r = newCategorySchema.safeParse({
      nome: 'a'.repeat(MAX_CATEGORY_NAME_LENGTH + 1),
      forcesBillableOutsidePlan: false,
    })
    expect(r.success).toBe(false)
    if (!r.success)
      expect(r.error.issues[0].message).toContain(String(MAX_CATEGORY_NAME_LENGTH))
  })
})

describe('newCategorySchema', () => {
  it('rejeita nome vazio', () => {
    const r = newCategorySchema.safeParse({ nome: '', forcesBillableOutsidePlan: false })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Informe o nome da categoria.')
  })

  it('rejeita nome só com espaços', () => {
    const r = newCategorySchema.safeParse({ nome: '   ', forcesBillableOutsidePlan: false })
    expect(r.success).toBe(false)
  })

  it('aceita nome válido e aplica trim', () => {
    const r = newCategorySchema.safeParse({ nome: '  Consultoria  ', forcesBillableOutsidePlan: false })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.nome).toBe('Consultoria')
  })
})

describe('editCategorySchema (renomear)', () => {
  it('rejeita nome vazio com a mesma mensagem da criação', () => {
    const r = editCategorySchema.safeParse({ nome: '   ', forcesBillableOutsidePlan: false })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].message).toBe('Informe o nome da categoria.')
  })

  it('aplica trim — o PUT nunca leva espaço nas pontas', () => {
    const r = editCategorySchema.safeParse({ nome: '  Plantão  ', forcesBillableOutsidePlan: false })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.nome).toBe('Plantão')
  })

  it('usa o mesmo limite da criação (o backend usa o mesmo validator para os dois)', () => {
    expect(editCategorySchema.safeParse({ nome: 'a'.repeat(255), forcesBillableOutsidePlan: false }).success).toBe(true)
    expect(editCategorySchema.safeParse({ nome: 'a'.repeat(256), forcesBillableOutsidePlan: false }).success).toBe(false)
  })
})

/**
 * 133 — o guard da flag. `AP-FRONTEND-028`: o campo atravessa a REDE, então `null` e
 * chave ausente são o mesmo fato para quem consome, e o teste precisa cobrir os dois.
 * Um teste só com `undefined` passaria também numa implementação `!== false` e **não
 * discriminaria** — é o caso `null` explícito abaixo que reprova esse guard errado.
 */
describe('forcaCobrancaForaDoPlano (133)', () => {
  it('true declarado pelo servidor → força', () => {
    // Companheira positiva das asserções negativas abaixo: prova que o ponto observado é
    // alcançável e que a função não devolve `false` para tudo.
    expect(forcaCobrancaForaDoPlano({ forcesBillableOutsidePlan: true })).toBe(true)
  })

  it('false declarado pelo servidor → não força', () => {
    expect(forcaCobrancaForaDoPlano({ forcesBillableOutsidePlan: false })).toBe(false)
  })

  it('chave AUSENTE (backend anterior à 133) → não força, e não é erro', () => {
    // Vermelho se alguém escrever `!== false` ou tratar ausência como erro: entre dois
    // deploys o cliente novo conversa com o backend velho (`AP-FRONTEND-021`).
    expect(forcaCobrancaForaDoPlano({})).toBe(false)
  })

  it('null EXPLÍCITO na chave → não força', () => {
    // Vermelho num guard `=== undefined`/`!== false`. É este caso — e não o `undefined` —
    // que discrimina as duas implementações.
    expect(forcaCobrancaForaDoPlano({ forcesBillableOutsidePlan: null })).toBe(false)
  })

  it('categoria null/undefined → não força, sem lançar', () => {
    expect(forcaCobrancaForaDoPlano(null)).toBe(false)
    expect(forcaCobrancaForaDoPlano(undefined)).toBe(false)
  })
})

describe('rotuloCobrancaForaDoPlano (133) — mesmo vocabulário na tabela e no export', () => {
  it('força → "Sempre"; não força → "Não" (literais escritos à mão)', () => {
    expect(rotuloCobrancaForaDoPlano({ forcesBillableOutsidePlan: true })).toBe('Sempre')
    expect(rotuloCobrancaForaDoPlano({ forcesBillableOutsidePlan: false })).toBe('Não')
  })

  it('ausente e null explícito também rotulam "Não" — nunca vazio nem "undefined"', () => {
    // Vermelho se o rótulo passar a ser interpolação crua do campo (`${row.flag}`), que
    // imprimiria "undefined"/"null" na planilha que o gestor encaminha.
    expect(rotuloCobrancaForaDoPlano({})).toBe('Não')
    expect(rotuloCobrancaForaDoPlano({ forcesBillableOutsidePlan: null })).toBe('Não')
  })
})

describe('schemas — a flag é campo do formulário, sempre booleano concreto (133)', () => {
  it('newCategorySchema devolve a flag no data (é ela que vai explícita no POST)', () => {
    const r = newCategorySchema.safeParse({ nome: 'Consultoria', forcesBillableOutsidePlan: true })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.forcesBillableOutsidePlan).toBe(true)
  })

  it('newCategorySchema devolve `false` como VALOR, não como ausência', () => {
    // Vermelho se o campo virar `.optional()`: `data` sairia sem a chave e o body do POST
    // seria montado sem ela.
    const r = newCategorySchema.safeParse({ nome: 'Suporte', forcesBillableOutsidePlan: false })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toHaveProperty('forcesBillableOutsidePlan', false)
  })

  it('editCategorySchema RECUSA o objeto sem a flag — omitir não é uma opção do form', () => {
    // É esta asserção que impede o form de edição de voltar a mandar só o nome (o
    // servidor leria "não alterar" e a flag ficaria congelada em silêncio).
    expect(editCategorySchema.safeParse({ nome: 'Consultoria' }).success).toBe(false)
  })

  it('editCategorySchema aceita a flag nos dois valores', () => {
    expect(
      editCategorySchema.safeParse({ nome: 'Consultoria', forcesBillableOutsidePlan: true }).success,
    ).toBe(true)
    expect(
      editCategorySchema.safeParse({ nome: 'Consultoria', forcesBillableOutsidePlan: false })
        .success,
    ).toBe(true)
  })
})
