import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Combobox, type ComboboxOption } from '../../../components/ui/Combobox'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { Switch } from '../../../components/ui/Switch'
import {
  getPlanMutationError,
  shouldWarnUnsafeRename,
  textoAvisoRenameInseguro,
} from '../utils/planErrorMessage'
import {
  supportPlanFormSchema,
  toSupportPlanFormValues,
  toSupportPlanRequest,
  type CalendarOptionDto,
  type SupportPlanDto,
  type SupportPlanFormValues,
  type SupportPlanRequest,
} from '../types/supportPlan'

/** Estado do cadastro de calendários — três respostas diferentes, três textos diferentes. */
export type CalendarsStatus = 'loading' | 'error' | 'ready'

type SupportPlanFormModalProps = {
  /** `null` = criação; preenchido = edição. `undefined`/fechado quando `isOpen` é false. */
  plan: SupportPlanDto | null
  isOpen: boolean
  /**
   * Só na CRIAÇÃO: valor do HubSpot já preenchido, vindo do card "Planos do HubSpot sem
   * correspondência" — é o que fecha o laço entre "vi o problema" e "resolvi o problema".
   */
  hubspotValorInicial?: string
  calendarios: readonly CalendarOptionDto[]
  calendariosStatus: CalendarsStatus
  /**
   * Salva e **rejeita** em caso de falha (use `mutateAsync`). A rejeição é o que mantém o
   * modal aberto com o erro inline — sem ela o `422 PLAN_RENAME_UNSAFE` fecharia o modal
   * como se tivesse dado certo, e o usuário acharia que renomeou.
   */
  onSave: (plan: SupportPlanDto | null, payload: SupportPlanRequest) => Promise<unknown>
  onClose: () => void
}

/**
 * 124/F1 — formulário de plano de suporte (criar/editar), RHF + Zod.
 *
 * A reidratação entre planos é **estrutural**: o formulário vive num componente interno
 * remontado por `key`, então `defaultValues` e o erro de API nascem certos ao trocar de
 * linha. Mesmo padrão de `service-categories/components/EditCategoryModal.tsx` — e pelo
 * mesmo motivo: `useEffect` + `reset()` reprova em `react-hooks/set-state-in-effect` e
 * depende de uma lista de dependências que envelhece.
 */
export function SupportPlanFormModal({
  plan,
  isOpen,
  hubspotValorInicial = '',
  calendarios,
  calendariosStatus,
  onSave,
  onClose,
}: SupportPlanFormModalProps) {
  if (!isOpen) return null
  return (
    <SupportPlanForm
      // A `key` inclui o valor pré-preenchido: abrir o formulário de criação a partir de
      // OUTRA linha do card precisa remontar, senão o campo fica com o valor anterior.
      key={plan != null ? `plano-${plan.id}` : `novo-${hubspotValorInicial}`}
      plan={plan}
      hubspotValorInicial={hubspotValorInicial}
      calendarios={calendarios}
      calendariosStatus={calendariosStatus}
      onSave={onSave}
      onClose={onClose}
    />
  )
}

type SupportPlanFormProps = Omit<SupportPlanFormModalProps, 'isOpen'>

/** Texto do seletor de calendário conforme o estado do cadastro (BE-F2F3, onda 2). */
function dicaCalendario(status: CalendarsStatus, total: number): string | undefined {
  if (status === 'loading') return 'Carregando calendários…'
  if (status === 'error') {
    // "não sei responder" ≠ "respondi que não há nada" (AP-FRONTEND-021).
    return 'Não foi possível carregar os calendários. O plano continua no calendário padrão.'
  }
  if (total === 0) {
    return 'Nenhum calendário cadastrado. Enquanto não houver, todo plano usa o calendário padrão.'
  }
  return undefined
}

