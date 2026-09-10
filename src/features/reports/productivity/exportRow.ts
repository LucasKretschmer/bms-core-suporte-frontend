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
 *
 * 134 (S10) — as duas colunas de duração (`Tempo Total`, `AHT`) deixaram de sair
 * pré-formatadas (`"2h 44m"`, texto) e passam a sair como **segundos crus**, pela
 * conversão central do núcleo: CSV vira `H:mm:ss` (sem módulo 24) e XLSX vira número
 * com `numFmt '[h]:mm:ss'` — somável na planilha. O guard de ausência mora dentro de
 * `durationCell` (`== null`, nunca `=== undefined`), num ponto só, e `null` vira célula
 * VAZIA: vazio não afirma nada, `0` afirmaria "não houve tempo". `0` segundo continua
 * sendo valor (`00:00:00`), não ausência.
 *
 * A TELA não muda: `productivityColumns` (`columns.ts:46,57`) continua chamando
 * `formatSeconds` e exibindo `2h 44m`.
 */

import { durationCell } from '../shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../shared/utils/exportTable'
import { formatDecimal } from '../shared/utils/formatters'
import type { AgentMetricDto } from '../shared/types/reports'

export const PRODUCTIVITY_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Analista', key: 'nome' },
  { header: 'Equipe', key: 'equipe' },
  { header: 'Atendimentos', key: 'nAtendimentos' },
  { header: 'Tempo Total', key: 'totalSegundos', type: 'duration' },
  { header: 'AHT (Tempo Médio)', key: 'ahtSegundos', type: 'duration' },
  { header: 'Média de Pausas', key: 'mediaPausas' },
]

export function mapToExportRow(item: AgentMetricDto): ExportRow {
  return {
    nome: item.nome,
    // `??` cobre as duas formas de ausente (chave omitida e chave nula).
    equipe: item.equipe ?? '—',
    nAtendimentos: item.nAtendimentos,
    // 134 — segundos crus. O `== null` do guard antigo não sumiu: mudou de lugar,
    // para dentro de `durationCell` (um ponto só, em vez de 27 call sites).
    totalSegundos: durationCell(item.totalSegundos),
    ahtSegundos: durationCell(item.ahtSegundos),
    mediaPausas: formatDecimal(item.mediaPausas),
  }
}
