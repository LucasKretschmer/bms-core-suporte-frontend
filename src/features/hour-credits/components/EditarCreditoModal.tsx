import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { MotivoCombobox } from './MotivoCombobox'
import { getHourCreditErrorMessage } from '../utils/hourCreditErrorMessage'
import {
  editarCreditoSchema,
  type EditarCreditoFormInput,
  type EditarCreditoFormValues,
  type HourCreditDto,
} from '../types/hourCredit'

type EditarCreditoModalProps = {
  /** Crédito em edição — `null` mantém o modal fechado. */
  credito: HourCreditDto | null
  /** Salva e **rejeita** em caso de falha (use `mutateAsync`) — a rejeição mantém o modal aberto. */
  onSave: (credito: HourCreditDto, values: EditarCreditoFormValues) => Promise<unknown>
  onClose: () => void
}

/**
 * Modal de edição do crédito (132/F5) — **só horas e motivo** (`arquitetura.md:920`).
 *
 * Não há campo de competência nem de validade: D8′ (crédito vale UMA competência, sem
 * estender e sem mover). Editar crédito **automático** é permitido (PRD §6.3) e o servidor
 * marca `editadomanualmente = true`, para a reconciliação não desfazer a edição depois.
 */
export function EditarCreditoModal({ credito, onSave, onClose }: EditarCreditoModalProps) {
  if (!credito) return null
  return <EditarCreditoForm key={credito.id} credito={credito} onSave={onSave} onClose={onClose} />
}

type EditarCreditoFormProps = {
  credito: HourCreditDto
  onSave: (credito: HourCreditDto, values: EditarCreditoFormValues) => Promise<unknown>
  onClose: () => void
}

function EditarCreditoForm({ credito, onSave, onClose }: EditarCreditoFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditarCreditoFormInput, unknown, EditarCreditoFormValues>({
    resolver: zodResolver(editarCreditoSchema),
    defaultValues: { horas: credito.horas, motivoId: credito.motivoId },
  })

  async function onValid(values: EditarCreditoFormValues) {
    setApiError(null)
    try {
      await onSave(credito, values)
      onClose()
    } catch (error) {
      setApiError(getHourCreditErrorMessage(error))
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="sm" title="Editar crédito">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <p className="text-sm text-foreground/70">
          Cliente: <span className="text-foreground">{credito.clienteNome ?? '—'}</span>
        </p>

        <Input
          id="editar-credito-horas"
          label="Horas"
          required
          type="number"
          step="0.25"
          min="0"
          inputMode="decimal"
          error={errors.horas?.message}
          {...register('horas')}
        />

        <Controller
          control={control}
          name="motivoId"
          render={({ field }) => (
            <MotivoCombobox
              id="editar-credito-motivo"
              required
              value={field.value == null ? null : Number(field.value)}
              onChange={(motivoId) => field.onChange(motivoId ?? undefined)}
              error={errors.motivoId?.message}
            />
          )}
        />

        {apiError && (
          <p className="text-sm text-error-fg" role="alert">
            {apiError}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  )
}