function SupportPlanForm({
  plan,
  hubspotValorInicial = '',
  calendarios,
  calendariosStatus,
  onSave,
  onClose,
}: SupportPlanFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)
  const isEdicao = plan != null

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupportPlanFormValues>({
    resolver: zodResolver(supportPlanFormSchema),
    defaultValues: toSupportPlanFormValues(plan, hubspotValorInicial),
  })

  const slaIsento = watch('slaIsento')
  const calendarioId = watch('calendarioId')
  const nomeAtual = watch('nome')
  const hubspotValorAtual = watch('hubspotValor')

  // R-1 — aviso PREVENTIVO, antes de o backend recusar. Não bloqueia o envio: o backend é
  // a fonte de verdade, e bloquear aqui esconderia a mudança da guarda do servidor.
  const avisaRenameInseguro =
    isEdicao &&
    shouldWarnUnsafeRename({
      nomeOriginal: plan.nome,
      nomeAtual,
      hubspotValorAtual,
      clientesVinculados: plan.clientesVinculados,
    })

  const calendarioOptions: ComboboxOption[] = [
    { value: '', label: 'Calendário padrão' },
    ...calendarios.map((c) => ({
      value: String(c.id),
      label: c.padrao ? `${c.nome} (padrão)` : c.nome,
    })),
  ]
  const dica = dicaCalendario(calendariosStatus, calendarios.length)

  async function onValid(values: SupportPlanFormValues) {
    setApiError(null)
    try {
      await onSave(plan, toSupportPlanRequest(values))
      onClose()
    } catch (error) {
      const info = getPlanMutationError(error)
      setApiError(info.message)
      // Erro que aponta para um campo vira erro DAQUELE campo — é o que leva o usuário
      // até o que precisa corrigir (R-1: o campo é o identificador do HubSpot).
      if (info.field != null) {
        setError(info.field, { type: 'server', message: info.message }, { shouldFocus: true })
      }
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={isEdicao ? 'Editar plano de suporte' : 'Novo plano de suporte'}
    >
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            id="plano-nome"
            label="Nome do plano"
            required
            autoComplete="off"
            error={errors.nome?.message}
            {...register('nome')}
          />
          <Input
            id="plano-hubspot-valor"
            label="Identificador do HubSpot"
            autoComplete="off"
            hint="Valor de sla__plano_de_suporte_contratado. Preenchido, o cliente deixa de ser associado pelo nome do plano."
            error={errors.hubspotValor?.message}
            {...register('hubspotValor')}
          />
        </div>

        {avisaRenameInseguro && (
          <p
            role="alert"
            // `text-foreground` sobre `bg-warning-bg` = 13.36:1. `text-warning-fg` sobre o
            // mesmo fundo mede 3.00:1 e reprova AA (AP-FRONTEND-018).
            className="rounded-control border border-border bg-warning-bg px-3 py-2 text-sm text-foreground"
          >
            {textoAvisoRenameInseguro(plan.clientesVinculados)}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Input
            id="plano-horas-mes"
            label="Horas por mês"
            required
            inputMode="decimal"
            autoComplete="off"
            error={errors.horasMes?.message}
            {...register('horasMes')}
          />
          <Input
            id="plano-preco-hora-extra"
            label="Preço da hora extra"
            inputMode="decimal"
            autoComplete="off"
            hint="Opcional."
            error={errors.precoHoraExtra?.message}
            {...register('precoHoraExtra')}
          />
          <Input
            id="plano-moeda"
            label="Moeda"
            required
            autoComplete="off"
            hint="Código ISO 4217 (BRL, USD…)."
            error={errors.moeda?.message}
            {...register('moeda')}
          />
        </div>

        <fieldset className="flex flex-col gap-4 rounded-card border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">
            SLA de 1º atendimento
          </legend>

          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Plano isento de SLA</p>
              {/* /70 sobre o card do modal = 5,47:1 (o /50 media 3,04:1 — QA 124 D-3). */}
              <p className="text-xs text-foreground/70">
                Os chamados deste plano ficam fora do indicador de 1º atendimento.
              </p>
            </div>
            <Switch
              label="Plano isento de SLA de 1º atendimento"
              checked={slaIsento}
              onChange={(checked) => {
                setValue('slaIsento', checked, { shouldValidate: true })
                // Isento + meta é estado proibido no banco
                // (`ck_suporte_supportplans_slaisento`). Limpar aqui evita um 422 que o
                // usuário não teria como interpretar.
                if (checked) {
                  setValue('slaPrimeiroAtendimentoMinutos', '', { shouldValidate: true })
                }
              }}
            />
          </div>

          <Input
            id="plano-sla-minutos"
            label="Meta de 1º atendimento (minutos)"
            inputMode="numeric"
            autoComplete="off"
            disabled={slaIsento}
            hint={
              slaIsento
                ? 'Indisponível: o plano está marcado como isento.'
                : 'Em branco, o plano herda a meta padrão do calendário.'
            }
            error={errors.slaPrimeiroAtendimentoMinutos?.message}
            {...register('slaPrimeiroAtendimentoMinutos')}
          />
        </fieldset>

        <Combobox
          id="plano-calendario"
          label="Calendário do plano"
          value={calendarioId}
          options={calendarioOptions}
          onChange={(v) => setValue('calendarioId', v, { shouldValidate: true })}
          disabled={calendariosStatus !== 'ready' || calendarios.length === 0}
          placeholder="Calendário padrão"
          error={errors.calendarioId?.message}
        />
        {/* /70 sobre o card do modal = 5,47:1 (o /50 media 3,04:1 — QA 124 D-3). */}
        {dica && <p className="-mt-3 text-xs text-foreground/70">{dica}</p>}

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
