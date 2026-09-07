import { useMemo, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { Combobox, type ComboboxOption } from '../../../components/ui/Combobox'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { EmptyState } from '../../../components/ui/EmptyState'
import { ErrorState } from '../../../components/ui/ErrorState'
import { Pagination } from '../../../components/ui/Pagination'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useReturnFocus } from '../../../hooks/useReturnFocus'
import { useHolidayImpacts, useHolidays } from '../hooks/useBusinessCalendar'
import { useHolidayMutations } from '../hooks/useHolidayMutations'
import type { HolidayDto, HolidayRequest, ImportHolidaysResultDto } from '../types/calendar'
import { dataCurta, diaLocalSaoPaulo, faixaAceitaDeFeriado } from '../utils/localDay'
import {
  datasRetroativas,
  estadoDoImpacto,
  impactoBloqueiaConfirmacao,
  textoConfirmacaoRetroativa,
  tituloConfirmacaoRetroativa,
} from '../utils/retroactiveWarning'
import { diaSemanaDaData, nomeDoDia } from '../utils/weekday'
import { HolidayFormModal } from './HolidayFormModal'
import { HolidayImportModal } from './HolidayImportModal'

type HolidaysSectionProps = {
  calendarId: number
  /** Nome do calendário — aparece nos estados vazios, que sem ele ficam ambíguos. */
  nomeDoCalendario: string
  podeEditar: boolean
}

const PAGE_SIZE_INICIAL = 25

/**
 * 124/F3 — feriados do calendário: lista paginada, CRUD e importação.
 *
 * ## Estado vazio tem significado de NEGÓCIO
 *
 * Tabela vazia aqui não é "nenhum resultado encontrado": é **"não configurado"**, e é o
 * estado em que o sistema entra em produção (AUTO-124-8 — nada é semeado). Enquanto não
 * houver feriado, todo dia útil é dia cheio no cálculo do tempo útil. O texto diz isso.
 * O vazio **com filtro de ano** é outra coisa e tem outro texto — "não sei responder" ≠
 * "respondi que não há nada" (AP-FRONTEND-021).
 *
 * ## DD-2 — retroatividade
 *
 * Toda mutação que envolva data de hoje ou anterior (SP) passa por confirmação explícita, e a
 * confirmação traz **a contagem real de chamados afetados**, vinda da rota de pré-contagem
 * (`GET .../holidays/impacto?data=`) **antes** da escrita. Ver `utils/retroactiveWarning.ts`.
 */
