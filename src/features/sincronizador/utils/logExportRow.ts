/**
 * 129 — export de logs do sincronizador, extraído da página para poder ser TESTADO.
 *
 * O motivo da extração é o defeito da demanda 129: `formatDuracao` guardava com
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
import type { ExportColumn, ExportRow } from '../../reports/shared/utils/exportTable'
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
  { header: 'Duração', key: 'duracao' },
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

export function formatDuracao(duracaoMs: number | null | undefined): string {
  // 129 — `== null`: este valor alimenta o EXPORT (CSV/Excel). Com `=== null`, a chave
  // ausente do wire virava `Math.round(undefined / 1000)` = `NaN` e saía "NaNs" numa
  // planilha que o gestor encaminha (AP-FRONTEND-028).
  if (duracaoMs == null) return '—'
  const totalSeconds = Math.round(duracaoMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}min ${seconds}s` : `${seconds}s`
}

export function mapLogToExportRow(log: LogDto): ExportRow {
  const tipo = log.tipo ?? 'tickets'
  const isEmpresas = tipo === 'empresas'
  return {
    status: STATUS_LABEL[log.status] ?? log.status,
    disparo: log.disparo === 'automatico' ? 'Automático' : 'Manual',
    tipo: TIPO_LABEL[tipo],
    iniciadoEm: formatDateTimeSeconds(log.iniciadoEm),
    duracao: formatDuracao(log.duracaoMs),
    contadores: isEmpresas
      ? '—'
      : `${log.ticketsUpserted}↑ ${log.ticketsIgnorados}↷ / ${log.projetosUpserted}↑ ${log.projetosIgnorados}↷`,
    empresas: isEmpresas
      ? `${log.empresasCriadas}+ ${log.empresasAtualizadas}~ ${log.empresasDesativadas}−`
      : `${log.empresasResolvidas} / ${log.contatosResolvidos}`,
    mensagemErro: log.mensagemErro ?? '—',
  }
}
