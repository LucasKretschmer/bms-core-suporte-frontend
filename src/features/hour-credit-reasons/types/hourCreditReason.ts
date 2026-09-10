import { z } from 'zod'

/**
 * DTO de motivo de crédito de horas — demanda 132/F6.
 *
 * Contrato: `GET /api/v1/hour-credit-reasons?includeInactive=false`
 * → `ApiResponse<HourCreditReasonDto[]>` (`arquitetura.md:880-884`, `analise-backend.md` §7.3).
 * O backend desta demanda **ainda não existe** no momento em que este arquivo foi escrito
 * (não há `HourCreditReasonsController.cs` em `src/Suporte.API/Controllers`, verificado); o
 * tipo espelha o contrato congelado, não código medido — está no relatório da unidade.
 *
 * ## Por que `isActive` e `isSistema` são OPCIONAIS e NULÁVEIS
 *
 * `AP-FRONTEND-028`: campo que atravessa a rede tem **três** modos de ausência — chave
 * omitida (backend anterior ao campo), `null` (serializador do outro lado) e valor
 * declarado. Declará-los obrigatórios faria o compilador afirmar uma garantia que o wire
 * não dá, e o guard viraria `=== undefined` (que deixa `null` passar reto).
 * Nunca ler estas duas propriedades soltas: use `ehMotivoDeSistema` e
 * `rotuloSituacaoDoMotivo`.
 */
export type HourCreditReasonDto = {
  id: number
  nome: string
  isActive?: boolean | null
  isSistema?: boolean | null
}

/**
 * 🔴 Guard **fail-closed** do motivo semeado (`R-19`, `analise-frontend.md` §8).
 *
 * Só `isSistema === false` libera as ações destrutivas. Ausente, `null` ou `true` ⇒ o
 * motivo é tratado como **de sistema** e as ações ficam bloqueadas, porque o custo do erro
 * é assimétrico: excluir o motivo semeado faz o processo automático de crédito parar de
 * encontrá-lo (ele resolve o motivo **pela flag `sistema`, esperando exatamente 1** —
 * `arquitetura.md:886-889`), e a falha só aparece na virada da competência.
 *
 * Bloquear um motivo comum por engano custa um clique; liberar o semeado custa o crédito
 * automático do mês inteiro.
 */
export function ehMotivoDeSistema(
  motivo: { isSistema?: boolean | null } | null | undefined,
): boolean {
  return motivo?.isSistema !== false
}

/**
 * Situação exibida na tabela. `== null` ⇒ `'—'`, nunca `'Inativo'`: afirmar "inativo"
 * sobre um valor que o servidor não mandou é o defeito literal do `AP-FRONTEND-028`
 * (`entraNaFatura: null` renderizado como "Não").
 */
export function rotuloSituacaoDoMotivo(
  motivo: { isActive?: boolean | null } | null | undefined,
): 'Ativo' | 'Inativo' | '—' {
  const ativo = motivo?.isActive
  if (ativo == null) return '—'
  return ativo ? 'Ativo' : 'Inativo'
}

/**
 * Limite do nome — **espelha o banco, que é a fonte de verdade**:
 * `suporte.motivoscredito.nome` é `varchar(120)` com
 * `CHECK length(btrim(nome)) BETWEEN 1 AND 120`
 * (`MotivosCreditoConfiguration.cs:35-37,70-73`, medido no repositório do backend).
 *
 * A constante existe para que o número validado e o número exibido na mensagem venham da
 * MESMA fonte (`AP-FRONTEND-022`): mudar o limite aqui muda schema e texto juntos.
 */
export const MAX_NOME_MOTIVO = 120

const nomeDoMotivo = z
  .string()
  .trim()
  .min(1, 'Informe o nome do motivo.')
  .max(MAX_NOME_MOTIVO, `O nome deve ter no máximo ${MAX_NOME_MOTIVO} caracteres.`)

/** Schema do formulário de criação — fonte da verdade da validação de UX. */
export const novoMotivoSchema = z.object({ nome: nomeDoMotivo })

/**
 * Schema da edição. Mesmo shape da criação porque o backend usa a mesma regra nos dois
 * (`analise-backend.md` §7.3: `PUT { nome }`). Existe separado para que uma divergência
 * futura tenha onde pousar.
 */
export const editarMotivoSchema = z.object({ nome: nomeDoMotivo })

export type NovoMotivoFormValues = z.infer<typeof novoMotivoSchema>
export type EditarMotivoFormValues = z.infer<typeof editarMotivoSchema>
