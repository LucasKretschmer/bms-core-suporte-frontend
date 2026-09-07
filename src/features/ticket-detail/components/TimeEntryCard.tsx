import { Badge } from '../../../components/ui/Badge'
import { formatDate, formatSeconds, formatTime } from '../../reports/shared/utils/formatters'
import { SegmentTimeline } from './SegmentTimeline'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

type TimeEntryCardProps = {
  entry: TicketTimeEntryDto
  canEdit: boolean
  onEdit: (entry: TicketTimeEntryDto) => void
  /**
   * Pode gerir o ciclo de vida do apontamento (gestor — 099). Quando true, exibe
   * "Cancelar apontamento" em COMPLETED e "Restaurar" em CANCELLED.
   */
  canManage?: boolean
  /** Dispara o fluxo de cancelamento com motivo para este apontamento (099). */
  onCancel?: (entry: TicketTimeEntryDto) => void
  /** Dispara o fluxo de restauração (confirmação simples, sem motivo) (099). */
  onRestore?: (entry: TicketTimeEntryDto) => void
}

/**
 * Rótulos legíveis em PT para o status do atendimento.
 * Chaves normalizadas em UPPERCASE; cobre RUNNING|PAUSED|COMPLETED|CANCELLED|DISCARDED.
 * DISCARDED (120, D-1) — novo status aditivo: tempo preservado, não fatura, não some da tela.
 */
const STATUS_LABELS: Record<string, string> = {
  RUNNING: 'Em andamento',
  PAUSED: 'Pausado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  DISCARDED: 'Descartado',
}

/** Mapeia o status bruto do apontamento para o rótulo PT (fallback: valor original). */
function statusLabel(status: string): string {
  return STATUS_LABELS[status.toUpperCase()] ?? status
}

function EditIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

/** Ícone de "ban" (proibido) para a ação de cancelar apontamento. */
function BanIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.6 5.6l12.8 12.8" />
    </svg>
  )
}

/** Ícone de "restaurar" (seta circular). */
function RestoreIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M4 9a8 8 0 1 1 1.5 8" />
    </svg>
  )
}

/** Ícone de "arquivar" (descartar) — usado quando o apontamento tem tempo consolidado (120, D-1). */
function ArchiveIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 11h6" />
    </svg>
  )
}

/**
 * Card de um apontamento (NOVO — referência protótipo L543-552).
 * Header: agente + categorização + (badge "Faturável por fora").
 * Meta: data/hora início→fim + nº de pausas. Direita: tempo + link editar (canEdit).
 * Timeline proporcional + lista de segmentos detalhada + observação.
 *
 * Apontamentos CANCELLED permanecem visíveis com estilo discreto (099): badge
 * "Cancelado", motivo (note), quem cancelou (canceladoPorNome) e a ação "Restaurar".
 * Esse recuo é feito por SUPERFÍCIE (fundo próprio `--color-background`), nunca por
 * `opacity-*` no card — ver o bloco de `articleClass` para a medição que motivou a troca.
 * Apontamentos DISCARDED (120, D-1 — cancelamento de apontamento COM tempo consolidado)
 * permanecem visíveis SEM esmaecer (o tempo é real, só não fatura — diferente do
 * cancelado, que representa valor zero): badge "Descartado", motivo, quem agiu e
 * "Restaurar" (D-4 — restaurável, nunca beco sem saída).
 */
