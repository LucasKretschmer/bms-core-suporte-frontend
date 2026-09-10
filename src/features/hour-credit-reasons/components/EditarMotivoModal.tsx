import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { getHourCreditReasonErrorMessage } from '../utils/hourCreditReasonErrorMessage'
import {
  editarMotivoSchema,
  type EditarMotivoFormValues,
  type HourCreditReasonDto,
} from '../types/hourCreditReason'

type EditarMotivoModalProps = {
  /** Motivo em edição — `null` mantém o modal fechado. */
  motivo: HourCreditReasonDto | null
  /**
   * Salva e **rejeita** em caso de falha (use `mutateAsync`). A rejeição é o que mantém o
   * modal aberto com o erro inline — sem ela o `409` fecharia o modal como se tivesse dado
   * certo.
   */
  onSave: (motivo: HourCreditReasonDto, values: EditarMotivoFormValues) => Promise<unknown>
  onClose: () => void
}

/**
 * Modal de renomear motivo (132/F6). RHF + Zod; o backend é a fonte definitiva.
 *
 * A reidratação (abrir a linha B depois da linha A) é **estrutural**: o formulário vive num
 * componente interno remontado por `key={motivo.id}`, então `defaultValues` e o erro de API
 * nascem certos — mesmo desenho de `EditCategoryModal`, que registra por que um `useEffect`
 * com `reset()` seria pior.
 */
export function EditarMotivoModal({ motivo, onSave, onClose }: EditarMotivoModalProps) {
  if (!motivo) return null
  return <EditarMotivoForm key={motivo.id} motivo={motivo} onSave={onSave} onClose={onClose} />
}

type EditarMotivoFormProps = {
  motivo: HourCreditReasonDto
  onSave: (motivo: HourCreditReasonDto, values: EditarMotivoFormValues) => Promise<unknown>
  onClose: () => void
}

function EditarMotivoForm({ motivo, onSave, onClose }: EditarMotivoFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditarMotivoFormValues>({
    resolver: zodResolver(editarMotivoSchema),
    defaultValues: { nome: motivo.nome },
  })

  async function onValid(values: EditarMotivoFormValues) {
    setApiError(null)
    try {
      await onSave(motivo, values)
      onClose()
    } catch (error) {
      setApiError(getHourCreditReasonErrorMessage(error))
    }
  }

  return (
    <Modal isOpen onClose={onClose} size="sm" title="Editar motivo de crédito">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <Input
          id="editar-motivo-nome"
          label="Nome do motivo"
          required
          autoComplete="off"
          error={errors.nome?.message}
          {...register('nome')}
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
