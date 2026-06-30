import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import {
  DELETE_REASON_MAX,
  deleteTimeEntrySchema,
  type DeleteTimeEntryFormValues,
} from '../types/deleteTimeEntrySchema'

type DeleteTimeEntryDialogProps = {
  isOpen: boolean
  /** Rótulo do apontamento que será excluído (ex.: atendente + horário). */
  entryLabel?: string
  /** Estado de submit em andamento — desabilita os controles e mostra loading. */
  isSubmitting?: boolean
  /** Erro retornado pela API (ex.: 422/403) — exibido inline acima dos botões. */
  apiError?: string | null
  /** Recebe o motivo validado ao confirmar a exclusão. */
  onConfirm: (reason: string) => void
  onClose: () => void
}

/**
 * Diálogo de exclusão de apontamento com MOTIVO OBRIGATÓRIO (047).
 *
 * RHF + Zod (schema é a fonte da verdade para UX; o backend revalida e audita).
 * Motivo via textarea obrigatório (mín. 5 chars) com erro inline; botões
 * Cancelar / Confirmar exclusão. Submit desabilitado durante o envio.
 */
export function DeleteTimeEntryDialog({
  isOpen,
  entryLabel,
  isSubmitting = false,
  apiError = null,
  onConfirm,
  onClose,
}: DeleteTimeEntryDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DeleteTimeEntryFormValues>({
    resolver: zodResolver(deleteTimeEntrySchema),
    defaultValues: { reason: '' },
  })

  // Reseta o campo a cada abertura para não vazar motivo de uma exclusão anterior.
  useEffect(() => {
    if (isOpen) reset({ reason: '' })
  }, [isOpen, reset])

  const onValid = (values: DeleteTimeEntryFormValues) => {
    onConfirm(values.reason.trim())
  }

  if (!isOpen) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" title="Excluir apontamento">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5">
        <p className="-mt-1 text-sm text-foreground/70">
          Esta ação não pode ser desfeita e ficará registrada na auditoria.
          {entryLabel ? ` (${entryLabel})` : ''}
        </p>

        <div className="flex flex-col space-y-0.5">
          <label htmlFor="delete-reason" className="text-xs lg:text-sm font-normal text-foreground">
            * Motivo da exclusão
          </label>
          <textarea
            id="delete-reason"
            autoFocus
            aria-required="true"
            aria-invalid={errors.reason ? 'true' : undefined}
            aria-describedby={errors.reason ? 'delete-reason-error' : undefined}
            maxLength={DELETE_REASON_MAX}
            disabled={isSubmitting}
            placeholder="Descreva por que este apontamento está sendo excluído."
            {...register('reason')}
            className="h-20 rounded-[5px] border border-border px-3 py-2 text-sm bg-card text-foreground placeholder:text-foreground/40 outline-none focus:border-[#666] resize-none disabled:opacity-50"
          />
          {errors.reason?.message && (
            <p id="delete-reason-error" className="text-xs text-error-fg" role="alert">
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
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="bg-error-fg border-error-fg"
          >
            Confirmar exclusão
          </Button>
        </div>
      </form>
    </Modal>
  )
}