export function HolidaysSection({
  calendarId,
  nomeDoCalendario,
  podeEditar,
}: HolidaysSectionProps) {
  const [ano, setAno] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE_INICIAL)
  const [formulario, setFormulario] = useState<{ feriado: HolidayDto | null } | null>(null)
  const [importando, setImportando] = useState(false)
  const [removendo, setRemovendo] = useState<HolidayDto | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const returnFocus = useReturnFocus()
  const feriados = useHolidays(calendarId, { ano, page, pageSize })
  const { create, update, remove, importar } = useHolidayMutations()

  // Só consulta quando o diálogo de remoção está aberto, e só a data retroativa (`P-6`:
  // hoje conta como retroativa — o indicador do chamado fechado hoje de manhã muda).
  const datasParaConsultar = removendo === null ? [] : datasRetroativas([removendo.data])
  const resultadosDoImpacto = useHolidayImpacts(calendarId, datasParaConsultar)
  const estadoDoImpactoDaRemocao = estadoDoImpacto(resultadosDoImpacto)

  const opcoesDeAno: ComboboxOption[] = useMemo(() => {
    const { minimo, maximo } = faixaAceitaDeFeriado(diaLocalSaoPaulo())
    const primeiro = Number(minimo.slice(0, 4))
    const ultimo = Number(maximo.slice(0, 4))
    const anos: ComboboxOption[] = [{ value: '', label: 'Todos os anos' }]
    for (let a = primeiro; a <= ultimo; a += 1) {
      anos.push({ value: String(a), label: String(a) })
    }
    return anos
  }, [])

  function abrirFormulario(feriado: HolidayDto | null) {
    returnFocus.capture()
    setFormulario({ feriado })
  }

  function fecharFormulario() {
    setFormulario(null)
    returnFocus.restore()
  }

  async function salvar(feriado: HolidayDto | null, payload: HolidayRequest) {
    // Sem aviso pós-escrita: a contagem já foi exibida ANTES, na confirmação, que é o que
    // DD-2 pede. Repeti-la depois da decisão não acrescenta informação nenhuma.
    return feriado === null
      ? create.mutateAsync({ calendarId, payload })
      : update.mutateAsync({ calendarId, holidayId: feriado.id, payload })
  }

  async function confirmarRemocao() {
    if (removendo === null) return
    const alvo = removendo
    setRemovendo(null)
    await remove.mutateAsync({ calendarId, holidayId: alvo.id })
  }

  /**
   * Aviso pós-importação: **só os contadores do lote**, que nenhuma outra parte da tela
   * mostra.
   *
   * A frase "feriados em datas passadas recalculam os indicadores daqueles dias" **saiu**
   * (QA `D-1`): ela era incondicional e sem número — aparecia igual quando nenhuma data
   * era passada —, e chegava depois da decisão. A contagem real, por data, agora aparece
   * **antes** de confirmar, no `alertdialog` do `HolidayImportModal`.
   */
  function aoImportar(resultado: ImportHolidaysResultDto) {
    setAviso(
      `Importação concluída: ${resultado.criados} feriado(s) novo(s), ` +
        `${resultado.atualizados} atualizado(s) e ${resultado.inalterados} já cadastrado(s).`,
    )
  }

  const pagina = feriados.data
  const itens = pagina?.items ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-56">
          <Combobox
            id="feriados-ano"
            label="Ano"
            value={ano == null ? '' : String(ano)}
            options={opcoesDeAno}
            onChange={(valor) => {
              setAno(valor === '' ? null : Number(valor))
              setPage(1)
            }}
            placeholder="Todos os anos"
          />
        </div>
        {podeEditar && (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                returnFocus.capture()
                setImportando(true)
              }}
            >
              Importar planilha
            </Button>
            <Button variant="primary" onClick={() => abrirFormulario(null)}>
              Novo feriado
            </Button>
          </div>
        )}
      </div>

      {aviso !== null && (
        <p
          role="status"
          className="rounded-control border border-border bg-warning-bg px-3 py-2 text-sm text-foreground"
        >
          {aviso}
        </p>
      )}

      {feriados.isLoading && (
        <div className="rounded-card border border-border bg-card p-6">
          <Skeleton lines={5} />
        </div>
      )}

      {!feriados.isLoading && feriados.isError && (
        <ErrorState
          message="Não foi possível carregar os feriados deste calendário."
          onRetry={() => void feriados.refetch()}
        />
      )}

      {!feriados.isLoading && !feriados.isError && itens.length === 0 && (
        /* 125/FE-A11Y-1 — de volta ao `EmptyState` compartilhado, que voltou a ser
           legível: mensagem em `text-foreground` (13,82:1) e descrição em
           `text-foreground/70` (5,47:1), medidas no DOM por
           `src/utils/primitivosDeUiContraste.test.tsx`. O contorno local existia porque
           a mensagem dele saía em `text-xs italic text-primary/30` — 1,84:1 (QA 124
           `D-2`). `announce` preserva o `role="status"` do contorno. */
        <EmptyState
          announce
          className="rounded-card border border-border bg-card"
          message={
            ano == null
              ? `Nenhum feriado configurado em "${nomeDoCalendario}"`
              : `Nenhum feriado cadastrado em ${ano}`
          }
          description={
            ano == null
              ? 'Enquanto não houver, todos os dias úteis contam como dia cheio no cálculo do tempo em horário comercial.'
              : 'Outros anos podem ter feriados cadastrados — troque o filtro de ano para vê-los.'
          }
        />
      )}

      {!feriados.isLoading && !feriados.isError && itens.length > 0 && pagina !== undefined && (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Feriados de {nomeDoCalendario}</caption>
            <thead className="bg-background">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                  Data
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                  Dia da semana
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                  Nome
                </th>
                {podeEditar && (
                  <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {itens.map((feriado) => {
                const dia = diaSemanaDaData(feriado.data)
                return (
                  <tr key={feriado.id} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{dataCurta(feriado.data)}</td>
                    <td className="px-3 py-2 text-foreground">
                      {dia === null ? '—' : nomeDoDia(dia)}
                    </td>
                    <td className="px-3 py-2 text-foreground">{feriado.nome}</td>
                    {podeEditar && (
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            aria-label={`Editar feriado ${feriado.nome}`}
                            onClick={() => abrirFormulario(feriado)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Remover feriado ${feriado.nome}`}
                            onClick={() => {
                              returnFocus.capture()
                              setRemovendo(feriado)
                            }}
                          >
                            Remover
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="px-3">
            <Pagination
              page={pagina.page}
              pageSize={pagina.pageSize}
              totalCount={pagina.totalCount}
              totalPages={pagina.totalPages}
              onPageChange={setPage}
              onPageSizeChange={(tamanho) => {
                setPageSize(tamanho)
                setPage(1)
              }}
            />
          </div>
        </div>
      )}

      <HolidayFormModal
        isOpen={formulario !== null}
        calendarId={calendarId}
        feriado={formulario?.feriado ?? null}
        onSave={salvar}
        onClose={fecharFormulario}
      />

      <HolidayImportModal
        calendarId={calendarId}
        isOpen={importando}
        onClose={() => {
          setImportando(false)
          returnFocus.restore()
        }}
        onImportar={(itensParaImportar, dryRun) =>
          importar.mutateAsync({ calendarId, itens: itensParaImportar, dryRun })
        }
        onImportado={aoImportar}
      />

      <ConfirmDialog
        isOpen={removendo !== null}
        title={
          datasParaConsultar.length > 0
            ? tituloConfirmacaoRetroativa('remover')
            : 'Remover feriado'
        }
        description={
          removendo === null
            ? ''
            : datasParaConsultar.length > 0
              ? textoConfirmacaoRetroativa('remover', datasParaConsultar, estadoDoImpactoDaRemocao)
              : `Remover "${removendo.nome}" de ${dataCurta(removendo.data)}? Aquele dia volta a contar como dia útil no cálculo do tempo em horário comercial.`
        }
        confirmLabel="Remover"
        variant="danger"
        isLoading={remove.isPending || impactoBloqueiaConfirmacao(estadoDoImpactoDaRemocao)}
        onClose={() => {
          setRemovendo(null)
          returnFocus.restore()
        }}
        onConfirm={() => void confirmarRemocao()}
      />
    </div>
  )
}
