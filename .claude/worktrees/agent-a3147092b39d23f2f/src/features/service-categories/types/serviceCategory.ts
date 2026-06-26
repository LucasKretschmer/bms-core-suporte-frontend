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

/** Schema do campo "Nova categoria" — fonte da verdade da validação (UX). */
export const newCategorySchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, 'Informe o nome da categoria.')
    .max(120, 'O nome deve ter no máximo 120 caracteres.'),
})

export type NewCategoryFormValues = z.infer<typeof newCategorySchema>
