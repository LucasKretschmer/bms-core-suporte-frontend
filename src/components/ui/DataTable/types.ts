/**
 * Tipos da DataTable genérica.
 * A tabela é dirigida por colunas — zero lógica de domínio.
 */

export type ColumnDef<TRow> = {
  /** Chave única da coluna (usada como key e na reordenação) */
  key: string
  /** Texto do cabeçalho */
  header: string
  /** Nó React alternativo para o cabeçalho (ex: com InfoIcon ⓘ) */
  headerNode?: React.ReactNode
  /** Função que extrai o valor de exibição da linha */
  accessor: (row: TRow) => React.ReactNode
  /** Se a coluna pode ser ordenada */
  sortable?: boolean
  /** Chave enviada ao backend (deve estar na whitelist do backend) */
  sortKey?: string
  /** Alinhamento da coluna */
  align?: 'left' | 'center' | 'right'
  /** Largura fixa (ex: '120px') */
  width?: string
}

export type SortState = {
  sortBy: string | null
  sortDirection: 'asc' | 'desc'
}
