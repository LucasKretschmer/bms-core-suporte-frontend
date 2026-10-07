import { durationCell } from '../shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../shared/utils/exportTable'
import type { ProductivityReportItemDto } from '../shared/types/reports'
import { TEXTO_ACIMA_DA_JORNADA, formatNumeroExport } from './productivityFormat'

/**
 * Export da Produtividade por Analista. Durações saem em segundos crus pelo `durationCell`
 * (CSV `H:mm:ss`, XLSX somável). Ausente vira célula vazia em toda coluna; `0` continua valor.
 */
export const PRODUCTIVITY_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Analista', key: 'nome' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendimentos', key: 'nAtendimentos' },
  { header: 'Tickets atendidos', key: 'ticketsAtendidos' },
  { header: 'Média de tickets (3 meses)', key: 'mediaTicketsUltimos3Meses' },
  { header: 'Resolvidos por dia', key: 'mediaResolvidosPorDia' },
  { header: 'Tempo total', key: 'totalSegundos', type: 'duration' },
  { header: 'Horas úteis', key: 'horasUteisSegundos', type: 'duration' },
  { header: 'Tempo médio por ticket', key: 'mediaSegundosPorTicket', type: 'duration' },
  { header: 'Tempo médio por apontamento', key: 'ahtSegundos', type: 'duration' },
  { header: 'Ocioso médio por dia', key: 'mediaOciosoSegundosPorDia', type: 'duration' },
  { header: 'Média de pausas', key: 'mediaPausas' },
  { header: 'Jornada', key: 'jornada' },
]

export function mapToExportRow(item: ProductivityReportItemDto): ExportRow {
  return {
    nome: item.nome,
    equipe: item.equipe ?? '',
    nAtendimentos: item.nAtendimentos,
    ticketsAtendidos: formatNumeroExport(item.ticketsAtendidos),
    mediaTicketsUltimos3Meses: formatNumeroExport(item.mediaTicketsUltimos3Meses, 2),
    mediaResolvidosPorDia: formatNumeroExport(item.mediaResolvidosPorDia, 2),
    totalSegundos: durationCell(item.totalSegundos),
    horasUteisSegundos: durationCell(item.horasUteisSegundos),
    mediaSegundosPorTicket: durationCell(item.mediaSegundosPorTicket),
    ahtSegundos: durationCell(item.ahtSegundos),
    mediaOciosoSegundosPorDia: durationCell(item.mediaOciosoSegundosPorDia),
    mediaPausas: formatNumeroExport(item.mediaPausas, 1),
    jornada: item.extrapolouJornada === true ? TEXTO_ACIMA_DA_JORNADA : '',
  }
}
