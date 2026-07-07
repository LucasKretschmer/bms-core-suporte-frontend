/**
 * Tema de cores para documentos @react-pdf/renderer (PDFs de relatórios).
 * react-pdf NÃO lê CSS var/Tailwind — estas constantes espelham manualmente os
 * valores hex da paleta Migrate definidos em src/styles/global.css (arquitetura
 * 110, §2.1). Se a paleta mudar no global.css, replicar aqui manualmente.
 *
 * Decisão de fonte (R4 / G8): mantém Helvetica (built-in do react-pdf) — não
 * embutir Montserrat (custo de peso do bundle/perf de geração; Helvetica é
 * suficientemente neutra para um PDF tabular). Reavaliar apenas se o Marketing
 * exigir a fonte de marca em PDF.
 */
export const pdfColors = {
  /** --color-foreground Migrate — títulos e texto de destaque */
  foreground: '#002F4F',
  /** --color-primary-medium Migrate — uso pontual (não obrigatório nesta tela) */
  primaryMedium: '#074B7F',
  /** --color-muted Migrate — subtítulos, labels de KPI */
  muted: '#666666',
  /** --color-border Migrate — fundo de cabeçalho de tabela e linhas divisórias */
  border: '#CFCFCF',
  /** --color-background Migrate (surface-hover) — fundo dos boxes de KPI */
  surface: '#F0F4F7',
  /** --color-card Migrate — fundo de página (branco) */
  card: '#FFFFFF',
} as const

export const pdfFonts = {
  base: 'Helvetica',
  bold: 'Helvetica-Bold',
} as const
