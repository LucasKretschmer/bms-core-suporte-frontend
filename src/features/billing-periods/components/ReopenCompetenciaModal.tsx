import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import { formatMonth } from '../../reports/shared/utils/formatters'
import {
  CONFIRMAR_IMPACTO_LABEL,
  CREDITOS_DEPENDENTES_DESCONHECIDO,
  IMPACTO_REABERTURA,
  IMPACTO_REABERTURA_CREDITOS_NOVOS,
  MOTIVO_LABEL,
  MOTIVO_PLACEHOLDER,
  TITULO_REABRIR,
  creditosDependentesTexto,
} from '../competenciaTelaTextos'
import {
  reabrirCompetenciaSchema,
  type BillingPeriodDto,
  type ReabrirCompetenciaFormValues,
} from '../types/billingPeriod'

type ReopenCompetenciaModalProps = {
  /** `null` = fechado. A competência inteira, para o diálogo poder ler `creditosDependentes`. */
  periodo: BillingPeriodDto | null
  onClose: () => void
  onConfirm: (values: ReabrirCompetenciaFormValues) => void
  isSubmitting: boolean
  /**
   * Erro de negócio do servidor — tipicamente
   * `409 COMPETENCIA_COM_CREDITOS_DEPENDENTES`, que traz a **contagem**. Renderizado
   * **dentro** do diálogo, nunca como toast que fecha a tela: é estado de negócio, e
   * arrancar o usuário daqui esconderia justamente a informação que resolve o problema
   * (`rules/api.md` § "402 e 429 não passam pelo interceptor global").
   */
  erroDoServidor: string | null
}

const VALORES_INICIAIS: ReabrirCompetenciaFormValues = {
  motivo: '',
  confirmarImpactoEmCreditos: false,
}

/**
 * C-8 — reabertura de competência.
 *
 * Por que um modal dedicado e não o `ConfirmDialog`: aquele recebe `description: string` e
 * este precisa de (a) o aviso de impacto com a contagem, (b) um **checkbox** que alimente
 * `confirmarImpactoEmCreditos` e (c) um campo `motivo` validado (3..255). Alterar o
 * `ConfirmDialog` seria mexer num primitivo compartilhado por várias telas.
 *
 * 🔴 O que este diálogo **nunca** diz: que algum crédito foi ou será corrigido. Reabrir
 * não altera crédito nenhum; refechar revalida e **reporta**, e quem decide é a gerente.
 *
 * O trap de foco é do `Modal` (listener nativo no elemento do dialog); a **devolução** do
 * foco ao botão que abriu é de quem abre (`useReturnFocus` na página) — são dois
 * mecanismos com donos diferentes (`AP-FRONTEND-027`).
 */
export function ReopenCompetenciaModal({
  periodo,
  onClose,
  onConfirm,
  isSubmitting,
  erroDoServidor,
}: ReopenCompetenciaModalProps) {
  const idImpacto = useId()
  const idMotivoBloqueio = useId()
  const idErro = useId()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ReabrirCompetenciaFormValues>({
    resolver: zodResolver(reabrirCompetenciaSchema),
    defaultValues: VALORES_INICIAIS,
  })

  // Cada abertura começa do zero: motivo e confirmação de impacto de uma reabertura
  // anterior não podem sobreviver para a competência seguinte.
  useEffect(() => {
    if (periodo != null) reset(VALORES_INICIAIS)
  }, [periodo, reset])

  const confirmado = watch('confirmarImpactoEmCreditos')

  if (periodo == null) return null

  const mes = formatMonth(periodo.competencia)
  const dependentes = periodo.creditosDependentes

  return (
    <Modal isOpen onClose={onClose} title={`${TITULO_REABRIR} — ${mes}`} size="lg">
      <form
        onSubmit={handleSubmit((values) => onConfirm(values))}
        className="flex flex-col gap-4"
        aria-label={`${TITULO_REABRIR} ${mes}`}
      >
        <section
          aria-label="Impacto da reabertura sobre os créditos"
          className="flex flex-col gap-2 rounded-card border border-line bg-background p-4"
        >
          <p id={idImpacto} className="text-sm text-foreground">
            {IMPACTO_REABERTURA}
          </p>
          <p className="text-sm text-foreground">{IMPACTO_REABERTURA_CREDITOS_NOVOS}</p>
          <p className="text-sm text-foreground">
            {/* `== null` (e não `=== undefined`): o servidor pode omitir a chave OU mandar
                `null`, e nos dois casos o número é DESCONHECIDO. Escrever "0 créditos"
                aqui afirmaria que não há nenhum — exatamente o defeito do
                `AP-FRONTEND-028`. */}
            {dependentes == null
              ? CREDITOS_DEPENDENTES_DESCONHECIDO
              : creditosDependentesTexto(dependentes)}
          </p>
        </section>

        {erroDoServidor != null && (
          <p
            id={idErro}
            role="alert"
            className="rounded-card border border-error-fg bg-error-bg p-3 text-sm text-error-fg"
          >
            {erroDoServidor}
          </p>
        )}

        <Input
          label={MOTIVO_LABEL}
          placeholder={MOTIVO_PLACEHOLDER}
          required
          error={errors.motivo?.message}
          {...register('motivo')}
        />

        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              {...register('confirmarImpactoEmCreditos')}
            />
            <span>{CONFIRMAR_IMPACTO_LABEL}</span>
          </label>
          {errors.confirmarImpactoEmCreditos?.message != null && (
            <p role="alert" className="text-xs text-error-fg">
              {errors.confirmarImpactoEmCreditos.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          {/*
            Sem a confirmação marcada o botão fica `aria-disabled` — **não** `disabled`:
            assim ele continua na ordem de tabulação e o leitor de tela alcança o motivo
            apontado por `aria-describedby` (`rules/frontend.md` § Acessibilidade de
            teclado). A escrita é bloqueada pelo schema: `handleSubmit` reprova o
            `confirmarImpactoEmCreditos: false` e **nenhuma requisição sai** — é o schema,
            e não o atributo do botão, que garante isso.
          */}
          <button
            type="submit"
            aria-disabled={!confirmado || undefined}
            aria-describedby={confirmado ? undefined : idMotivoBloqueio}
            disabled={isSubmitting}
            className={
              confirmado
                ? 'h-9 rounded-control bg-primary px-4 text-sm font-medium text-white hover:shadow-hover focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60'
                : 'h-9 cursor-not-allowed rounded-control border border-line bg-card px-4 text-sm font-medium text-muted focus-visible:ring-2 focus-visible:ring-primary'
            }
          >
            {isSubmitting ? 'Reabrindo…' : 'Reabrir competência'}
          </button>
          {!confirmado && (
            <span id={idMotivoBloqueio} className="sr-only">
              Para reabrir, marque a confirmação de impacto sobre os créditos.
            </span>
          )}
        </div>
      </form>
    </Modal>
  )
}
