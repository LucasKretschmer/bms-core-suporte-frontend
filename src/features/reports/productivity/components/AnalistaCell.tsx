import type { ProductivityReportItemDto } from '../../shared/types/reports'
import { TEXTO_ACIMA_DA_JORNADA, textoApontadoVersusUteis } from '../productivityFormat'
import { AlertaDeLimite } from './AlertaDeLimite'

type AnalistaCellProps = {
  row: ProductivityReportItemDto
}

/** Nome do analista com o selo de jornada extrapolada. */
export function AnalistaCell({ row }: AnalistaCellProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {row.nome}
      <AlertaDeLimite
        texto={TEXTO_ACIMA_DA_JORNADA}
        detalhe={textoApontadoVersusUteis(row.totalSegundos, row.horasUteisSegundos)}
      />
    </span>
  )
}
