import { z } from 'zod'

/**
 * DTO de categoria de atendimento — espelha o backend (B4).
 * GET /api/v1/service-categories?includeInactive=true → ApiResponse<ServiceCategoryDto[]>
 */
export type ServiceCategoryDto = {
  id: number
  nome: string
  isActive: boolean
  /**
   * 133 — quando `true`, o backend força `billableOutsidePlan = true` em toda escrita de
   * apontamento com esta categoria (R-133).
   *
   * **OPCIONAL de propósito:** um backend anterior à 133 não envia a chave, e
   * *ausente* ≠ *`false` declarado pelo servidor* (`AP-FRONTEND-021`). Entre dois deploys
   * o cliente novo conversa com o backend velho; a direção segura do default é
   * **ausente → não força**. Pode virar obrigatório quando a 133 estiver em produção nos
   * três ambientes — e nesse dia `forcaCobrancaForaDoPlano` continua valendo.
   *
   * Nunca ler esta propriedade solta: use sempre `forcaCobrancaForaDoPlano`.
   */
  forcesBillableOutsidePlan?: boolean
}

/**
 * 133 — leitura única da flag em todo o painel (`AP-FRONTEND-028`: o mesmo campo é
 * consumido em quatro lugares independentes — coluna, modal, form de criação e **export**;
 * corrigir "o" lugar corrige um).
 *
 * `=== true` cobre os três modos de ausência que o campo pode assumir vindo da rede —
 * `undefined` (chave omitida), `null` (serializador do outro lado) e o próprio objeto
 * nulo — sem colapsar "não sei" em "sim". O teste cobre `null` EXPLÍCITO: um teste só com
 * `undefined` passaria também numa implementação `!== false` e não discriminaria.
 */
export function forcaCobrancaForaDoPlano(
  categoria: { forcesBillableOutsidePlan?: boolean | null } | null | undefined,
): boolean {
  return categoria?.forcesBillableOutsidePlan === true
}

/**
 * 133 — vocabulário da flag exibido ao usuário. **Uma fonte só** para a coluna da tabela
 * e para o **export** (`AP-FRONTEND-028`: o mesmo campo é consumido em quatro lugares
 * independentes, e o export é o mais grave — tela errada o gestor recarrega, planilha
 * errada ele encaminha, e o valor sai do sistema sem rastreabilidade).
 *
 * `'Não'` em vez de `'—'`: travessão é lido de forma inconsistente por leitor de tela e
 * não sobrevive bem à planilha.
 */
export function rotuloCobrancaForaDoPlano(
  categoria: { forcesBillableOutsidePlan?: boolean | null } | null | undefined,
): 'Sempre' | 'Não' {
  return forcaCobrancaForaDoPlano(categoria) ? 'Sempre' : 'Não'
}

/**
 * Limite de caracteres do nome — **espelha o backend, que é a fonte de verdade**:
 * - `CreateServiceCategoryValidator` / `UpdateServiceCategoryValidator`
 *   (`Suporte.Application/Validators/Config/ServiceCategoryValidators.cs:13,24`) → `MaximumLength(255)`;
 * - coluna `suporte.servicecategories.nome`
 *   (`Suporte.Infrastructure/Configurations/ServiceCategoriesConfiguration.cs:21`) → `HasMaxLength(255)`.
 *
 * 123/FE-2: o front usava **120** — mais restritivo que o back, sem regra que o
 * sustentasse. Divergência resolvida a favor do backend. A constante existe para que a
 * mensagem exibida ao usuário venha da MESMA fonte do número validado (AP-FRONTEND-022):
 * mudar o limite aqui muda schema e texto juntos.
 */
export const MAX_CATEGORY_NAME_LENGTH = 255

/** Campo `nome` — compartilhado por criação e edição (mesma regra no backend). */
const categoryNameField = z
  .string()
  .trim()
  .min(1, 'Informe o nome da categoria.')
  .max(
    MAX_CATEGORY_NAME_LENGTH,
    `O nome deve ter no máximo ${MAX_CATEGORY_NAME_LENGTH} caracteres.`,
  )

/**
 * Campo da flag de cobrança obrigatória fora do plano (133).
 *
 * `z.boolean()` **não-opcional**: no formulário a flag é sempre um booleano concreto
 * (o switch tem estado), e é isso que garante que o `PUT` leve o valor **explícito**.
 * O `bool?` do servidor ("null = não alterar", `arquitetura.md` §6.1) é rede de proteção
 * contra clientes que OMITEM o campo — não é licença para o painel omitir.
 */
const forcaField = z.boolean()

/** Schema do campo "Nova categoria" — fonte da verdade da validação (UX). */
export const newCategorySchema = z.object({
  nome: categoryNameField,
  forcesBillableOutsidePlan: forcaField,
})

/**
 * Schema da edição (renomear) — mesmo shape da criação porque o backend usa o MESMO
 * validator para os dois (`Create`/`UpdateServiceCategoryValidator` são idênticos).
 * Existe separado para que uma divergência futura no backend tenha onde pousar.
 */
export const editCategorySchema = z.object({
  nome: categoryNameField,
  forcesBillableOutsidePlan: forcaField,
})

export type NewCategoryFormValues = z.infer<typeof newCategorySchema>
export type EditCategoryFormValues = z.infer<typeof editCategorySchema>
