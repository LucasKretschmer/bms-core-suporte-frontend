/**
 * 129 — export de logs do sincronizador, extraído da página para poder ser TESTADO.
 *
 * O motivo da extração é o defeito da demanda 129: o formatador de duração do export
 * (`formatDuracao`, removida na 134/U12 por ficar órfã) guardava com
 * `=== null`, e `LogDto.duracaoMs` é `long?` no backend — que serializa com
 * `DefaultIgnoreCondition = WhenWritingNull` e **omite a chave**. `undefined` atravessava
 * o guard e virava `Math.round(undefined / 1000)` = `NaN`, produzindo `"NaNs"` na planilha.
 *
 * Planilha errada o gestor **encaminha** (AP-FRONTEND-028): o valor sai do sistema e
 * perde rastreabilidade. Enquanto a função vivia dentro de `index.tsx` sem export, o
 * export era o único dos quatro lugares do campo sem teste nenhum.
 */

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  durationCellFromMillis,
  type ExportColumn,
  type ExportRow,
} from '../../reports/shared/utils/exportTable'
import type { LogDto, SyncStatus } from '../types/sincronizador'

export const STATUS_LABEL: Record<SyncStatus, string> = {
  executando: 'Executando',
  concluido: 'Concluído',
  erro: 'Erro',
}

/** Colunas de export dos logs — espelham a LogsTable (sem JSX). */
export const LOGS_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Status', key: 'status' },
  { header: 'Disparo', key: 'disparo' },
  { header: 'Tipo', key: 'tipo' },
  { header: 'Iniciado em', key: 'iniciadoEm' },
  // 134 — coluna de DURAÇÃO: a célula sai numérica (segundos), formatada pelo núcleo
  // ('[h]:mm:ss' no XLSX, 'H:mm:ss' sem módulo 24 no CSV). A ORIGEM AQUI É
  // MILISSEGUNDOS (`LogDto.duracaoMs`) — a conversão é do núcleo, nunca local.
  { header: 'Duração', key: 'duracao', type: 'duration' },
  { header: 'Tickets / Projetos', key: 'contadores' },
  { header: 'Empresas', key: 'empresas' },
  { header: 'Erro', key: 'mensagemErro' },
]

export const TIPO_LABEL: Record<'tickets' | 'empresas', string> = {
  tickets: 'Tickets',
  empresas: 'Empresas',
}

export function formatDateTimeSeconds(iso: string): string {
  try {
    return format(parseISO(iso), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })
  } catch {
    return iso
  }
}

/**
 * 134/U12 — `formatDuracao` foi REMOVIDA aqui (pendência 1 do `tracker.md` para o
 * fechamento). Ela formatava a duração do log como `"2min 5s"` e alimentava o export até a
 * 134 trocar a célula por número (`durationCellFromMillis`). Depois disso ficou **sem
 * nenhum consumidor de produção**: a tela usa `utils/formatDuration` via `DurationLabel`
 * (`LogsTable.tsx` e `index.tsx`), nunca esta função — verificado por varredura do repo
 * antes da remoção, e o único importador restante era o próprio teste.
 * A §7.1 da análise mandava mantê-la, com uma âncora que afirma que ela é a formatação da
 * `LogsTable` — o que **não é verdade**; a divergência está registrada no relatório da U12.
 */
export function mapLogToExportRow(log: LogDto): ExportRow {
  const tipo = log.tipo ?? 'tickets'
  const isEmpresas = tipo === 'empresas'
  return {
    status: STATUS_LABEL[log.status] ?? log.status,
    disparo: log.disparo === 'automatico' ? 'Automático' : 'Manual',
    tipo: TIPO_LABEL[tipo],
    iniciadoEm: formatDateTimeSeconds(log.iniciadoEm),
    // 134 — `duracaoMs` está em MILISSEGUNDOS: o helper certo é
    // `durationCellFromMillis` (ms → segundos). `durationCell` aqui produziria um
    // número plausível e 1000× errado na planilha. O guard `== null` da ausência
    // (AP-FRONTEND-028) mora dentro do helper, não aqui.
    duracao: durationCellFromMillis(log.duracaoMs),
    contadores: isEmpresas
      ? '—'
      : `${log.ticketsUpserted}↑ ${log.ticketsIgnorados}↷ / ${log.projetosUpserted}↑ ${log.projetosIgnorados}↷`,
    empresas: isEmpresas
      ? `${log.empresasCriadas}+ ${log.empresasAtualizadas}~ ${log.empresasDesativadas}−`
      : `${log.empresasResolvidas} / ${log.contatosResolvidos}`,
    mensagemErro: log.mensagemErro ?? '—',
  }
}
