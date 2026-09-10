import { DataTable } from '../../../components/ui/DataTable/DataTable'
import type { ColumnDef } from '../../../components/ui/DataTable/types'
import {
  CAMPOS_COMPARADOS,
  campoEstaDivergente,
  camposDivergentesDesconhecidos,
  formatarCampoComparado,
  rotuloDeDivergencia,
  type CampoComparado,
} from '../comparacao'
import { ROTULO_DO_CAMPO } from '../competenciaTelaTextos'
import type { BillingPeriodComparisonItemDto } from '../types/billingPeriod'

type ComparacaoTableProps = {
  itens: BillingPeriodComparisonItemDto[]
}

/**
 * Célula de um campo comparado.
 *
 * Sem divergência: um valor só — o do snapshot, que é o que foi faturado.
 * Com divergência: os **dois** valores, marcados com glifo (`≠`) e texto, nunca só por
 * cor (WCAG 1.4.1), e com `aria-label` dizendo qual é qual — `"15h 0m no snapshot,
 * 16h 0m ao vivo"` é legível; `"15h 0m → 16h 0m"` lido em voz alta, não.
 */
function CelulaComparada({
  item,
  campo,
}: {
  item: BillingPeriodComparisonItemDto
  campo: CampoComparado
}) {
  const doSnapshot = formatarCampoComparado(campo, item.snapshot)
  const aoVivo = formatarCampoComparado(campo, item.aoVivo)

  if (!campoEstaDivergente(item, campo)) {
    return <span>{doSnapshot}</span>
  }

  return (
    <span
      data-divergente="true"
      className="inline-flex items-center gap-1 font-medium text-warning-fg"
      aria-label={`${ROTULO_DO_CAMPO[campo]}: ${doSnapshot} no snapshot, ${aoVivo} no cálculo atual — divergente`}
    >
      <span aria-hidden="true">≠</span>
      <span>
        {doSnapshot} / {aoVivo}
      </span>
    </span>
  )
}

function buildComparacaoColumns(): ColumnDef<BillingPeriodComparisonItemDto>[] {
  return [
    {
      key: 'cliente',
      header: 'Cliente',
      align: 'left',
      accessor: (row) => row.clienteNome ?? '—',
    },
    {
      key: 'temDivergencia',
      header: 'Divergência',
      align: 'center',
      width: '110px',
      accessor: (row) => rotuloDeDivergencia(row),
    },
    // As nove colunas são DERIVADAS da lista nominal do contrato — nunca redigitadas.
    ...CAMPOS_COMPARADOS.map<ColumnDef<BillingPeriodComparisonItemDto>>((campo) => ({
      key: campo,
      header: ROTULO_DO_CAMPO[campo],
      align: 'right',
      accessor: (row) => <CelulaComparada item={row} campo={campo} />,
    })),
  ]
}

/**
 * A tabela da comparação de auditoria: snapshot × cálculo atual, cliente a cliente.
 * Cada célula mostra o valor do snapshot; onde o **servidor** apontou divergência, mostra
 * os dois. A tela não altera nada — é leitura.
 */
export function ComparacaoTable({ itens }: ComparacaoTableProps) {
  const desconhecidos = camposDivergentesDesconhecidos(itens)

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-card rounded-card border border-border overflow-hidden">
        <DataTable
          tableId="billing-period-comparison"
          columns={buildComparacaoColumns()}
          data={itens}
        />
      </div>
      {desconhecidos.length > 0 && (
        <p role="status" className="text-xs text-foreground">
          O servidor apontou divergência em campos que esta tela ainda não exibe:{' '}
          {desconhecidos.join(', ')}. Atualize o painel para vê-los.
        </p>
      )}
    </div>
  )
}
