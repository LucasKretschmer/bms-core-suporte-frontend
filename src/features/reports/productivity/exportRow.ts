/**
 * 129 — linhas do EXPORT de Produtividade por Analista, extraídas da página para poderem
 * ser TESTADAS.
 *
 * `AgentMetricDto.AhtSegundos` é `long?` e `Equipe` é `string?` (`MetricsDtos.cs:163-170`);
 * o backend serializa com `DefaultIgnoreCondition = WhenWritingNull` e **omite a chave**.
 * O guard antigo (`item.ahtSegundos !== null`) era verdadeiro para a chave ausente e
 * mandava `undefined` para `formatSeconds`, produzindo `"NaNh NaNm"` na planilha.
 *
 * Planilha errada o gestor **encaminha** — o valor sai do sistema e perde rastreabilidade
 * (AP-FRONTEND-028). Por isso o export tem teste próprio, e não herda o da coluna.
 */

import type { ExportColumn, ExportRow } from '../shared/utils/exportTable'
import { formatDecimal, formatSeconds } from '../shared/utils/formatters'
import type { AgentMetricDto } from '../shared/types/reports'

export const PRODUCTIVITY_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Analista', key: 'nome' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendimentos', key: 'nAtendimentos' },
  { header: 'Tempo Total', key: 'totalSegundos' },
  { header: 'AHT (Tempo Médio)', key: 'ahtSegundos' },
  { header: 'Média de Pausas', key: 'mediaPausas' },
]

export function mapToExportRow(item: AgentMetricDto): ExportRow {
  return {
    nome: item.nome,
    // `??` cobre as duas formas de ausente (chave omitida e chave nula).
    equipe: item.equipe ?? '—',
    nAtendimentos: item.nAtendimentos,
    totalSegundos: formatSeconds(item.totalSegundos),
    // 129 — `== null`, nunca `!== null`.
    ahtSegundos: item.ahtSegundos == null ? '—' : formatSeconds(item.ahtSegundos),
    mediaPausas: formatDecimal(item.mediaPausas),
  }
}
