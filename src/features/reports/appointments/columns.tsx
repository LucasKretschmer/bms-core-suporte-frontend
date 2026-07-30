/**
 * Colunas da tabela U4 — Apontamentos por Ticket.
 *
 * Whitelist de sortBy (backend): hubspotticketid, assunto, cliente, equipe, owner, status, tempo, apontamentos
 * (as colunas novas — tempoTotal/apontamentosTotal/categoriasTimer — não estão na
 * whitelist do backend; ver §10 da arquitetura. Ajustar `sortable`/`sortKey` se o
 * backend passar a expor sortKey para elas.)
 *
 * Coluna "Ticket": exibe o hubspotTicketId. Links HubSpot com rel="noopener noreferrer".
 * Tempo zero: exibido como "0h 0m" — tickets sem apontamento aparecem normalmente.
 * Status: Badge dinâmico, cor por `statusCategoria` (MELH-01/D5) — fallback neutro
 * para valores desconhecidos/null, nunca quebra.
 *
 * CORR-05 (D1): as colunas "Tempo"/"Apontamentos" (do período) ganham um indicador
 * quando há apontamentos fora do período filtrado (`*AllTime` > valor do período) —
 * "dado sumindo em silêncio" era o cerne da queixa do QA. As colunas "Tempo total"/
 * "Apontamentos (total)" são aditivas e sempre visíveis, alimentadas pela regra
 * canônica (DesativadoEm IS NULL + Status NOT IN (Cancelled, Discarded), sem recorte
 * de período — 120/D-1 amplia a exclusão para também não contar apontamentos
 * descartados, por paridade com o KPI do detalhe do ticket).
 */

import { Badge } from '../../../components/ui/Badge'
import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { TicketReportItemDto } from '../shared/types/reports'
import { formatSeconds } from '../shared/utils/formatters'
import { INVOICY_CATEGORY } from '../../ticket-detail/constants'
import { statusTone } from './statusColors'

/**
 * Ícone de link externo — aria-hidden pois o texto do link já é descritivo.
 */
function ExternalLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="inline-block ml-1 h-3 w-3 text-foreground/50 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  )
}

/**
 * Indicador de "dado fora do período" (D1/CORR-05). Ícone `aria-hidden` + texto
 * para leitor de tela (`sr-only`) + `title` para mouse — acessível tanto por
 * hover quanto por leitor de tela (nunca depende só de hover).
 */
function PeriodGapHint({ message }: { message: string }) {
  return (
    <span className="inline-flex items-center ml-1" title={message}>
      <svg
        aria-hidden="true"
        className="h-3 w-3 text-warning-fg shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10A8 8 0 112 10a8 8 0 0116 0zM9 9a1 1 0 112 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z"
          clipRule="evenodd"
        />
      </svg>
      <span className="sr-only">{message}</span>
    </span>
  )
}

/** Quantidade máxima de chips visíveis antes do overflow "+N" (MELH-02/D6). */
const MAX_VISIBLE_CATEGORIA_CHIPS = 2

/**
 * Chips da coluna "Categoria do atendimento" (MELH-02). Overflow "+N" com
 * `title` listando as categorias ocultas; container com `title` da lista
 * completa (mouse); nunca só cor — sempre texto.
 *
 * Não exportado (react-refresh/only-export-components — este arquivo só
 * exporta `buildAppointmentsColumns`, uma factory, não um componente).
 * Cobertura de teste via `accessor` da coluna 'categoriasTimer' (columns.test.tsx).
 */
function CategoriaTimerChips({ categorias }: { categorias: string[] }) {
  if (categorias.length === 0) return <span className="text-foreground/40">—</span>

  const visible = categorias.slice(0, MAX_VISIBLE_CATEGORIA_CHIPS)
  const hidden = categorias.slice(MAX_VISIBLE_CATEGORIA_CHIPS)

  return (
    <div className="flex flex-wrap items-center gap-1" title={categorias.join(', ')}>
      {visible.map((c) => (
        <span
          key={c}
          className="inline-block rounded-full bg-badge-neutro-bg text-badge-neutro-fg px-2 py-0.5 text-[11px] leading-none"
        >
          {c}
        </span>
      ))}
      {hidden.length > 0 && (
        <span
          className="inline-block rounded-full bg-badge-neutro-bg text-badge-neutro-fg px-2 py-0.5 text-[11px] leading-none"
          title={hidden.join(', ')}
        >
          +{hidden.length}
        </span>
      )}
    </div>
  )
}

