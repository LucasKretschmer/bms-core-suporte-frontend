import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Combobox, type ComboboxOption } from '../../components/ui/Combobox'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { Tabs } from '../../components/ui/Tabs'
import { tabId, tabPanelId } from '../../components/ui/tabsIds'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { usePermissions } from '../../hooks/usePermissions'
import { useReturnFocus } from '../../hooks/useReturnFocus'
import { CalendarFormModal } from './components/CalendarFormModal'
import { HolidaysSection } from './components/HolidaysSection'
import { ScheduleSection } from './components/ScheduleSection'
import { useCalendars, useSchedule } from './hooks/useBusinessCalendar'
import { useCalendarMutations } from './hooks/useCalendarMutations'
import type { CalendarDto, CalendarRequest, CreateScheduleRequest } from './types/calendar'

/**
 * 124/F2+F3 — **Calendário comercial**: expediente versionado e feriados.
 *
 * ## O que esta tela é
 *
 * É a origem do tempo útil do sistema. Enquanto ela estiver vazia, `CalendarioComercial`
 * responde `Vazio == true` e o SLA de 1º atendimento sai `null` — que é **byte a byte o
 * comportamento de hoje** (`arquitetura.md` §4 ponto 1). Nada é semeado (AUTO-124-8): um
 * "08:00–18:00" escrito por um agente seria número inventado virando requisito, e o
 * expediente real ainda é decisão do usuário (`U124-3`).
 *
 * Por isso todo estado vazio aqui diz **"não configurado"** e explica a consequência —
 * nunca "nenhum resultado encontrado", que faria o estado normal do dia 1 parecer falha
 * de filtro.
 *
 * ## Permissões (UX; o backend é a fonte de verdade)
 *
 * `GET` exige `CoordenadorPlus`; `POST`/`PUT` exigem `GerentePlus`
 * (`CalendarsController.cs`, `HolidaysController.cs`). Quem é Coordenador **vê** e não
 * recebe as ações de escrita — barrar antes evita o 403 depois do formulário preenchido.
 */

type AbaDoCalendario = 'expediente' | 'feriados'

const ABAS: { id: AbaDoCalendario; label: string }[] = [
  { id: 'expediente', label: 'Expediente' },
  { id: 'feriados', label: 'Feriados' },
]

const BASE_ID_ABAS = 'calendario-comercial'