export function TimeEntryCard({
  entry,
  canEdit,
  onEdit,
  canManage = false,
  onCancel,
  onRestore,
}: TimeEntryCardProps) {
  const pauseCount = entry.segments.filter((s) => s.type === 'PAUSE').length
  const end = entry.endTime
  const crossesDay = end ? formatDate(entry.startTime) !== formatDate(end) : false

  const isCancelled = entry.status.toUpperCase() === 'CANCELLED'
  const isCompleted = entry.status.toUpperCase() === 'COMPLETED'
  // 120/D-1: DISCARDED preserva tempo real (só não fatura) — distinto de CANCELLED
  // (valor zero). Restaurável igual ao cancelado (mesmo botão "Restaurar").
  const isDiscarded = entry.status.toUpperCase() === 'DISCARDED'
  // Decide o rótulo/resultado da ação a partir do tempo, não do status: a ação sempre
  // parte de COMPLETED e o servidor decide CANCELLED (sem tempo) vs DISCARDED (com tempo).
  const hasConsolidatedTime = entry.totalSeconds > 0

  const metaTime = end
    ? `${formatDate(entry.startTime)} · ${formatTime(entry.startTime)} → ${crossesDay ? `${formatDate(end)} ` : ''}${formatTime(end)}`
    : `${formatDate(entry.startTime)} · ${formatTime(entry.startTime)} → em aberto`

  const pauseLabel = pauseCount > 0 ? `${pauseCount} pausa(s)` : 'sem pausa'

  // 125/`Q-1` — CANCELADO RECUA POR SUPERFÍCIE, NUNCA POR OPACIDADE DE GRUPO.
  //
  // Até aqui o card cancelado era `bg-card opacity-70`. `opacity-*` num contêiner cria um
  // GRUPO DE PINTURA: o navegador pinta o card inteiro — fundo, texto E todo filho,
  // inclusive componentes cujos tokens foram calculados para passar AA isoladamente — e
  // compõe **o conjunto** sobre a página. O contraste resultante não é derivável do token,
  // e por isso escapava de qualquer revisão que olhasse cores no CSS. Medido no DOM, os
  // QUATRO badges deste card reprovavam AA (piso 4,5:1) dentro do grupo, com os MESMOS
  // tokens que passam no card ativo logo acima:
  //
  //                             card ativo   dentro do grupo `opacity-70`
  //   "Cancelado"        error-fg    5,24 ✅            3,76 ❌
  //   "Suporte tecnico"  neutro-fg   5,19 ✅            2,86 ❌
  //   "Trabalho"         plano-fg    7,81 ✅            3,81 ❌
  //   "Pausa"            neutro-fg   5,19 ✅            2,86 ❌
  //
  // E a escala de opacidade não tem saída: a primeira parada em que os quatro passam é
  // `opacity-95` (4,68 — margem de 0,18 sobre o piso), um esmaecimento que ninguém enxerga.
  // Esmaecimento forte o bastante para ser VISTO quebra AA. A escala inteira está medida em
  // `.dev-team/demandas/125-contraste-design-system/q1-comparativo-visual.md` §3.1.
  //
  // Decisão do usuário (2026-09-07, alternativa A do comparativo): o cancelado recua pelo
  // FUNDO PRÓPRIO. O texto volta a ser composto contra um fundo conhecido e opaco.
  const articleClass = isCancelled
    ? 'rounded-card border border-border bg-background p-4'
    : 'rounded-card border border-border bg-card p-4'

  // Sem grupo, o token CHEIO no cancelado deixaria o texto dele MAIS forte que o do card
  // ativo — hierarquia invertida. O `/70` volta a valer nos dois estados: 5,47:1 sobre
  // `--color-card` e 5,20:1 sobre `--color-background`, ambos acima do piso.
  //
  // Uma única variável governa os quatro pontos (meta, linha de segmento, duração do
  // segmento e caixa de motivo): substituto por ponto foi como o `/40` da lista de
  // segmentos sobreviveu à correção da linha de meta na 125/FE-A11Y-2.
  const textoSecundario = 'text-foreground/70'
  const metaClass = `mt-1 text-xs ${textoSecundario}`

  // 125/`Q-1` — o custo declarado da alternativa A, e como ele é pago sem voltar à opacidade.
  //
  // `--color-badge-neutro-bg` e `--color-background` são o MESMO valor (#f0f4f7, ver
  // `styles/global.css`). Num card que agora É `--color-background`, tudo que se apoiava no
  // neutro — a pílula "Pausa", a caixa de motivo e o badge de fallback ("Suporte tecnico",
  // "Faturável por fora") — perde a superfície e vira texto solto. A resposta é INVERTER a
  // superfície, não reduzir opacidade: no card recuado o neutro passa a ser `bg-card`.
  //
  // Isso SOBE o contraste em vez de gastá-lo (o texto neutro #666666 mede 5,74:1 sobre
  // #ffffff contra 5,19:1 sobre #f0f4f7) e devolve a pílula ao badge. Uma variável só
  // atravessa os quatro pontos, incluindo a linha do tempo.
  const variante = isCancelled ? 'recuada' : 'padrao'
  const superficieNeutra = isCancelled ? 'bg-card' : 'bg-badge-neutro-bg'

  return (
    <article className={articleClass}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">
              {entry.agenteNome?.trim() ? entry.agenteNome : 'Atendente não informado'}
            </span>
            {entry.status && <Badge value={statusLabel(entry.status)} variante={variante} />}
            {entry.categorizacaoNome && (
              <Badge value={entry.categorizacaoNome} variante={variante} />
            )}
            {entry.billableOutsidePlan && (
              <Badge value="Faturável por fora" variante={variante} />
            )}
          </div>
          <p className={metaClass}>
            {metaTime} · {pauseLabel}
          </p>
        </div>

        <div className="text-right shrink-0">
          <div className="text-lg font-semibold text-foreground">
            {formatSeconds(entry.totalSeconds)}
          </div>
          <div className="mt-0.5 flex items-center justify-end gap-3">
            {/* Editar: bloqueado em cancelados (restaure antes de editar). */}
            {canEdit && !isCancelled && (
              <button
                type="button"
                onClick={() => onEdit(entry)}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary"
              >
                <EditIcon />
                editar
              </button>
            )}
            {/* Cancelar/Descartar: só em COMPLETED e com permissão de gestor. Rótulo dinâmico
                por totalSeconds (120/D-1): com tempo consolidado o resultado é "Descartado"
                (preserva tempo, não fatura); sem tempo, "Cancelado" (comportamento atual). */}
            {canManage && onCancel && isCompleted && (
              <button
                type="button"
                onClick={() => onCancel(entry)}
                aria-label={hasConsolidatedTime ? 'Descartar apontamento' : 'Cancelar apontamento'}
                className="inline-flex items-center gap-1 text-xs text-error-fg hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary"
              >
                {hasConsolidatedTime ? <ArchiveIcon /> : <BanIcon />}
                {hasConsolidatedTime ? 'Descartar apontamento' : 'Cancelar apontamento'}
              </button>
            )}
            {/* Restaurar: em CANCELLED ou DISCARDED, com permissão de gestor (120, D-4:
                Descartado é restaurável — sem beco sem saída). */}
            {canManage && onRestore && (isCancelled || isDiscarded) && (
              <button
                type="button"
                onClick={() => onRestore(entry)}
                aria-label="Restaurar apontamento"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline rounded focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RestoreIcon />
                Restaurar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timeline proporcional */}
      <SegmentTimeline segments={entry.segments} className="mt-3" variante={variante} />

      {/* Segmentos detalhados */}
      {entry.segments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {entry.segments.map((s, idx) => {
            const durMs = new Date(s.segmentEnd).getTime() - new Date(s.segmentStart).getTime()
            const durSec = Number.isNaN(durMs) || durMs < 0 ? 0 : Math.round(durMs / 1000)
            const isWork = s.type === 'WORK'
            return (
              <li
                key={s.id ?? idx}
                className={`flex items-center gap-2 text-xs ${textoSecundario}`}
              >
                <span
                  className={
                    isWork
                      ? 'inline-flex items-center rounded-pill px-2 py-0.5 bg-badge-plano-bg text-badge-plano-fg font-medium'
                      : `inline-flex items-center rounded-pill px-2 py-0.5 ${superficieNeutra} text-badge-neutro-fg font-medium`
                  }
                >
                  {isWork ? 'Trabalho' : 'Pausa'}
                </span>
                <span>
                  {formatTime(s.segmentStart)} → {formatTime(s.segmentEnd)}
                </span>
                {/* 125/FE-A11Y-3 (`A-1`) — era `text-foreground/40`: 2,34:1 no card ativo e
                    1,78:1 dentro do grupo do cancelado, a PIOR reprovação de texto medida
                    fora do `EmptyState`. Herda a classe do `<li>` em vez de escurecer menos
                    que o irmão: dois alfas diferentes na mesma linha foi o que produziu o
                    defeito. */}
                <span>· {formatSeconds(durSec)}</span>
              </li>
            )
          })}
        </ul>
      )}

      {/* Motivo do cancelamento/descarte + quem agiu (099/120) — destacado nos dois casos. */}
      {(isCancelled || isDiscarded) && (
        <div
          // 125/`Q-1` — a caixa destaca-se do card por SUPERFÍCIE, e a superfície depende do
          // card: no DESCARTADO o card é `bg-card` e a caixa é `bg-badge-neutro-bg`; no
          // CANCELADO o card É `bg-background` (o mesmo #f0f4f7 do neutro), então a caixa
          // inverte para `bg-card` — senão ela se funde ao card e só a borda a separa.
          // `/70` mede 5,20:1 sobre o neutro e 5,47:1 sobre o card: passa nos dois.
          className={`mt-2 rounded-input border border-border ${superficieNeutra} px-3 py-2 text-xs ${textoSecundario}`}
        >
          <span className="font-semibold">{isDiscarded ? 'Descartado' : 'Cancelado'}</span>
          {entry.canceladoPorNome ? ` por ${entry.canceladoPorNome}` : ''}
          {entry.note ? ` · Motivo: ${entry.note}` : ''}
        </div>
      )}

      {/* Observação (apontamentos ativos — nos cancelados/descartados a nota vira o motivo acima). */}
      {!isCancelled && !isDiscarded && entry.note && (
        <p className="mt-2 text-sm text-foreground/80">
          <span className="font-semibold">Obs:</span> {entry.note}
        </p>
      )}
    </article>
  )
}
