import { useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Input } from '../../../components/ui/Input'
import { Skeleton } from '../../../components/ui/Skeleton'
import type { CreateScheduleRequest, ScheduleDto, ScheduleWindowDto } from '../types/calendar'
import {
  getCalendarErrorDetails,
  getCalendarErrorMessage,
  type DetalheDeErro,
} from '../utils/calendarErrorMessage'
import { diaLocalSaoPaulo } from '../utils/localDay'
import { FORMATO_HORA, formatarDuracao } from '../utils/minutes'
import {
  janelaVazia,
  janelasDoDia,
  minutosDaSemana,
  minutosDoDia,
  ordenar,
  paraEditaveis,
  rotuloDoCampoDeJanela,
  validarGrade,
  type JanelaEditavel,
} from '../utils/schedule'
import { DIAS_DA_SEMANA } from '../utils/weekday'

type ScheduleSectionProps = {
  calendarId: number
  schedule: ScheduleDto | undefined
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  podeEditar: boolean
  /** Salva e **rejeita** em caso de falha (use `mutateAsync`). */
  onSalvar: (payload: CreateScheduleRequest) => Promise<unknown>
}

/**
 * 124/F2 — grade semanal de expediente, versionada por vigência.
 *
 * ## O que esta tela edita, e o que ela NÃO edita (A-5)
 *
 * Salvar **cria uma nova vigência**; a versão anterior continua no ar governando o
 * passado. É o contrato do `POST /calendars/{id}/schedule`, e é a diferença entre esta
 * demanda e a 121/D3, cujo *"retroativo, sem snapshot"* mudou competências já fechadas
 * no dia do deploy. A tela **diz isso por escrito** ao lado do botão — configuração que
 * muda indicador em silêncio é a classe de defeito que a 124 existe para acabar.
 *
 * ## As duas convenções que a grade materializa
 *
 * - **R-6 — `0 = domingo`**: as sete linhas são `DIAS_DA_SEMANA`, iteradas na ordem do
 *   valor. Nenhum `+1`, nenhum `% 7`, nenhuma lista "começando na segunda".
 * - **A-3 — minuto do dia, `0..1440`**: os campos são de **texto** (`HH:MM`), e não
 *   `<input type="time">`, porque o controle nativo não aceita `24:00` — o que tornaria
 *   um calendário 24/7 inexprimível, que é justamente o caso que A-3 existe para cobrir.
 *
 * ## A-4 — vários intervalos por dia
 *
 * Cada dia tem uma **lista** de janelas (almoço, sábado meio-período). "Adicionar janela"
 * é a operação normal, não a exceção.
 */
export function ScheduleSection({
  calendarId,
  schedule,
  isLoading,
  isError,
  onRetry,
  podeEditar,
  onSalvar,
}: ScheduleSectionProps) {
  if (isLoading) {
    return (
      <div className="rounded-card border border-border bg-card p-6">
        <Skeleton lines={6} />
      </div>
    )
  }

  if (isError) {
    return (
      <ErrorState message="Não foi possível carregar o expediente deste calendário." onRetry={onRetry} />
    )
  }

  if (schedule === undefined) {
    // 125/FE-A11Y-1 — de volta ao `EmptyState` compartilhado (mensagem em
    // `text-foreground`, 13,82:1). O contorno local existia porque a mensagem dele saía
    // em `text-xs italic text-primary/30` — 1,84:1, menos de metade do piso AA (QA 124
    // `D-2`). `announce` preserva o `role="status"` que o contorno tinha.
    return (
      <EmptyState
        announce
        className="rounded-card border border-border bg-card"
        message="Selecione um calendário para ver o expediente."
      />
    )
  }

  return (
    <ScheduleEditor
      // Remonta ao trocar de calendário ou quando uma nova vigência entra em vigor —
      // reidratação estrutural, sem `useEffect` + `reset` (react-hooks/set-state-in-effect).
      key={`${calendarId}-${schedule.vigente?.id ?? 'sem-vigencia'}`}
      calendarId={calendarId}
      schedule={schedule}
      podeEditar={podeEditar}
      onSalvar={onSalvar}
    />
  )
}

