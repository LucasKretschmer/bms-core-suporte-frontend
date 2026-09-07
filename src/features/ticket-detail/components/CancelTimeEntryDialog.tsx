/**
 * 125/FE-A11Y-3 (`A-1`) — o `placeholder` do campo de motivo era
 * `placeholder:text-foreground/40` = **2,34:1** sobre o fundo do campo (`bg-card`,
 * #ffffff). Placeholder é TEXTO para a WCAG 1.4.3 e vale 4,5:1; `/70` mede **5,47:1**.
 * Ele não aparece na varredura de contraste do DOM (não existe nó de texto para o
 * pseudo-elemento em jsdom), por isso a medição está travada por aritmética sobre os
 * tokens do CSS, no teste desta unidade.
 */
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import {
  CANCEL_REASON_MAX,
  cancelTimeEntrySchema,
  type CancelTimeEntryFormValues,
} from '../types/cancelTimeEntrySchema'

type CancelTimeEntryDialogProps = {
  isOpen: boolean
  /** Rótulo do apontamento que será cancelado (ex.: atendente + horário). */
  entryLabel?: string
  /**
   * true quando o apontamento tem tempo consolidado (totalSeconds > 0) — muda o
   * resultado da ação para DISCARDED em vez de CANCELLED (120/D-1) e o texto do
   * diálogo. Default false preserva o comportamento atual (cancelamento simples).
   */
  hasConsolidatedTime?: boolean
  /** Estado de submit em andamento — desabilita os controles e mostra loading. */
  isSubmitting?: boolean
  /** Erro retornado pela API (ex.: 409/403) — exibido inline acima dos botões. */
  apiError?: string | null
  /** Recebe o motivo validado ao confirmar o cancelamento/descarte. */
  onConfirm: (reason: string) => void
  onClose: () => void
}

/**
 * Diálogo de cancelamento/descarte de apontamento com MOTIVO OBRIGATÓRIO (099/120).
 *
 * RHF + Zod (schema é a fonte da verdade para UX; o backend revalida e audita).
 * Motivo via textarea obrigatório (mín. 10 chars) com erro inline; botões
 * Voltar / Confirmar cancelamento|descarte. Submit desabilitado durante o envio.
 * Ao contrário do antigo "excluir", a ação é reversível (Restaurar por gestor).
 *
 * 120/D-1: quando `hasConsolidatedTime=true`, o mesmo endpoint/mutation resulta
 * em DISCARDED no servidor (tempo preservado, não fatura) em vez de CANCELLED —
 * só o texto/título/botão do diálogo mudam; o schema Zod do motivo é o mesmo.
 */
export function CancelTimeEntryDialog({
  isOpen,
  entryLabel,
  hasConsolidatedTime = false,
  isSubmitting = false,
  apiError = null,
  onConfirm,
  onClose,
}: CancelTimeEntryDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelTimeEntryFormValues>({
    resolver: zodResolver(cancelTimeEntrySchema),
    defaultValues: { reason: '' },
  })

  // Reseta o campo a cada abertura para não vazar motivo de um cancelamento anterior.
  useEffect(() => {
    if (isOpen) reset({ reason: '' })
  }, [isOpen, reset])

  const onValid = (values: CancelTimeEntryFormValues) => {
    onConfirm(values.reason.trim())
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={hasConsolidatedTime ? 'Descartar apontamento' : 'Cancelar apontamento'}
    >
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5">
        <p className="-mt-1 text-sm text-foreground/70">
          {hasConsolidatedTime
            ? 'Este apontamento tem tempo registrado. Ao confirmar, ele será marcado como Descartado: o tempo é preservado e continua visível no histórico, mas deixa de contar no tempo total e no faturamento. Pode ser restaurado por um gestor a qualquer momento.'
            : 'O tempo deixa de contar nas somas e ficará registrado na auditoria. Pode ser restaurado por um gestor.'}
          {entryLabel ? ` (${entryLabel})` : ''}
        </p>

        <div className="flex flex-col space-y-0.5">
          <label htmlFor="cancel-reason" className="text-xs lg:text-sm font-normal text-foreground">
            {hasConsolidatedTime ? '* Motivo do descarte' : '* Motivo do cancelamento'}
          </label>
          <textarea
            id="cancel-reason"
            autoFocus
            aria-required="true"
            aria-invalid={errors.reason ? 'true' : undefined}
            aria-describedby={errors.reason ? 'cancel-reason-error' : undefined}
            maxLength={CANCEL_REASON_MAX}
            disabled={isSubmitting}
            placeholder={
              hasConsolidatedTime
                ? 'Descreva por que este apontamento está sendo descartado.'
                : 'Descreva por que este apontamento está sendo cancelado.'
            }
            {...register('reason')}
            className="h-20 rounded-input border border-border px-3 py-2 text-sm bg-card text-foreground placeholder:text-foreground/70 outline-none focus:border-primary-medium resize-none disabled:opacity-50"
          />
          {errors.reason?.message && (
            <p id="cancel-reason-error" className="text-xs text-error-fg" role="alert">
              {errors.reason.message}
            </p>
          )}
        </div>

        {apiError && (
          <p className="text-sm text-error-fg" role="alert">
            {apiError}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Voltar
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="bg-error-fg border-error-fg"
          >
            {hasConsolidatedTime ? 'Confirmar descarte' : 'Confirmar cancelamento'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
