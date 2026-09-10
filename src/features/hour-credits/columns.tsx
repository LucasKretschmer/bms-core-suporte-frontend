import { AcaoDeTabela, type BloqueioDaAcao } from '../../components/table/AcaoDeTabela'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import { ExternalLinkIcon } from '../../components/ui/ExternalLinkIcon'
import { formatDateTime, formatHours, formatMonth } from '../reports/shared/utils/formatters'
import { CreditoStatusBadge } from './components/CreditoStatusBadge'
import { CREDITO_ESTORNADO_ACAO } from './utils/hourCreditErrorMessage'
import {
  normalizarStatusDoCredito,
  rotuloDaOrigem,
  type HourCreditDto,
} from './types/hourCredit'

type BuildColumnsArgs = {
  onEdit: (credito: HourCreditDto) => void
  onDelete: (credito: HourCreditDto) => void
}

/** Traço de "não sei" — mesmo caractere usado pelos formatadores compartilhados. */
const TRACO = '—'

/**
 * Horas derivadas do servidor (`consumidoHoras`, `perdidoHoras`).
 *
 * 🔴 `== null`, **nunca `=== undefined`**: `null` e chave ausente são o mesmo fato vindo da
 * rede, e `formatHours` sobre `null` imprimiria **`0h 0m`** — afirmando "não consumiu nada"
 * sobre um valor **desconhecido** (`AP-FRONTEND-028`, o defeito literal de
 * `horasEmAbertoNaoFaturadas`).
 */
export function horasDerivadasTexto(horas: number | null | undefined): string {
  if (horas == null) return TRACO
  return formatHours(horas)
}

/**
 * Texto da divergência de snapshot (C-8).
 *
 * `null` ⇒ `'—'`, **nunca `'Não'`**: dizer "não divergiu" sobre um campo que o servidor não
 * mandou é exatamente o `entraNaFatura: null → "Não"` do `AP-FRONTEND-028`.
 */
export function divergenciaTexto(divergente: boolean | null | undefined): string {
  if (divergente == null) return TRACO
  return divergente ? 'Divergente' : 'Não'
}

/** `"YYYY-MM"` ⇒ `"Setembro 2026"`; ausente ⇒ `'—'`. */
export function competenciaTexto(competencia: string | null | undefined): string {
  if (competencia == null || competencia === '') return TRACO
  return formatMonth(competencia)
}

/**
 * Colunas da tabela de Créditos de Horas (132/F5).
 *
 * ⚠️ `sortKey` só usa nomes da whitelist do backend (`analise-backend.md` §7.2):
 * `criadoem`, `horas`, `competencia`, `competenciaorigem`, `clientenome`, `origem`. Fora
 * dela a resposta é `400` na borda — por isso **`status` não é ordenável** (é derivado, e o
 * backend recomendou não inventar ordem para ele).
 *
 * D15: `motivoNome` aparece **completo** — tela `GerentePlus`.
 */
