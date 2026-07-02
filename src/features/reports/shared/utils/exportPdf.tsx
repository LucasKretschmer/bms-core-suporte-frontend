import type { ClientReportDto, ClientReportItemDto } from '../types/reports'
import { formatDate, formatSeconds, formatMonth } from './formatters'
import {
  consolidateClientReport,
  type ConsolidatedClientReportRow,
} from '../../client-report/utils/consolidateClientReport'

/**
 * Tipo do relatório em PDF (096).
 *  - 'detalhado'   → 1 linha por apontamento (comportamento original).
 *  - 'consolidado' → 1 linha por chamado (soma/agregação — ver consolidateClientReport).
 */
export type ClientReportPdfType = 'detalhado' | 'consolidado'

/**
 * Opções de geração do PDF do Relatório do Cliente.
 * `items` é o conjunto COMPLETO de apontamentos (todas as páginas) — nunca só a
 * página visível. O `report` fornece cabeçalho e KPIs.
 */
type GenerateClientReportPdfOptions = {
  report: ClientReportDto
  items: ClientReportItemDto[]
  type: ClientReportPdfType
}

/**
 * Intervalo de datas de um chamado consolidado → "dd/MM/yyyy – dd/MM/yyyy"
 * (ou data única quando início e fim coincidem / só há uma data).
 */
function formatDateRange(inicio: string | null, fim: string | null): string {
  if (!inicio && !fim) return '—'
  const ini = inicio ? formatDate(inicio) : null
  const end = fim ? formatDate(fim) : null
  if (ini && end) return ini === end ? ini : `${ini} – ${end}`
  return ini ?? end ?? '—'
}

/**
 * Export PDF do Relatório do Cliente.
 * Usa @react-pdf/renderer para layout declarativo em paisagem.
 * Importação LAZY — não pesa o bundle das demais telas.
 *
 * PRIVACIDADE: nunca incluir categoria do HubSpot (Problema - Invoicy etc.)
 * O DTO ClientReportItemDto não contém esse campo — garantia em tempo de tipo.
 * A consolidação (096) apenas agrega campos existentes — não introduz novos.
 */
