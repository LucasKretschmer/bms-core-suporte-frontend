import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Input } from '../../../components/ui/Input'
import { Modal } from '../../../components/ui/Modal'
import {
  holidayFormSchema,
  toHolidayFormValues,
  toHolidayRequest,
  type HolidayDto,
  type HolidayFormValues,
  type HolidayRequest,
} from '../types/calendar'
import { useHolidayImpacts } from '../hooks/useBusinessCalendar'
import { getCalendarErrorMessage } from '../utils/calendarErrorMessage'
import { dataPorExtenso } from '../utils/localDay'
import { diaSemanaDaData, nomeDoDia } from '../utils/weekday'
import {
  datasRetroativas,
  estadoDoImpacto,
  impactoBloqueiaConfirmacao,
  textoConfirmacaoRetroativa,
  tituloConfirmacaoRetroativa,
} from '../utils/retroactiveWarning'

type HolidayFormModalProps = {
  /** Calendário dono do feriado — usado na rota de pré-contagem de impacto. */
  calendarId: number
  /** `null` = cadastro; preenchido = edição. */
  feriado: HolidayDto | null
  isOpen: boolean
  /** Salva e **rejeita** em caso de falha (use `mutateAsync`). */
  onSave: (feriado: HolidayDto | null, payload: HolidayRequest) => Promise<unknown>
  onClose: () => void
}

/**
 * 124/F3 — cadastro/edição de feriado, com a confirmação de retroatividade (DD-2).
 *
 * ## Por que a confirmação vive aqui
 *
 * O gatilho é a **data**, e a data está neste formulário. Editar tem **duas** datas
 * relevantes — a antiga e a nova —: mover um feriado de ontem para amanhã mexe no
 * passado tanto quanto o contrário, e considerar só a nova deixaria metade dos casos
 * sem aviso (ver `utils/retroactiveWarning.ts`).
 *
 * A contagem de chamados afetados vem da rota de **pré-contagem**
 * (`GET .../holidays/impacto?data=`, §1.4 do `be-f2f3-report.md`), disparada quando o
 * diálogo abre e **só** para as datas retroativas. Enquanto ela não chega, o diálogo diz
 * que está consultando e o botão de confirmar fica travado: o ponto de DD-2 é decidir
 * **vendo** o número.
 *
 * ## AUTO-124-11 — só data concreta
 *
 * Não há campo "recorrente": Carnaval de 2027 é uma linha editável, nunca uma fórmula.
 * Regra que gera datas sem linha visível é configuração invisível governando indicador.
 */
export function HolidayFormModal({
  calendarId,
  feriado,
  isOpen,
  onSave,
  onClose,
}: HolidayFormModalProps) {
  if (!isOpen) return null
  return (
    <HolidayForm
      key={feriado != null ? `feriado-${feriado.id}` : 'novo-feriado'}
      calendarId={calendarId}
      feriado={feriado}
      onSave={onSave}
      onClose={onClose}
    />
  )
}

type HolidayFormProps = Omit<HolidayFormModalProps, 'isOpen'>

function HolidayForm({ calendarId, feriado, onSave, onClose }: HolidayFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<HolidayFormValues | null>(null)
  const [salvando, setSalvando] = useState(false)
  const isEdicao = feriado != null

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: toHolidayFormValues(feriado),
  })

  const dataAtual = watch('data')
  const diaSemana = diaSemanaDaData(dataAtual)

  // As datas retroativas (hoje ou antes, `P-6`) só são calculadas — e consultadas — quando o
  // diálogo abre: consultar a cada tecla digitada no campo de data seria uma requisição por
  // caractere.
  const datasParaConsultar =
    confirmando === null ? [] : datasRetroativas([confirmando.data, feriado?.data ?? null])
  const resultados = useHolidayImpacts(calendarId, datasParaConsultar)
  const estado = estadoDoImpacto(resultados)

  async function enviar(values: HolidayFormValues) {
    setApiError(null)
    setSalvando(true)
    try {
      await onSave(feriado, toHolidayRequest(values))
      onClose()
    } catch (error) {
      setApiError(getCalendarErrorMessage(error))
    } finally {
      setSalvando(false)
    }
  }

  async function onValid(values: HolidayFormValues) {
    if (datasRetroativas([values.data, feriado?.data ?? null]).length > 0) {
      setConfirmando(values)
      return
    }
    await enviar(values)
  }

  const ocupado = isSubmitting || salvando

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        size="md"
        title={isEdicao ? 'Editar feriado' : 'Novo feriado'}
      >
        <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-5" noValidate>
          <Input
            id="feriado-data"
            type="date"
            label="Data"
            required
            error={errors.data?.message}
            {...register('data')}
          />

          {diaSemana !== null && (
            <p className="-mt-3 text-xs text-foreground/70">
              {dataPorExtenso(dataAtual)} — {nomeDoDia(diaSemana)}
            </p>
          )}

          <Input
            id="feriado-nome"
            label="Nome do feriado"
            required
            autoComplete="off"
            hint="Ex.: Carnaval, Corpus Christi. Cada data é uma linha própria — não há recorrência automática."
            error={errors.nome?.message}
            {...register('nome')}
          />

          {apiError !== null && (
            <p className="text-sm text-error-fg" role="alert">
              {apiError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose} disabled={ocupado}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={ocupado} disabled={ocupado}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={confirmando !== null}
        title={tituloConfirmacaoRetroativa(isEdicao ? 'editar' : 'criar')}
        description={textoConfirmacaoRetroativa(
          isEdicao ? 'editar' : 'criar',
          datasParaConsultar,
          estado,
        )}
        confirmLabel="Salvar mesmo assim"
        // Trava enquanto a contagem não chegou (Escape e clique no overlay continuam
        // fechando — o usuário nunca fica preso).
        isLoading={salvando || impactoBloqueiaConfirmacao(estado)}
        variant="danger"
        onClose={() => setConfirmando(null)}
        onConfirm={() => {
          const values = confirmando
          setConfirmando(null)
          if (values !== null) void enviar(values)
        }}
      />
    </>
  )
}
