import type { ColumnDef } from '../../components/ui/DataTable/types'
import type { CalendarOptionDto, SupportPlanDto } from './types/supportPlan'
import {
  formatCalendario,
  formatHorasMes,
  formatHubspotValor,
  formatPrecoHoraExtra,
  formatSlaMeta,
  temVinculoFragil,
} from './utils/planFormatters'

type BuildColumnsArgs = {
  onEdit: (plan: SupportPlanDto) => void
  /** Opções de calendário para traduzir `calendarioId` em nome. Vazio enquanto BE-F2F3 não existir. */
  calendarios: readonly CalendarOptionDto[]
  /** `false` para CoordenadorPlus que não é GerentePlus — o `PUT` exige GerentePlus. */
  podeEditar: boolean
}

const acaoClassName =
  'text-xs font-medium hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded px-1 disabled:opacity-50'

/**
 * Colunas da tabela de planos de suporte (124/F1).
 *
 * A coluna "Identificador do HubSpot" **não é decoração**: enquanto ela estiver vazia, o
 * vínculo cliente↔plano é resolvido pelo NOME (`CompanySyncService.cs:330-341`) e
 * renomear o plano desvincula os clientes (R-1). Por isso a linha nessa condição — e
 * **com clientes vinculados** — ganha marcação visível, com o motivo escrito por extenso
 * no `title`, e não só uma cor (cor sozinha não é informação acessível).
 */
export function buildSupportPlanColumns({
  onEdit,
  calendarios,
  podeEditar,
}: BuildColumnsArgs): ColumnDef<SupportPlanDto>[] {
  return [
    {
      key: 'nome',
      header: 'Plano',
      align: 'left',
      accessor: (row) => (
        // `/70` sobre o card = 5,47:1 (AA). O `/50` daqui media 3,04:1 e REPROVAVA
        // (QA 124 D-3) — a distincao ativo/inativo continua, agora legivel.
        <span className={row.isActive ? 'text-foreground' : 'text-foreground/70'}>{row.nome}</span>
      ),
    },
    {
      key: 'horasMes',
      header: 'Horas/mês',
      align: 'right',
      width: '110px',
      accessor: (row) => formatHorasMes(row.horasMes),
    },
    {
      key: 'precoHoraExtra',
      header: 'Hora extra',
      align: 'right',
      width: '130px',
      accessor: (row) => formatPrecoHoraExtra(row.precoHoraExtra, row.moeda),
    },
    {
      key: 'hubspotValor',
      header: 'Identificador do HubSpot',
      headerInfo:
        'Valor que o HubSpot envia em sla__plano_de_suporte_contratado. Enquanto estiver vazio, o cliente é associado pelo NOME do plano.',
      align: 'left',
      accessor: (row) => {
        if (!temVinculoFragil(row)) {
          return <span className="text-foreground/70">{formatHubspotValor(row.hubspotValor)}</span>
        }
        return (
          <span
            // Texto em `foreground` sobre `warning-bg`, NÃO em `warning-fg`: o par
            // `--color-warning-fg` (#e07600) sobre `--color-warning-bg` (#fffbef) mede
            // **3.00:1** e reprova AA (AP-FRONTEND-018, e o comentário de
            // `styles/global.css:118-127` proíbe reusá-lo como texto). `#002f4f` sobre
            // `#fffbef` mede 13.36:1.
            className="inline-flex items-center gap-1.5 rounded-control bg-warning-bg px-2 py-0.5 text-foreground"
            title={`Sem identificador: os ${row.clientesVinculados} clientes deste plano são associados pelo nome. Renomear o plano desvincularia todos.`}
          >
            <svg aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>Não preenchido</span>
          </span>
        )
      },
    },
    {
      key: 'slaPrimeiroAtendimentoMinutos',
      header: 'Meta 1º atendimento',
      headerInfo:
        'Meta de SLA do primeiro atendimento. Sem valor, o plano herda a meta padrão do calendário; "Isento" tira os chamados do plano do indicador.',
      align: 'left',
      width: '190px',
      accessor: (row) => formatSlaMeta(row),
    },
    {
      key: 'calendarioId',
      header: 'Calendário',
      align: 'left',
      width: '160px',
      accessor: (row) => formatCalendario(row.calendarioId, calendarios),
    },
    {
      key: 'clientesVinculados',
      header: 'Clientes',
      align: 'right',
      width: '100px',
      accessor: (row) => row.clientesVinculados,
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'center',
      width: '100px',
      accessor: (row) =>
        podeEditar ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(row)
            }}
            aria-label={`Editar plano ${row.nome}`}
            className={`text-primary ${acaoClassName}`}
          >
            editar
          </button>
        ) : null,
    },
  ]
}
