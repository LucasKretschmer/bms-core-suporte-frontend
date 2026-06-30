/**
 * Colunas da tabela 057 — Apontamentos por Projeto.
 *
 * Whitelist de sortBy (backend, GET /reports/project-appointments):
 *   inicioem | totalsegundos | projeto | atendente
 * Colunas fora dessa whitelist ficam sortable:false (não forjamos sort client-side — 053).
 *
 * PRIVACIDADE: nunca exibe hubspotTicketId nem categoria do HubSpot — o DTO project-centric
 * não contém esses campos (garantia em tempo de tipo).
 */

import { Badge } from '../../../components/ui/Badge'
import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { ProjectAppointmentReportItemDto } from '../shared/types/reports'
import { formatDateTime, formatSeconds } from '../shared/utils/formatters'

export function buildProjectAppointmentsColumns(): ColumnDef<ProjectAppointmentReportItemDto>[] {
  return [
    // ── Projeto ───────────────────────────────────────────────────────────────
    {
      key: 'projeto',
      header: 'Projeto',
      sortable: true,
      sortKey: 'projeto',
      align: 'left',
      accessor: (row) => row.projetoNome ?? '—',
    },

    // ── Stage ─────────────────────────────────────────────────────────────────
    {
      key: 'stage',
      header: 'Stage',
      sortable: false,
      align: 'left',
      width: '140px',
      accessor: (row) => row.stage ?? '—',
    },

    // ── Cliente ───────────────────────────────────────────────────────────────
    {
      key: 'cliente',
      header: 'Cliente',
      sortable: false,
      align: 'left',
      accessor: (row) => row.clienteNome ?? '—',
    },

    // ── Equipe ────────────────────────────────────────────────────────────────
    {
      key: 'equipe',
      header: 'Equipe',
      sortable: false,
      align: 'left',
      accessor: (row) => row.equipeAtribuida ?? '—',
    },

    // ── Atendente ─────────────────────────────────────────────────────────────
    {
      key: 'atendente',
      header: 'Atendente',
      sortable: true,
      sortKey: 'atendente',
      align: 'left',
      accessor: (row) => row.atendente || '—',
    },

    // ── Categorização do atendimento (ServiceCategory interna) ─────────────────
    {
      key: 'categorizacaoAtendimento',
      header: 'Categorização do atendimento',
      sortable: false,
      align: 'left',
      accessor: (row) => row.categorizacaoAtendimento ?? '—',
    },

    // ── Faturamento ───────────────────────────────────────────────────────────
    {
      key: 'faturamento',
      header: 'Faturamento',
      sortable: false,
      align: 'center',
      width: '160px',
      accessor: (row) => (
        <Badge value={row.faturamento} aria-label={`Faturamento: ${row.faturamento}`} />
      ),
    },

    // ── Data do apontamento ───────────────────────────────────────────────────
    {
      key: 'dataApontamento',
      header: 'Data do apontamento',
      sortable: true,
      sortKey: 'inicioem',
      align: 'center',
      width: '150px',
      accessor: (row) => formatDateTime(row.dataApontamento),
    },

    // ── Tempo ─────────────────────────────────────────────────────────────────
    {
      key: 'tempo',
      header: 'Tempo',
      sortable: true,
      sortKey: 'totalsegundos',
      align: 'right',
      width: '90px',
      accessor: (row) => formatSeconds(row.totalSegundos),
    },
  ]
}
