/**
 * Regras de dado do agregado `GET /api/v1/metrics/plan-health` (Saúde dos Planos).
 *
 * Por que este arquivo existe (demanda 123 / D4): o gráfico ficava **em branco sem erro**
 * porque o tipo do frontend declarava chaves (`totalVerde`…) que o backend nunca emitiu
 * (`verde`…). O Recharts com `dataKey` cujo valor é `undefined` não desenha e não reclama,
 * e o estado vazio testava `!summary` — o objeto existia, só tinha outras chaves.
 *
 * As duas funções abaixo são o guarda-corpo dessa classe de defeito: elas decidem
 * "há dado utilizável?" olhando o **valor** dos campos, não a existência do objeto.
 * Ambas toleram campo ausente e campo `null` (o backend serializa com
 * `DefaultIgnoreCondition = WhenWritingNull`, `Program.cs:107-108`).
 */

import type { PlanHealthItemDto, PlanHealthSummaryDto } from '../types/metrics'

/** Texto presente e não vazio — ausente, `null` e `"   "` são todos "sem texto". */
function temTexto(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.trim() !== ''
}

/**
 * Há saúde de planos para desenhar?
 *
 * Falso quando: não veio `summary`; algum total não é número (é o sintoma de chave de wire
 * divergente — o `typeof` é proposital, o tipo diz `number` mas o wire é que manda); ou
 * `totalClientes === 0` (nenhum cliente com plano no período, que é vazio HONESTO e deve
 * mostrar a mensagem, não três barras zeradas).
 *
 * É type predicate para que o chamador possa ler `summary.verde` depois da guarda sem
 * repetir a checagem de nulo.
 */
export function hasPlanHealthData(
  summary: PlanHealthSummaryDto | null | undefined,
): summary is PlanHealthSummaryDto {
  if (summary == null) return false

  const totais = [summary.totalClientes, summary.verde, summary.amarelo, summary.vermelho]
  if (totais.some((total) => typeof total !== 'number' || !Number.isFinite(total))) {
    return false
  }

  return summary.totalClientes > 0
}

/**
 * A linha tem identificação (cliente ou plano)?
 *
 * Critério de "exportável": planilha sem nenhuma identificação é ilegível — quem recebe o
 * arquivo não tem como saber a que cliente a linha se refere, e planilha errada o gestor
 * **encaminha** (AP-FRONTEND-028). Um cliente sem `nomeFantasia` mas com plano continua
 * exportável; a linha sem os dois, não.
 */
export function isExportablePlanRow(item: PlanHealthItemDto): boolean {
  return temTexto(item.nomeFantasia) || temTexto(item.planNome)
}

/** Há ao menos uma linha exportável no conjunto? Gate do botão de export. */
export function hasExportablePlanRows(itens: readonly PlanHealthItemDto[]): boolean {
  return itens.some(isExportablePlanRow)
}
