import type { ClientReportDto } from '../types/reports'
import { formatDate, formatSeconds, formatMonth } from './formatters'

/**
 * Export PDF do Relatório do Cliente.
 * Usa @react-pdf/renderer para layout declarativo em paisagem.
 * Importação LAZY — não pesa o bundle das demais telas.
 *
 * PRIVACIDADE: nunca incluir categoria do HubSpot (Problema - Invoicy etc.)
 * O DTO ClientReportItemDto não contém esse campo — garantia em tempo de tipo.
 */
export async function generateClientReportPdf(report: ClientReportDto): Promise<Blob> {
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

  const items = report.items ?? []

  const kpis = [
    { label: 'Apontamentos', value: String(report.totalApontamentos) },
    { label: 'Tempo Total', value: formatSeconds(report.totalSegundos) },
    { label: 'Plano de Suporte', value: formatSeconds(report.horasPlanoSegundos) },
    { label: 'Faturado', value: formatSeconds(report.horasFaturadoSegundos) },
    { label: 'Não Faturado', value: formatSeconds(report.horasNaoFaturadoSegundos) },
  ]

  const headers = [
    'Ticket',
    'Atendente',
    'Categorização',
    'Faturamento',
    'Abertura',
    'Apontamento',
    'Tempo',
  ]

  const PdfDocument = () => (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.section}>
          <Text style={styles.title}>{appName}</Text>
          <Text style={styles.subtitle}>
            Relatório do Cliente —{' '}
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

        {/* Linhas da tabela */}
        {items.map((item) => (
          <View key={item.timeEntryId} style={styles.tableRow}>
            <Text style={styles.tableCell}>{item.hubspotTicketId}</Text>
            <Text style={styles.tableCell}>{item.atendente}</Text>
            <Text style={styles.tableCell}>{item.categorizacaoAtendimento ?? '—'}</Text>
            <Text style={styles.tableCell}>{item.faturamento}</Text>
            <Text style={styles.tableCell}>{formatDate(item.aberturaDosChamado)}</Text>
            <Text style={styles.tableCell}>{formatDate(item.dataApontamento)}</Text>
            <Text style={styles.tableCell}>{formatSeconds(item.totalSegundos)}</Text>
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
