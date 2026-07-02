/**
 * Consolidação client-side do Relatório do Cliente (096).
 *
 * Recebe a lista COMPLETA de apontamentos (`ClientReportItemDto`, buscada em todas
 * as páginas via `fetchAllForExport`) e retorna 1 linha por CHAMADO, com as mesmas
 * colunas do relatório detalhado.
 *
 * Regras (decididas pelo usuário — 096):
 *  - Agrupar por chamado: ticket → por `ticketId`; projeto → por `projetoId`.
 *  - Tempo = SOMA de `totalSegundos`.
 *  - Atendente (coluna) = `donoChamado` (dono do chamado). Se null (ex.: projeto sem
 *    owner, ou backend local sem o campo) → fallback: atendentes distintos por vírgula.
 *  - Categorização / Serviço = a do apontamento MAIS RECENTE (maior `dataApontamento`).
 *  - Faturamento = valores distintos juntados por vírgula (se todos iguais → único).
 *  - Data do apontamento = intervalo (menor–maior) dos apontamentos do chamado.
 *  - Invariantes (Origem, Ticket/Projeto, Nome, Equipe, Solicitante, Abertura) = do
 *    chamado (tomadas do apontamento mais recente para desempate determinístico).
 *
 * PRIVACIDADE: nenhum campo novo é introduzido — apenas agrega o que já existe no DTO
 * (que nunca contém a categoria do HubSpot).
 */

import type {
  ClientReportItemDto,
  FaturamentoStatus,
  OrigemApontamento,
  RequesterDto,
} from '../../shared/types/reports'

/**
 * Linha consolidada — 1 por chamado. Mantém a mesma forma consumível do
 * `ClientReportItemDto` para reusar colunas/geração de PDF, com os campos agregados.
 */
export type ConsolidatedClientReportRow = {
  /** Chave sintética estável do chamado (ex.: "ticket:123" / "projeto:45"). */
  chaveChamado: string
  origem: OrigemApontamento
  ticketId: number | null
  hubspotTicketId: string | null
  projetoId: number | null
  projetoNome: string | null
  stage: string | null
  assunto: string | null
  equipeAtribuida: string | null
  solicitante: RequesterDto | null
  /** Dono do chamado, ou fallback de atendentes distintos por vírgula. */
  atendente: string
  /** Categorização do apontamento mais recente do chamado. */
  categorizacaoAtendimento: string | null
  /** Valores de faturamento distintos juntados por vírgula. */
  faturamento: string
  aberturaDosChamado: string | null
  /** Data do apontamento mais antigo (ISO). Null se o chamado não tiver apontamentos. */
  dataApontamentoInicio: string | null
  /** Data do apontamento mais recente (ISO). */
  dataApontamentoFim: string | null
  /** Soma dos segundos de todos os apontamentos do chamado. */
  totalSegundos: number
  /** Quantidade de apontamentos agregados. */
  apontamentosCount: number
}

/**
 * Chave de agrupamento por chamado. Ticket → ticketId; projeto → projetoId.
 * Fallbacks defensivos garantem que linhas sem id não colidam entre si nem com outros.
 */
function buildChaveChamado(item: ClientReportItemDto): string {
  if (item.origem === 'projeto') {
    return item.projetoId != null
      ? `projeto:${item.projetoId}`
      : `projeto:sem-id:${item.timeEntryId}`
  }
  return item.ticketId != null
    ? `ticket:${item.ticketId}`
    : `ticket:sem-id:${item.timeEntryId}`
}

/** Compara ISO dates de forma segura; retorna timestamp ou NaN. */
function toTimestamp(iso: string | null): number {
  if (!iso) return Number.NaN
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? Number.NaN : t
}

/**
 * Consolida a lista completa de apontamentos em linhas por chamado.
 * A ordem de saída preserva a ordem de primeira aparição de cada chamado na entrada.
 */
export function consolidateClientReport(
  items: ClientReportItemDto[],
): ConsolidatedClientReportRow[] {
  const groups = new Map<string, ClientReportItemDto[]>()
  const order: string[] = []

  for (const item of items) {
    const chave = buildChaveChamado(item)
    const bucket = groups.get(chave)
    if (bucket) {
      bucket.push(item)
    } else {
      groups.set(chave, [item])
      order.push(chave)
    }
  }

  return order.map((chave) => {
    const group = groups.get(chave)!

    // Apontamento mais recente (maior dataApontamento) — fonte das invariantes e
    // da categorização/serviço. Desempate estável: mantém o primeiro encontrado.
    let latest = group[0]
    let latestTs = toTimestamp(latest.dataApontamento)
    for (const item of group) {
      const ts = toTimestamp(item.dataApontamento)
      if (!Number.isNaN(ts) && (Number.isNaN(latestTs) || ts > latestTs)) {
        latest = item
        latestTs = ts
      }
    }

    // Tempo = soma
    const totalSegundos = group.reduce((acc, it) => acc + it.totalSegundos, 0)

    // Intervalo de datas (menor–maior)
    let minTs = Number.POSITIVE_INFINITY
    let maxTs = Number.NEGATIVE_INFINITY
    let dataApontamentoInicio: string | null = null
    let dataApontamentoFim: string | null = null
    for (const it of group) {
      const ts = toTimestamp(it.dataApontamento)
      if (Number.isNaN(ts)) continue
      if (ts < minTs) {
        minTs = ts
        dataApontamentoInicio = it.dataApontamento
      }
      if (ts > maxTs) {
        maxTs = ts
        dataApontamentoFim = it.dataApontamento
      }
    }

    // Atendente = donoChamado; fallback = atendentes distintos por vírgula
    const dono = latest.donoChamado?.trim()
    let atendente: string
    if (dono) {
      atendente = dono
    } else {
      const distinctAtendentes = [
        ...new Set(
          group
            .map((it) => it.atendente?.trim())
            .filter((v): v is string => !!v),
        ),
      ]
      atendente = distinctAtendentes.join(', ')
    }

    // Faturamento = valores distintos por vírgula (único se todos iguais)
    const distinctFaturamento = [
      ...new Set(group.map((it) => it.faturamento as FaturamentoStatus)),
    ]
    const faturamento = distinctFaturamento.join(', ')

    return {
      chaveChamado: chave,
      origem: latest.origem,
      ticketId: latest.ticketId,
      hubspotTicketId: latest.hubspotTicketId,
      projetoId: latest.projetoId,
      projetoNome: latest.projetoNome,
      stage: latest.stage,
      assunto: latest.assunto,
      equipeAtribuida: latest.equipeAtribuida,
      solicitante: latest.solicitante,
      atendente,
      categorizacaoAtendimento: latest.categorizacaoAtendimento,
      faturamento,
      aberturaDosChamado: latest.aberturaDosChamado,
      dataApontamentoInicio,
      dataApontamentoFim,
      totalSegundos,
      apontamentosCount: group.length,
    }
  })
}