type ScheduleEditorProps = {
  calendarId: number
  schedule: ScheduleDto
  podeEditar: boolean
  onSalvar: (payload: CreateScheduleRequest) => Promise<unknown>
}

function ScheduleEditor({ schedule, podeEditar, onSalvar }: ScheduleEditorProps) {
  const [janelas, setJanelas] = useState<JanelaEditavel[]>(() =>
    paraEditaveis(schedule.vigente?.janelas ?? []),
  )
  const [vigenciaInicio, setVigenciaInicio] = useState<string>(() => diaLocalSaoPaulo())
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [detalhes, setDetalhes] = useState<DetalheDeErro[]>([])
  const [ultimoEnvio, setUltimoEnvio] = useState<ScheduleWindowDto[]>([])

  const validacao = useMemo(() => validarGrade(janelas), [janelas])
  const totalDaSemana = minutosDaSemana(janelas)

  function erroDaJanela(janelaId: string, campo: 'inicio' | 'fim'): string | undefined {
    if (!tentouSalvar) return undefined
    return validacao.erros.find((e) => e.janelaId === janelaId && e.campo === campo)?.mensagem
  }

  function atualizar(janelaId: string, campo: 'inicio' | 'fim', valor: string) {
    setJanelas((atuais) =>
      atuais.map((janela) => (janela.id === janelaId ? { ...janela, [campo]: valor } : janela)),
    )
  }

  function remover(janelaId: string) {
    setJanelas((atuais) => atuais.filter((janela) => janela.id !== janelaId))
  }

  async function salvar() {
    setTentouSalvar(true)
    setApiError(null)
    setDetalhes([])
    if (validacao.erros.length > 0) return

    setSalvando(true)
    setUltimoEnvio(validacao.janelas)
    try {
      await onSalvar({ vigenciaInicio, janelas: validacao.janelas })
      setTentouSalvar(false)
    } catch (error) {
      setApiError(getCalendarErrorMessage(error))
      setDetalhes(getCalendarErrorDetails(error))
    } finally {
      setSalvando(false)
    }
  }

  const vigente = schedule.vigente

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Expediente em vigor"
        className="rounded-card border border-border bg-card p-4"
      >
        {vigente === null ? (
          <p className="text-sm text-foreground">
            <strong>Expediente não configurado.</strong> Enquanto não houver uma versão em
            vigor, o tempo útil não é calculado e o SLA de 1º atendimento continua sem
            apuração — que é exatamente o comportamento de hoje. Monte a grade abaixo e
            escolha a partir de quando ela vale.
          </p>
        ) : (
          <p className="text-sm text-foreground">
            Em vigor desde <strong>{vigente.vigenciaInicio}</strong> — {vigente.janelas.length}{' '}
            janela(s), {formatarDuracao(minutosDaSemana(paraEditaveis(vigente.janelas)))} por
            semana.
          </p>
        )}
      </section>

      <ul className="flex flex-col gap-2">
        {DIAS_DA_SEMANA.map((dia) => {
          const doDia = janelasDoDia(janelas, dia.valor)
          const tituloId = `expediente-dia-${dia.valor}`
          return (
            <li
              key={dia.valor}
              className="rounded-card border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 id={tituloId} className="text-sm font-semibold text-foreground">
                  {dia.nome}
                </h3>
                <span className="text-xs text-foreground/70">
                  {doDia.length === 0
                    ? 'Sem expediente'
                    : formatarDuracao(minutosDoDia(janelas, dia.valor))}
                </span>
              </div>

              <ul aria-labelledby={tituloId} className="mt-2 flex flex-col gap-2">
                {doDia.map((janela, indice) => (
                  <li key={janela.id} className="flex flex-wrap items-start gap-2">
                    <div className="w-28">
                      <Input
                        id={`${janela.id}-inicio`}
                        aria-label={`Início da janela ${indice + 1} de ${dia.nome}`}
                        placeholder={FORMATO_HORA}
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={!podeEditar}
                        value={janela.inicio}
                        error={erroDaJanela(janela.id, 'inicio')}
                        onChange={(evento) => atualizar(janela.id, 'inicio', evento.target.value)}
                      />
                    </div>
                    <span aria-hidden="true" className="pt-2 text-sm text-foreground/70">
                      às
                    </span>
                    <div className="w-28">
                      <Input
                        id={`${janela.id}-fim`}
                        aria-label={`Fim da janela ${indice + 1} de ${dia.nome}`}
                        placeholder={FORMATO_HORA}
                        inputMode="numeric"
                        autoComplete="off"
                        disabled={!podeEditar}
                        value={janela.fim}
                        error={erroDaJanela(janela.id, 'fim')}
                        onChange={(evento) => atualizar(janela.id, 'fim', evento.target.value)}
                      />
                    </div>
                    {podeEditar && (
                      <Button
                        variant="ghost"
                        aria-label={`Remover janela ${indice + 1} de ${dia.nome}`}
                        onClick={() => remover(janela.id)}
                      >
                        Remover
                      </Button>
                    )}
                  </li>
                ))}
              </ul>

              {podeEditar && (
                <Button
                  variant="secondary"
                  className="mt-2"
                  aria-label={`Adicionar janela em ${dia.nome}`}
                  onClick={() => setJanelas((atuais) => ordenar([...atuais, janelaVazia(dia.valor)]))}
                >
                  Adicionar janela
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      <section
        aria-label="Salvar expediente"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
      >
        <p className="text-sm text-foreground">
          Total da semana: <strong>{formatarDuracao(totalDaSemana)}</strong>. Use{' '}
          <code>00:00</code> a <code>24:00</code> — um dia inteiro é <code>00:00 às 24:00</code>.
        </p>

        {podeEditar && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-56">
                <Input
                  id="expediente-vigencia"
                  type="date"
                  label="Em vigor a partir de"
                  required
                  value={vigenciaInicio}
                  onChange={(evento) => setVigenciaInicio(evento.target.value)}
                />
              </div>
              <Button
                variant="primary"
                isLoading={salvando}
                disabled={salvando}
                onClick={() => void salvar()}
              >
                Salvar nova vigência
              </Button>
            </div>

            <p className="rounded-control border border-border bg-warning-bg px-3 py-2 text-sm text-foreground">
              Salvar <strong>não altera</strong> as versões anteriores: elas continuam
              valendo para os dias já passados, e a grade acima passa a valer da data
              escolhida em diante. É assim que um indicador já apurado não muda de valor
              quando a política muda.
            </p>
          </>
        )}

        {tentouSalvar && validacao.erros.length > 0 && (
          <p className="text-sm text-error-fg" role="alert">
            Corrija as {validacao.erros.length} janela(s) marcada(s) antes de salvar.
          </p>
        )}

        {apiError !== null && (
          <div role="alert" className="flex flex-col gap-1">
            <p className="text-sm text-error-fg">{apiError}</p>
            {detalhes.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-error-fg">
                {detalhes.map((detalhe, indice) => (
                  <li key={`${detalhe.field}-${indice}`}>
                    <strong>{rotuloDoCampoDeJanela(detalhe.field, ultimoEnvio)}:</strong>{' '}
                    {detalhe.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section
        aria-label="Versões do expediente"
        className="rounded-card border border-border bg-card p-4"
      >
        <h3 className="text-sm font-semibold text-foreground">Versões</h3>
        {schedule.versoes.length === 0 ? (
          <p className="mt-1 text-sm text-foreground/70">
            Nenhuma versão de expediente cadastrada neste calendário.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground">
            {schedule.versoes.map((versao) => (
              <li key={versao.id}>
                A partir de <strong>{versao.vigenciaInicio}</strong> — {versao.janelasCount}{' '}
                janela(s)
                {vigente !== null && versao.id === vigente.id ? ' (em vigor hoje)' : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