export default function BusinessCalendarPage() {
  const { isCoordenadorOuAcima, isGerentePlus } = usePermissions()
  const calendarios = useCalendars()
  const { create, update, salvarExpediente } = useCalendarMutations()

  const [selecionadoId, setSelecionadoId] = useState<number | null>(null)
  const [formulario, setFormulario] = useState<{ calendario: CalendarDto | null } | null>(null)
  const [aba, setAba] = useState<AbaDoCalendario>('expediente')
  const returnFocus = useReturnFocus()

  const lista = calendarios.data ?? []
  // Seleção DERIVADA — sem `useEffect` sincronizando estado com dados (que ficaria um
  // render atrás e reprova em `react-hooks/set-state-in-effect`). Enquanto o usuário não
  // escolher, vale o calendário padrão; sem padrão, o primeiro da lista.
  const selecionado: CalendarDto | null =
    lista.find((c) => c.id === selecionadoId) ??
    lista.find((c) => c.padrao) ??
    lista[0] ??
    null

  const schedule = useSchedule(selecionado?.id ?? null)

  function abrirFormulario(calendario: CalendarDto | null) {
    returnFocus.capture()
    setFormulario({ calendario })
  }

  function fecharFormulario() {
    setFormulario(null)
    returnFocus.restore()
  }

  async function salvarCalendario(calendario: CalendarDto | null, payload: CalendarRequest) {
    if (calendario != null) {
      return update.mutateAsync({ id: calendario.id, payload })
    }
    const criado = await create.mutateAsync(payload)
    // Criar e não selecionar deixaria o usuário sem entender por que a grade não mudou.
    setSelecionadoId(criado.id)
    return criado
  }

  async function salvarExpedienteDoCalendario(payload: CreateScheduleRequest) {
    if (selecionado === null) return
    return salvarExpediente.mutateAsync({ calendarId: selecionado.id, payload })
  }

  if (!isCoordenadorOuAcima) {
    return <ErrorState message="Você não tem permissão para acessar esta área." className="mt-16" />
  }

  const opcoes: ComboboxOption[] = lista.map((calendario) => ({
    value: String(calendario.id),
    label: calendario.padrao ? `${calendario.nome} (padrão)` : calendario.nome,
  }))

  const breadcrumb = [{ label: 'Administração' }, { label: 'Calendário Comercial' }]

  return (
    <PageWrapper
      title="Calendário Comercial"
      breadcrumbItems={breadcrumb}
      actions={
        isGerentePlus && lista.length > 0 ? (
          <Button variant="primary" onClick={() => abrirFormulario(null)}>
            Novo calendário
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <p className="max-w-3xl text-sm text-foreground/70">
          Expediente e feriados definem o <strong>tempo útil</strong> usado no SLA de 1º
          atendimento. Um plano de suporte aponta para um calendário; sem calendário
          configurado, o SLA continua sem apuração.
        </p>

        {calendarios.isLoading && (
          <div className="rounded-card border border-border bg-card p-6">
            <Skeleton lines={4} />
          </div>
        )}

        {!calendarios.isLoading && calendarios.isError && (
          <ErrorState
            message="Não foi possível carregar os calendários."
            onRetry={() => void calendarios.refetch()}
          />
        )}

        {!calendarios.isLoading && !calendarios.isError && lista.length === 0 && (
          /* 125/FE-A11Y-1 — de volta ao `EmptyState` compartilhado. O contorno local
             existia porque a mensagem dele saía em `text-xs italic text-primary/30`
             (**1,84:1**, QA 124 `D-2`); hoje o wrapper renderiza a mensagem em
             `text-foreground` (13,82:1) e a descrição em `text-foreground/70` (5,47:1),
             medidas no DOM por `src/utils/primitivosDeUiContraste.test.tsx`.
             `announce` mantém o `role="status"` que o contorno tinha: este vazio
             SUBSTITUI um carregamento. */
          <EmptyState
            announce
            className="rounded-card border border-border bg-card"
            message="Nenhum calendário comercial configurado"
            description="Enquanto não houver, o tempo útil não é calculado e o SLA de 1º atendimento fica sem apuração — o mesmo comportamento de hoje."
            action={
              isGerentePlus
                ? { label: 'Criar calendário', onClick: () => abrirFormulario(null) }
                : undefined
            }
          />
        )}

        {!calendarios.isLoading && !calendarios.isError && selecionado !== null && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-72">
                <Combobox
                  id="calendario-selecionado"
                  label="Calendário"
                  value={String(selecionado.id)}
                  options={opcoes}
                  onChange={(valor) => setSelecionadoId(Number(valor))}
                />
              </div>
              {isGerentePlus && (
                <Button
                  variant="secondary"
                  aria-label={`Editar calendário ${selecionado.nome}`}
                  onClick={() => abrirFormulario(selecionado)}
                >
                  Editar calendário
                </Button>
              )}
              <p className="pb-2 text-sm text-foreground/70">
                {selecionado.slaPadraoMinutos == null
                  ? 'Sem meta padrão de 1º atendimento.'
                  : `Meta padrão: ${selecionado.slaPadraoMinutos} min.`}
                {selecionado.ignorarFeriados ? ' Feriados ignorados (24/7).' : ''}
              </p>
            </div>

            <Tabs
              items={ABAS}
              value={aba}
              onChange={setAba}
              label="Configuração do calendário"
              baseId={BASE_ID_ABAS}
            />

            {ABAS.map((item) => (
              <div
                key={item.id}
                role="tabpanel"
                hidden={item.id !== aba}
                id={tabPanelId(BASE_ID_ABAS, item.id)}
                aria-labelledby={tabId(BASE_ID_ABAS, item.id)}
              >
                {item.id === aba && item.id === 'expediente' && (
                  <ScheduleSection
                    calendarId={selecionado.id}
                    schedule={schedule.data}
                    isLoading={schedule.isLoading}
                    isError={schedule.isError}
                    onRetry={() => void schedule.refetch()}
                    podeEditar={isGerentePlus}
                    onSalvar={salvarExpedienteDoCalendario}
                  />
                )}
                {item.id === aba && item.id === 'feriados' && (
                  <HolidaysSection
                    calendarId={selecionado.id}
                    nomeDoCalendario={selecionado.nome}
                    podeEditar={isGerentePlus}
                  />
                )}
              </div>
            ))}
          </>
        )}
      </div>

      <CalendarFormModal
        isOpen={formulario !== null}
        calendario={formulario?.calendario ?? null}
        totalDeCalendarios={lista.length}
        onSave={salvarCalendario}
        onClose={fecharFormulario}
      />
    </PageWrapper>
  )
}
