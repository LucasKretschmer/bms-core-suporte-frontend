import { Badge } from '../../components/ui/Badge'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import {
  formatDateTime,
  formatHours,
  formatMonth,
} from '../reports/shared/utils/formatters'
import { BotaoDeAcao } from './components/BotaoDeAcao'
import {
  ROTULO_DO_ESTADO,
  motivoIndisponivel,
  normalizarEstado,
} from './estadoDaCompetencia'
import type { BillingPeriodDto } from './types/billingPeriod'

type BuildColumnsArgs = {
  onFechar: (periodo: BillingPeriodDto) => void
  onReabrir: (periodo: BillingPeriodDto) => void
  onComparar: (periodo: BillingPeriodDto) => void
  isFechando: boolean
  isReabrindo: boolean
}

/**
 * `null` de um campo da rede é **desconhecido**, nunca zero e nunca "não"
 * (`AP-FRONTEND-028`). O guard é `== null` — `=== undefined` deixaria `null` passar reto e
 * a célula afirmaria um valor que ninguém informou.
 */
const TRACO = '—'

function textoOuTraco(valor: string | null | undefined): string {
  return valor == null || valor.length === 0 ? TRACO : valor
}

function horasOuTraco(valor: number | null | undefined): string {
  return valor == null ? TRACO : formatHours(valor)
}

function numeroOuTraco(valor: number | null | undefined): string {
  return valor == null ? TRACO : String(valor)
}

/**
 * Quem fechou. Aqui `null` tem **dois significados diferentes**, e colapsá-los seria
 * mentir nos dois sentidos:
 *
 * - `fechadaEm == null` ⇒ a competência **não foi fechada** ⇒ `—`;
 * - `fechadaEm` preenchido e `fechadaPorNome == null` ⇒ foi o **processo automático**
 *   (contrato: *"null = processo automático (é o caso normal)"*).
 */
export function autorDoFechamento(periodo: BillingPeriodDto): string {
  if (periodo.fechadaEm == null) return TRACO
  return periodo.fechadaPorNome ?? 'Processo automático'
}

export function buildBillingPeriodColumns({
  onFechar,
  onReabrir,
  onComparar,
  isFechando,
  isReabrindo,
}: BuildColumnsArgs): ColumnDef<BillingPeriodDto>[] {
  return [
    {
      key: 'competencia',
      header: 'Competência',
      align: 'left',
      accessor: (row) => formatMonth(row.competencia),
    },
    {
      key: 'estado',
      header: 'Estado',
      align: 'center',
      width: '150px',
      accessor: (row) => <Badge value={ROTULO_DO_ESTADO[normalizarEstado(row.estado)]} />,
    },
    {
      key: 'fechadaEm',
      header: 'Fechada em',
      align: 'center',
      accessor: (row) => (row.fechadaEm == null ? TRACO : formatDateTime(row.fechadaEm)),
    },
    {
      key: 'fechadaPor',
      header: 'Fechada por',
      align: 'left',
      accessor: (row) => autorDoFechamento(row),
    },
    {
      key: 'reabertaEm',
      header: 'Reaberta em',
      align: 'center',
      accessor: (row) => (row.reabertaEm == null ? TRACO : formatDateTime(row.reabertaEm)),
    },
    {
      key: 'reaberturaMotivo',
      header: 'Motivo da reabertura',
      align: 'left',
      accessor: (row) => textoOuTraco(row.reaberturaMotivo),
    },
    {
      key: 'versao',
      header: 'Versão',
      align: 'center',
      width: '80px',
      accessor: (row) => numeroOuTraco(row.versao),
    },
    {
      key: 'totalClientes',
      header: 'Clientes',
      align: 'center',
      width: '90px',
      accessor: (row) => numeroOuTraco(row.totalClientes),
    },
    {
      key: 'totalHorasAdicionais',
      header: 'Horas adicionais',
      align: 'right',
      accessor: (row) => horasOuTraco(row.totalHorasAdicionais),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'center',
      width: '220px',
      accessor: (row) => {
        const estado = normalizarEstado(row.estado)
        const mes = formatMonth(row.competencia)
        // "Fechar" vira "Refechar" quando a competência está reaberta: é a MESMA rota
        // (`/close`), mas chamar as duas coisas de "fechar" esconderia que o refechamento
        // grava uma versão nova do snapshot (§6.5).
        const rotuloFechar = estado === 'reaberta' ? 'refechar' : 'fechar'
        return (
          <span className="inline-flex items-center justify-center gap-3">
            <BotaoDeAcao
              onClick={() => onFechar(row)}
              ariaLabel={`${rotuloFechar} competência ${mes}`}
              motivoIndisponivel={motivoIndisponivel('fechar', estado)}
              isPending={isFechando}
            >
              {rotuloFechar}
            </BotaoDeAcao>
            <BotaoDeAcao
              onClick={() => onReabrir(row)}
              ariaLabel={`reabrir competência ${mes}`}
              motivoIndisponivel={motivoIndisponivel('reabrir', estado)}
              isPending={isReabrindo}
            >
              reabrir
            </BotaoDeAcao>
            <BotaoDeAcao
              onClick={() => onComparar(row)}
              ariaLabel={`comparar snapshot e cálculo atual da competência ${mes}`}
              motivoIndisponivel={motivoIndisponivel('comparar', estado)}
            >
              comparar
            </BotaoDeAcao>
          </span>
        )
      },
    },
  ]
}
