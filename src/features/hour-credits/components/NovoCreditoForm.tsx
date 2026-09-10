import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { ClientCombobox } from '../../reports/shared/components/ClientCombobox'
import { MotivoCombobox } from './MotivoCombobox'
import {
  novoCreditoSchema,
  type NovoCreditoFormInput,
  type NovoCreditoFormValues,
} from '../types/hourCredit'

type NovoCreditoFormProps = {
  /** Rejeita em caso de falha; o toast do erro é da mutation. */
  onSubmit: (values: NovoCreditoFormValues) => Promise<unknown>
  isPending: boolean
}

/**
 * Formulário de lançamento manual de crédito (132/F5).
 *
 * 🔴 **Três campos, e só três** — cliente, horas e motivo (`arquitetura.md:917`).
 * **Não existe campo de data**: D8′ ratificou que o crédito vale **uma** competência (a
 * corrente, derivada no servidor), sem estender validade e sem mover. Campo de período
 * final aqui é reprovação, não melhoria.
 *
 * `criadoPorUserId`, `origem`, `ticketId` e `competenciaOrigem` **nunca** saem do cliente
 * (`rules/security.md`).
 */
export function NovoCreditoForm({ onSubmit, isPending }: NovoCreditoFormProps) {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NovoCreditoFormInput, unknown, NovoCreditoFormValues>({
    resolver: zodResolver(novoCreditoSchema),
    // `undefined` como valor inicial dos numéricos: `0` faria o schema reprovar com
    // "maior que zero" antes de o usuário digitar qualquer coisa.
    defaultValues: { clientId: undefined, horas: undefined, motivoId: undefined },
  })

  async function onValid(values: NovoCreditoFormValues) {
    await onSubmit(values)
    reset({ clientId: undefined, horas: undefined, motivoId: undefined })
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="flex flex-wrap items-start gap-3"
      aria-label="Lançar novo crédito"
    >
      <Controller
        control={control}
        name="clientId"
        render={({ field }) => (
          <ClientCombobox
            className="w-80"
            required
            value={field.value == null ? null : String(field.value)}
            onChange={(clientId) => field.onChange(clientId === null ? undefined : Number(clientId))}
          />
        )}
      />

      <div className="w-40">
        <Input
          id="novo-credito-horas"
          label="Horas"
          required
          type="number"
          step="0.25"
          min="0"
          inputMode="decimal"
          placeholder="Ex.: 2"
          error={errors.horas?.message}
          {...register('horas')}
        />
      </div>

      <Controller
        control={control}
        name="motivoId"
        render={({ field }) => (
          <MotivoCombobox
            id="novo-credito-motivo"
            className="w-96"
            required
            value={field.value == null ? null : Number(field.value)}
            onChange={(motivoId) => field.onChange(motivoId ?? undefined)}
            error={errors.motivoId?.message}
          />
        )}
      />

      <div className="pt-6">
        <Button type="submit" variant="primary" isLoading={isSubmitting || isPending}>
          Lançar crédito
        </Button>
      </div>

      {errors.clientId?.message && (
        <p className="w-full text-sm text-error-fg" role="alert">
          {errors.clientId.message}
        </p>
      )}
    </form>
  )
}