export function buildHourCreditColumns({
  onEdit,
  onDelete,
}: BuildColumnsArgs): ColumnDef<HourCreditDto>[] {
  return [
    {
      key: 'cliente',
      header: 'Cliente',
      align: 'left',
      sortable: true,
      sortKey: 'clientenome',
      // `formatClientName` não serve: o DTO traz `clienteNome` já resolvido pelo servidor,
      // sem `nomeFantasia`/`razaoSocial` para escolher.
      accessor: (row) => (
        <div className="flex flex-col">
          <span className="text-foreground">{row.clienteNome ?? TRACO}</span>
          {row.cnpj != null && row.cnpj !== '' && (
            <span className="text-xs text-foreground/70">{row.cnpj}</span>
          )}
        </div>
      ),
    },
    {
      key: 'horas',
      header: 'Horas',
      align: 'right',
      width: '110px',
      sortable: true,
      sortKey: 'horas',
      accessor: (row) => <span className="text-foreground">{formatHours(row.horas)}</span>,
    },
    {
      key: 'competencia',
      header: 'Competência',
      align: 'left',
      width: '150px',
      sortable: true,
      sortKey: 'competencia',
      accessor: (row) => competenciaTexto(row.competencia),
    },
    {
      key: 'competenciaOrigem',
      header: 'Competência de origem',
      align: 'left',
      width: '170px',
      sortable: true,
      sortKey: 'competenciaorigem',
      accessor: (row) => competenciaTexto(row.competenciaOrigem),
    },
    {
      key: 'origem',
      header: 'Origem',
      align: 'center',
      width: '120px',
      sortable: true,
      sortKey: 'origem',
      accessor: (row) => (
        <span className="text-foreground/80">{rotuloDaOrigem(row.origem)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '120px',
      accessor: (row) => <CreditoStatusBadge status={row.status} />,
    },
    {
      key: 'motivo',
      header: 'Motivo',
      align: 'left',
      accessor: (row) => <span className="text-foreground">{row.motivoNome ?? TRACO}</span>,
    },
    {
      key: 'chamado',
      header: 'Chamado',
      align: 'left',
      width: '130px',
      accessor: (row) => {
        if (row.hubspotTicketId == null || row.hubspotTicketId === '') return TRACO
        // A URL vem do servidor. Montá-la aqui seria URL hardcoded (`CLAUDE.md`), e sem ela
        // o número continua visível — o link é que não existe.
        if (row.hubspotUrl == null || row.hubspotUrl === '') {
          return <span>#{row.hubspotTicketId}</span>
        }
        return (
          <a
            href={row.hubspotUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={`Abrir chamado ${row.hubspotTicketId} no HubSpot`}
            className="inline-flex items-center text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded"
            onClick={(e) => e.stopPropagation()}
          >
            #{row.hubspotTicketId}
            <ExternalLinkIcon />
          </a>
        )
      },
    },
    {
      key: 'consumido',
      header: 'Consumido',
      align: 'right',
      width: '120px',
      accessor: (row) => horasDerivadasTexto(row.consumidoHoras),
    },
    {
      key: 'perdido',
      header: 'Perdido',
      align: 'right',
      width: '110px',
      accessor: (row) => horasDerivadasTexto(row.perdidoHoras),
    },
    {
      key: 'divergente',
      header: 'Divergente',
      align: 'center',
      width: '130px',
      headerInfo:
        'Marcado quando o refechamento da competência recalculou um valor diferente do que este crédito registrou.',
      accessor: (row) => {
        const texto = divergenciaTexto(row.divergenteDoSnapshot)
        if (row.divergenteDoSnapshot !== true) {
          return <span className="text-foreground/70">{texto}</span>
        }
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-warning-bg text-warning-fg">
            {texto}
          </span>
        )
      },
    },
    {
      key: 'criado',
      header: 'Criado em',
      align: 'left',
      width: '170px',
      sortable: true,
      sortKey: 'criadoem',
      accessor: (row) => (
        <div className="flex flex-col">
          <span className="text-foreground">{formatDateTime(row.criadoEm)}</span>
          {/* `criadoPorNome == null` = criado pelo processo automático
              (`arquitetura.md` §11.4: "null = sistema"). */}
          <span className="text-xs text-foreground/70">{row.criadoPorNome ?? 'Sistema'}</span>
        </div>
      ),
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'center',
      width: '210px',
      accessor: (row) => {
        // Só o `estornado` bloqueia: é o que o servidor recusa com `409 CREDITO_ESTORNADO`
        // (`arquitetura.md:920`). Status desconhecido NÃO bloqueia — quem decide é o
        // servidor, e bloquear por desconhecimento esconderia uma ação legítima.
        const estornado = normalizarStatusDoCredito(row.status) === 'estornado'
        const motivoId = `credito-estornado-${row.id}`
        const bloqueio: BloqueioDaAcao | null = estornado
          ? { motivo: CREDITO_ESTORNADO_ACAO, motivoId }
          : null

        return (
          <div className="flex flex-col items-center gap-1">
            <span className="inline-flex items-center justify-center gap-2">
              <AcaoDeTabela
                aria-label={`Editar crédito de ${row.clienteNome ?? 'cliente'}`}
                onClick={() => onEdit(row)}
                bloqueio={bloqueio}
              >
                editar
              </AcaoDeTabela>
              <AcaoDeTabela
                aria-label={`Excluir crédito de ${row.clienteNome ?? 'cliente'}`}
                onClick={() => onDelete(row)}
                tom="danger"
              >
                excluir
              </AcaoDeTabela>
            </span>
            {estornado && (
              <p id={motivoId} className="text-xs text-foreground/70 text-left">
                {CREDITO_ESTORNADO_ACAO}
              </p>
            )}
          </div>
        )
      },
    },
  ]
}
