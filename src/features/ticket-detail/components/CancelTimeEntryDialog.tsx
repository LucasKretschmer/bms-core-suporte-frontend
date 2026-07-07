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
  /** Estado de submit em andamento — desabilita os controles e mostra loading. */
  isSubmitting?: boolean
  /** Erro retornado pela API (ex.: 409/403) — exibido inline acima dos botões. */
  apiError?: string | null
  /** Recebe o motivo validado ao confirmar o cancelamento. */
  onConfirm: (reason: string) => void
  onClose: () => void
}

/**
 * Diálogo de cancelamento de apontamento com MOTIVO OBRIGATÓRIO (099).
 *
 * RHF + Zod (schema é a fonte da verdade para UX; o backend revalida e audita).
 * Motivo via textarea obrigatório (mín. 10 chars) com erro inline; botões
 * Cancelar / Confirmar cancelamento. Submit desabilitado durante o envio.
 * Ao contrário do antigo "excluir", o cancelamento é reversível (Restaurar por gestor).
 */
export function CancelTimeEntryDialog({
  isOpen,
  entryLabel,
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
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Cancelar apontamento">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5">
        <p className="-mt-1 text-sm text-foreground/70">
          O tempo deixa de contar nas somas e ficará registrado na auditoria. Pode ser
          restaurado por um gestor.
          {entryLabel ? ` (${entryLabel})` : ''}
        </p>

        <div className="flex flex-col space-y-0.5">
          <label htmlFor="cancel-reason" className="text-xs lg:text-sm font-normal text-foreground">
            * Motivo do cancelamento
          </label>
          <textarea
            id="cancel-reason"
            autoFocus
            aria-required="true"
            aria-invalid={errors.reason ? 'true' : undefined}
            aria-describedby={errors.reason ? 'cancel-reason-error' : undefined}
            maxLength={CANCEL_REASON_MAX}
            disabled={isSubmitting}
            placeholder="Descreva por que este apontamento está sendo cancelado."
            {...register('reason')}
            className="h-20 rounded-input border border-border px-3 py-2 text-sm bg-card text-foreground placeholder:text-foreground/40 outline-none focus:border-primary-medium resize-none disabled:opacity-50"
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
            Confirmar cancelamento
          </Button>
        </div>
      </form>
    </Modal>
  )
}
