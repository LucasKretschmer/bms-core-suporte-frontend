import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Switch } from '../../../components/ui/Switch'
import {
  calendarFormSchema,
  toCalendarFormValues,
  toCalendarRequest,
  type CalendarDto,
  type CalendarFormValues,
  type CalendarRequest,
} from '../types/calendar'
import { getCalendarErrorMessage } from '../utils/calendarErrorMessage'

type CalendarFormModalProps = {
  /** `null` = criação; preenchido = edição. */
  calendario: CalendarDto | null
  isOpen: boolean
  /** Quantos calendários ativos existem — usado no texto do campo "padrão". */
  totalDeCalendarios: number
  /**
   * Salva e **rejeita** em caso de falha (use `mutateAsync`). A rejeição é o que mantém
   * o modal aberto com o erro inline; sem ela um `409 CALENDAR_LAST_DEFAULT` fecharia o
   * modal como se tivesse dado certo.
   */
  onSave: (calendario: CalendarDto | null, payload: CalendarRequest) => Promise<unknown>
  onClose: () => void
}

/**
 * 124/F2 — formulário de calendário comercial (criar/editar), RHF + Zod.
 *
 * A reidratação entre calendários é **estrutural** (componente interno remontado por
 * `key`), mesmo padrão de `SupportPlanFormModal` e `EditCategoryModal`: `useEffect` +
 * `reset()` reprova em `react-hooks/set-state-in-effect` e depende de uma lista de
 * dependências que envelhece.
 */
export function CalendarFormModal({
  calendario,
  isOpen,
  totalDeCalendarios,
  onSave,
  onClose,
}: CalendarFormModalProps) {
  if (!isOpen) return null
  return (
    <CalendarForm
      key={calendario != null ? `calendario-${calendario.id}` : 'novo-calendario'}
      calendario={calendario}
      totalDeCalendarios={totalDeCalendarios}
      onSave={onSave}
      onClose={onClose}
    />
  )
}

type CalendarFormProps = Omit<CalendarFormModalProps, 'isOpen'>

function CalendarForm({
  calendario,
  totalDeCalendarios,
  onSave,
  onClose,
}: CalendarFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)
  const isEdicao = calendario != null

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CalendarFormValues>({
    resolver: zodResolver(calendarFormSchema),
    defaultValues: toCalendarFormValues(calendario),
  })

  const padrao = watch('padrao')
  const ignorarFeriados = watch('ignorarFeriados')

  async function onValid(values: CalendarFormValues) {
    setApiError(null)
    try {
      await onSave(calendario, toCalendarRequest(values))
      onClose()
    } catch (error) {
      setApiError(getCalendarErrorMessage(error))
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={isEdicao ? 'Editar calendário' : 'Novo calendário comercial'}
    >
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5" noValidate>
        <Input
          id="calendario-nome"
          label="Nome do calendário"
          required
          autoComplete="off"
          hint='Ex.: "Padrão", "24/7".'
          error={errors.nome?.message}
          {...register('nome')}
        />

        <fieldset className="flex flex-col gap-4 rounded-card border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">Comportamento</legend>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground" id="calendario-padrao-label">
                Calendário padrão
              </p>
              <p className="text-xs text-foreground/70">
                {totalDeCalendarios > 1 && !padrao
                  ? 'Marcar este despromove o calendário padrão atual — só existe um.'
                  : 'Usado pelos planos que não apontam para um calendário específico.'}
              </p>
            </div>
            <Switch
              label="Calendário padrão"
              checked={padrao}
              onChange={(checked) => setValue('padrao', checked, { shouldValidate: true })}
            />
          </div>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Ignorar feriados</p>
              <p className="text-xs text-foreground/70">
                Marque em calendário 24/7: os feriados cadastrados não são descontados do
                tempo útil.
              </p>
            </div>
            <Switch
              label="Ignorar feriados"
              checked={ignorarFeriados}
              onChange={(checked) =>
                setValue('ignorarFeriados', checked, { shouldValidate: true })
              }
            />
          </div>
        </fieldset>

        <Input
          id="calendario-sla-padrao"
          label="Meta padrão de 1º atendimento (minutos)"
          inputMode="numeric"
          autoComplete="off"
          hint="Em branco, os planos deste calendário ficam sem meta e o SLA não é apurado."
          error={errors.slaPadraoMinutos?.message}
          {...register('slaPadraoMinutos')}
        />

        {apiError !== null && (
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