export function buildAppointmentsColumns(): ColumnDef<TicketReportItemDto>[] {
  return [
    {
      key: 'ticket',
      header: 'Ticket',
      sortable: true,
      sortKey: 'hubspotticketid',
      align: 'left',
      width: '120px',
      accessor: (row) => {
        if (row.hubspotUrl) {
          return (
            <a
              href={row.hubspotUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={`Abrir ticket ${row.hubspotTicketId} no HubSpot`}
              className="inline-flex items-center text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded"
              onClick={(e) => e.stopPropagation()}
            >
              #{row.hubspotTicketId}
              <ExternalLinkIcon />
            </a>
          )
        }
        return <span>#{row.hubspotTicketId}</span>
      },
    },
    {
      key: 'assunto',
      header: 'Assunto',
      sortable: true,
      sortKey: 'assunto',
      align: 'left',
      accessor: (row) => row.assunto ?? '—',
    },
    {
      key: 'cliente',
      header: 'Cliente',
      sortable: true,
      sortKey: 'cliente',
      align: 'left',
      // D2: `??` só cobre null/undefined — string vazia/whitespace (ex.: NomeFantasia
      // = "") ficaria em branco silenciosamente. `?.trim() || '—'` cobre os 3 casos.
      accessor: (row) => row.clienteNome?.trim() || '—',
    },
    {
      key: 'equipe',
      header: 'Equipe',
      sortable: true,
      sortKey: 'equipe',
      align: 'left',
      accessor: (row) => row.equipe ?? '—',
    },
    {
      key: 'owner',
      header: 'Atendente',
      sortable: true,
      sortKey: 'owner',
      align: 'left',
      accessor: (row) => row.ownerNome ?? '—',
    },
    {
      // Categoria do HubSpot — exibida só na tela (nunca no export, por privacidade).
      // Renomeada (D6) para desambiguar de "Categoria do atendimento" (MELH-02).
      // `key` permanece 'categoria' (não é query param, só chave de coluna).
      key: 'categoria',
      header: 'Categoria (HubSpot)',
      sortable: false,
      align: 'left',
      accessor: (row) => row.categoria ?? '—',
    },
    {
      // MELH-02/D6 — categoria do TIMER (interna), distinta da do HubSpot acima.
      key: 'categoriasTimer',
      header: 'Categoria do atendimento',
      headerInfo: 'Categorias dos apontamentos dentro do período selecionado (mesma janela da coluna Tempo).',
      sortable: false, // não está na whitelist de sortBy do backend
      align: 'left',
      width: '180px',
      accessor: (row) => <CategoriaTimerChips categorias={row.categoriasTimer} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortKey: 'status',
      align: 'center',
      width: '160px',
      // Status pode vir como label longo do backend (ex.: "Em atendimento (Relacionamento BR)").
      // Truncamos com reticências + tooltip (title) para não estourar a largura da coluna.
      // Cor por statusCategoria (MELH-01/D5) — Invoicy (107) tem prioridade sobre a categoria.
      accessor: (row) => {
        if (!row.status) return <span className="text-foreground/40">—</span>
        const isInvoicy = row.categoria === INVOICY_CATEGORY
        const tone = statusTone(row.statusCategoria, isInvoicy)
        return (
          <div className="flex justify-center">
            <Badge value={row.status} truncate className="max-w-[140px]" style={tone} />
          </div>
        )
      },
    },
    {
      key: 'tempo',
      header: 'Tempo',
      headerInfo:
        'Tempo apontado dentro do período selecionado. Veja "Tempo total" para o tempo sem recorte de período (exclui apontamentos cancelados e descartados).',
      sortable: true,
      sortKey: 'tempo',
      align: 'right',
      width: '110px',
      accessor: (row) => {
        const hasGap = row.totalSecondsAllTime > row.totalSeconds
        return (
          <span className="inline-flex items-center">
            {formatSeconds(row.totalSeconds)}
            {hasGap && (
              <PeriodGapHint
                message={`Há apontamentos fora do período selecionado. Tempo total (sem recorte): ${formatSeconds(row.totalSecondsAllTime)}.`}
              />
            )}
          </span>
        )
      },
    },
    {
      // CORR-05/D1 — aditiva, sempre visível: regra canônica sem recorte de período.
      key: 'tempoTotal',
      header: 'Tempo total',
      headerInfo: 'Tempo total de todos os apontamentos do ticket, sem recorte de período. Exclui apontamentos cancelados e descartados.',
      sortable: false, // não está na whitelist de sortBy do backend
      align: 'right',
      width: '110px',
      accessor: (row) => formatSeconds(row.totalSecondsAllTime),
    },
    {
      key: 'apontamentos',
      header: 'Apontamentos',
      headerInfo:
        'Apontamentos dentro do período selecionado. Veja "Apontamentos (total)" para a contagem sem recorte de período (exclui apontamentos cancelados e descartados).',
      sortable: true,
      sortKey: 'apontamentos',
      align: 'right',
      width: '130px',
      accessor: (row) => {
        const hasGap = row.apontamentosCountAllTime > row.apontamentosCount
        return (
          <span className="inline-flex items-center">
            {row.apontamentosCount}
            {hasGap && (
              <PeriodGapHint
                message={`Há apontamentos fora do período selecionado. Total (sem recorte): ${row.apontamentosCountAllTime}.`}
              />
            )}
          </span>
        )
      },
    },
    {
      // CORR-05/D1 — aditiva, sempre visível: regra canônica sem recorte de período.
      key: 'apontamentosTotal',
      header: 'Apontamentos (total)',
      headerInfo: 'Total de apontamentos do ticket, sem recorte de período. Exclui apontamentos cancelados e descartados.',
      sortable: false, // não está na whitelist de sortBy do backend
      align: 'right',
      width: '150px',
      accessor: (row) => row.apontamentosCountAllTime,
    },
  ]
}
