import { z } from 'zod'

/**
 * DTO de categoria de atendimento — espelha o backend (B4).
 * GET /api/v1/service-categories?includeInactive=true → ApiResponse<ServiceCategoryDto[]>
 */
export type ServiceCategoryDto = {
  id: number
  nome: string
  isActive: boolean
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

/** Schema do campo "Nova categoria" — fonte da verdade da validação (UX). */
export const newCategorySchema = z.object({ nome: categoryNameField })

/**
 * Schema da edição (renomear) — mesmo shape da criação porque o backend usa o MESMO
 * validator para os dois (`Create`/`UpdateServiceCategoryValidator` são idênticos).
 * Existe separado para que uma divergência futura no backend tenha onde pousar.
 */
export const editCategorySchema = z.object({ nome: categoryNameField })

export type NewCategoryFormValues = z.infer<typeof newCategorySchema>
export type EditCategoryFormValues = z.infer<typeof editCategorySchema>
