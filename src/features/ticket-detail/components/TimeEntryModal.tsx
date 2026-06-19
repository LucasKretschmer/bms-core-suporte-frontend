import { useEffect, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Combobox, type ComboboxOption } from '../../../components/ui/Combobox'
import { Switch } from '../../../components/ui/Switch'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../components/ui/Toast'
import { handleApiError } from '../../../utils/handleApiError'
import { timeEntrySchema, type TimeEntryFormValues } from '../types/timeEntrySchema'
import { isoToLocalInput } from '../utils/dateConvert'
import { useTimeEntryMutations } from '../hooks/useTimeEntryMutations'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

type TimeEntryModalProps = {
  isOpen: boolean
  mode: 'create' | 'edit'
  ticketId: string
  ticketLabel: string
  entry?: TicketTimeEntryDto
  agentOptions: ComboboxOption[]
  categoryOptions: ComboboxOption[]
  optionsLoading?: boolean
  /** Pode trocar o atendente (Coordenador+); atendente comum só lança para si */
  canChangeAgent: boolean
  /** userId do usuário logado — default do atendente em modo create */
  currentUserId: string
  /** Pode excluir o apontamento (ownership/role) */
  canDelete: boolean
  onClose: () => void
  onSubmitted: () => void
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

/** Monta os valores iniciais do form (modo create vs edit). */
function buildDefaults(
  mode: 'create' | 'edit',
  currentUserId: string,
  entry?: TicketTimeEntryDto,
): TimeEntryFormValues {
  if (mode === 'edit' && entry) {
    const works = entry.segments
      .filter((s) => s.type === 'WORK')
      .map((s) => ({
        start: isoToLocalInput(s.segmentStart),
        end: isoToLocalInput(s.segmentEnd),
      }))
    return {
      userId: entry.userId,
      serviceCategoryId: entry.serviceCategoryId ?? '',
      billableOutsidePlan: entry.billableOutsidePlan,
      note: entry.note ?? '',
      works: works.length > 0 ? works : [{ start: '', end: '' }],
    }
  }
  return {
    userId: currentUserId,
    serviceCategoryId: '',
    billableOutsidePlan: false,
    note: '',
    works: [{ start: '', end: '' }],
  }
}

/**
 * Modal de criar/editar apontamento (F4). RHF + Zod (schema é a fonte de verdade
 * para UX; backend é a fonte definitiva). Blocos WORK múltiplos (useFieldArray),
 * pausa calculada no backend. Conversão datetime-local → ISO Z no submit (R3).
 */
export function TimeEntryModal({
  isOpen,
  mode,
  ticketId,
  ticketLabel,
  entry,
  agentOptions,
  categoryOptions,
  optionsLoading = false,
  canChangeAgent,
  currentUserId,
  canDelete,
  onClose,
  onSubmitted,
}: TimeEntryModalProps) {
  const toast = useToast()
  const { create, update, remove } = useTimeEntryMutations(ticketId)
  const [apiError, setApiError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TimeEntryFormValues>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: buildDefaults(mode, currentUserId, entry),
  })

  const { fields, append, remove: removeBlock } = useFieldArray({ control, name: 'works' })

  // Reidrata o form a cada abertura / troca de entry.
  useEffect(() => {
    if (isOpen) {
      reset(buildDefaults(mode, currentUserId, entry))
      setApiError(null)
    }
  }, [isOpen, mode, entry, currentUserId, reset])

  const userId = watch('userId')
  const serviceCategoryId = watch('serviceCategoryId')
  const billableOutsidePlan = watch('billableOutsidePlan')

  function addBlock() {
    const works = getValues('works')
    const last = works[works.length - 1]
    // Pré-preenche o início com o fim do último (conveniência, ref protótipo L642).
    append({ start: last?.end || last?.start || '', end: '' })
  }

  const onValid = async (values: TimeEntryFormValues) => {
    setApiError(null)
    try {
      if (mode === 'create') {
        await create.mutateAsync(values)
        toast.success('Apontamento adicionado.')
      } else if (entry) {
        await update.mutateAsync({ id: entry.id, values })
        toast.success('Lançamento atualizado — tempo recalculado.')
      }
      onSubmitted()
      onClose()
    } catch (err) {
      const msg = handleApiError(err)
      setApiError(msg)
      toast.error(msg)
    }
  }

  async function handleDelete() {
    if (!entry) return
    try {
      await remove.mutateAsync(entry.id)
      toast.success('Apontamento removido.')
      setConfirmDelete(false)
      onSubmitted()
      onClose()
    } catch (err) {
      const msg = handleApiError(err)
      setApiError(msg)
      toast.error(msg)
      setConfirmDelete(false)
    }
  }

  if (!isOpen) return null

  const worksError = typeof errors.works?.message === 'string' ? errors.works.message : null

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        title={mode === 'create' ? 'Adicionar apontamento' : 'Editar lançamento'}
      >
        <p className="-mt-2 mb-4 text-sm text-foreground/50">{ticketLabel}</p>

        <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Combobox
              label="Atendente"
              id="te-agent"
              required
              value={userId || null}
              options={agentOptions}
              onChange={(v) => setValue('userId', v, { shouldValidate: true })}
              disabled={!canChangeAgent || optionsLoading}
              placeholder={optionsLoading ? 'Carregando…' : 'Selecione…'}
              error={errors.userId?.message}
            />
            <Combobox
              label="Categorização do atendimento"
              id="te-category"
              required
              value={serviceCategoryId || null}
              options={categoryOptions}
              onChange={(v) => setValue('serviceCategoryId', v, { shouldValidate: true })}
              disabled={optionsLoading}
              placeholder={optionsLoading ? 'Carregando…' : 'Selecione…'}
              error={errors.serviceCategoryId?.message}
            />
          </div>

          {/* Toggle cobrar por fora */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Cobrar por fora do plano</p>
              <p className="text-xs text-foreground/50">
                Marca este apontamento como faturável fora do plano (consultoria, treinamento, etc.).
              </p>
            </div>
            <Switch
              label="Cobrar por fora do plano"
              checked={billableOutsidePlan}
              onChange={(checked) => setValue('billableOutsidePlan', checked)}
            />
          </div>

          <p className="text-xs text-foreground/50">
            Edite os horários ou adicione um apontamento. A ordem é resolvida pelos horários e as pausas
            entre apontamentos são calculadas automaticamente; o tempo total soma apenas os apontamentos.
          </p>

          {/* Blocos de trabalho */}
          <div className="flex flex-col gap-2">
            {fields.map((field, index) => {
              const blockErrors = errors.works?.[index]
              return (
                <fieldset key={field.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <legend className="text-xs text-foreground/50">Apontamento {index + 1}</legend>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBlock(index)}
                        aria-label={`Remover apontamento ${index + 1}`}
                        className="inline-flex items-center gap-1 text-xs text-error-fg hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <TrashIcon />
                        remover
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col space-y-0.5">
                      <label htmlFor={`works-${index}-start`} className="text-xs text-foreground/50">
                        Início
                      </label>
                      <input
                        id={`works-${index}-start`}
                        type="datetime-local"
                        {...register(`works.${index}.start`)}
                        className="h-9 rounded-[5px] border border-border px-3 text-sm bg-card text-foreground outline-none focus:border-[#666]"
                      />
                      {blockErrors?.start?.message && (
                        <p className="text-xs text-error-fg" role="alert">
                          {blockErrors.start.message}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col space-y-0.5">
                      <label htmlFor={`works-${index}-end`} className="text-xs text-foreground/50">
                        Fim
                      </label>
                      <input
                        id={`works-${index}-end`}
                        type="datetime-local"
                        {...register(`works.${index}.end`)}
                        className="h-9 rounded-[5px] border border-border px-3 text-sm bg-card text-foreground outline-none focus:border-[#666]"
                      />
                      {blockErrors?.end?.message && (
                        <p className="text-xs text-error-fg" role="alert">
                          {blockErrors.end.message}
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>
              )
            })}

            {worksError && (
              <p className="text-xs text-error-fg" role="alert">
                {worksError}
              </p>
            )}

            <button
              type="button"
              onClick={addBlock}
              className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-[5px] border border-dashed border-border text-sm text-foreground transition-shadow duration-150 hover:shadow-[0_1px_3px_1px_rgba(0,0,0,0.15)] focus-visible:ring-2 focus-visible:ring-primary"
            >
              <PlusIcon />
              Adicionar apontamento
            </button>
          </div>

          {/* Observação */}
          <div className="flex flex-col space-y-0.5">
            <label htmlFor="te-note" className="text-xs lg:text-sm font-normal text-foreground">
              Observação (opcional)
            </label>
            <textarea
              id="te-note"
              {...register('note')}
              className="h-20 rounded-[5px] border border-border px-3 py-2 text-sm bg-card text-foreground placeholder:text-foreground/40 outline-none focus:border-[#666] resize-none"
            />
            {errors.note?.message && (
              <p className="text-xs text-error-fg" role="alert">
                {errors.note.message}
              </p>
            )}
          </div>

          {apiError && (
            <p className="text-sm text-error-fg" role="alert">
              {apiError}
            </p>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div>
              {mode === 'edit' && canDelete && (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="text-error-fg"
                  icon={<TrashIcon />}
                >
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
                {mode === 'create' ? 'Adicionar' : 'Salvar'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Excluir apontamento"
        description="Excluir este apontamento? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={remove.isPending}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  )
}
