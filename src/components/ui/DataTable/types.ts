/**
 * Tipos da DataTable genérica.
 * A tabela é dirigida por colunas — zero lógica de domínio.
 */

export type ColumnDef<TRow> = {
  /** Chave única da coluna (usada como key e na reordenação) */
  key: string
  /** Texto do cabeçalho */
  header: string
  /**
   * Nó React alternativo para o rótulo do cabeçalho (texto customizado).
   *
   * ATENÇÃO: não colocar elementos interativos (ex.: `<button>`, InfoIcon)
   * aqui — o rótulo é renderizado dentro do `<button>` de ordenação e geraria
   * `<button>` dentro de `<button>` (HTML inválido). Para tooltip informativo
   * use `headerInfo`, que renderiza o ⓘ fora do botão de ordenação.
   */
  headerNode?: React.ReactNode
  /**
   * Texto de tooltip informativo (ⓘ) exibido ao lado do rótulo, **fora** do
   * botão de ordenação. Clicar no ícone apenas mostra o tooltip — nunca
   * ordena. Preferir isto a embutir um InfoIcon em `headerNode`.
   */
  headerInfo?: string
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