export async function generateClientReportPdf(
  options: GenerateClientReportPdfOptions,
): Promise<Blob> {
  const { report, items, type } = options

  // Lazy import para não carregar @react-pdf/renderer no bundle inicial
  const { pdf, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

  // Estilos básicos para o PDF em paisagem
  const styles = StyleSheet.create({
    page: {
      fontFamily: 'Helvetica',
      fontSize: 9,
      padding: 24,
      backgroundColor: '#FFFFFF',
    },
    title: {
      fontSize: 14,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 10,
      color: '#6B7280',
      marginBottom: 16,
    },
    section: {
      marginBottom: 12,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    kpiBox: {
      flex: 1,
      backgroundColor: '#F5F6FA',
      borderRadius: 4,
      padding: 8,
    },
    kpiLabel: {
      fontSize: 8,
      color: '#6B7280',
      marginBottom: 2,
    },
    kpiValue: {
      fontSize: 11,
      fontFamily: 'Helvetica-Bold',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#E2E8F0',
      borderRadius: 3,
      padding: '4 8',
      marginBottom: 2,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 0.5,
      borderBottomColor: '#E2E8F0',
      padding: '3 8',
    },
    tableCell: {
      flex: 1,
      fontSize: 8,
    },
    tableCellHeader: {
      flex: 1,
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
    },
  })

  const appName =
    typeof window !== 'undefined'
      ? (window as Window & { ENV?: { VITE_APP_NAME?: string } }).ENV?.VITE_APP_NAME ??
        'BMS Core Suporte'
      : 'BMS Core Suporte'

  const kpis = [
    { label: 'Apontamentos', value: String(report.totalApontamentos) },
    { label: 'Tempo Total', value: formatSeconds(report.totalSegundos) },
    { label: 'Plano de Suporte', value: formatSeconds(report.horasPlanoSegundos) },
    { label: 'Faturado', value: formatSeconds(report.horasFaturadoSegundos) },
    { label: 'Não Faturado', value: formatSeconds(report.horasNaoFaturadoSegundos) },
  ]

  const headers = [
    'Origem',
    'Ticket / Projeto',
    'Atendente',
    'Categorização',
    'Faturamento',
    'Abertura',
    'Apontamento',
    'Tempo',
  ]

  const typeLabel = type === 'consolidado' ? 'Consolidado' : 'Detalhado'

  // Linhas do corpo — cada tipo produz uma lista de células já formatadas.
  type PdfRow = {
    key: string
    origem: string
    ticket: string
    atendente: string
    categorizacao: string
    faturamento: string
    abertura: string
    apontamento: string
    tempo: string
  }

  const rows: PdfRow[] =
    type === 'consolidado'
      ? consolidateClientReport(items).map((row: ConsolidatedClientReportRow) => {
          const isProjeto = row.origem === 'projeto'
          return {
            key: row.chaveChamado,
            origem: isProjeto ? 'Projeto' : 'Ticket',
            ticket: isProjeto
              ? (row.projetoNome ?? '—')
              : row.hubspotTicketId
                ? `#${row.hubspotTicketId}`
                : '—',
            atendente: row.atendente || '—',
            categorizacao: row.categorizacaoAtendimento ?? '—',
            faturamento: row.faturamento || '—',
            abertura: row.aberturaDosChamado ? formatDate(row.aberturaDosChamado) : '—',
            apontamento: formatDateRange(
              row.dataApontamentoInicio,
              row.dataApontamentoFim,
            ),
            tempo: formatSeconds(row.totalSegundos),
          }
        })
      : items.map((item) => {
          const isProjeto = item.origem === 'projeto'
          return {
            key: String(item.timeEntryId),
            origem: isProjeto ? 'Projeto' : 'Ticket',
            ticket: isProjeto
              ? (item.projetoNome ?? '—')
              : item.hubspotTicketId
                ? `#${item.hubspotTicketId}`
                : '—',
            atendente: item.atendente || '—',
            categorizacao: item.categorizacaoAtendimento ?? '—',
            faturamento: item.faturamento,
            abertura: item.aberturaDosChamado ? formatDate(item.aberturaDosChamado) : '—',
            apontamento: formatDate(item.dataApontamento),
            tempo: formatSeconds(item.totalSegundos),
          }
        })

  const PdfDocument = () => (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>{appName}</Text>
          <Text style={styles.subtitle}>
            Relatório do Cliente ({typeLabel}) —{' '}
            {report.client.nomeFantasia ?? report.client.razaoSocial ?? '—'} •{' '}
            {formatMonth(report.competencia)}
          </Text>
        </View>

        {/* KPIs */}
        <View style={styles.kpiRow}>
          {kpis.map((kpi) => (
            <View key={kpi.label} style={styles.kpiBox}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
            </View>
          ))}
        </View>

        {/* Cabeçalho da tabela */}
        <View style={styles.tableHeader}>
          {headers.map((h) => (
            <Text key={h} style={styles.tableCellHeader}>
              {h}
            </Text>
          ))}
        </View>

        {/* Linhas da tabela (detalhado = 1 por apontamento; consolidado = 1 por chamado) */}
        {rows.map((row) => (
          <View key={row.key} style={styles.tableRow}>
            <Text style={styles.tableCell}>{row.origem}</Text>
            <Text style={styles.tableCell}>{row.ticket}</Text>
            <Text style={styles.tableCell}>{row.atendente}</Text>
            <Text style={styles.tableCell}>{row.categorizacao}</Text>
            <Text style={styles.tableCell}>{row.faturamento}</Text>
            <Text style={styles.tableCell}>{row.abertura}</Text>
            <Text style={styles.tableCell}>{row.apontamento}</Text>
            <Text style={styles.tableCell}>{row.tempo}</Text>
          </View>
        ))}
      </Page>
    </Document>
  )

  const blob = await pdf(<PdfDocument />).toBlob()
  return blob
}

// Exporta a função de download do PDF
export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.pdf`
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
