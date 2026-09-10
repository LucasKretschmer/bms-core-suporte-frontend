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
  /**
   * 134 — duração da linha em SEGUNDOS (inteiro >= 0) ou `null` para ausência,
   * para o export calculável (CSV `H:mm:ss` / XLSX numérico com `numFmt [h]:mm:ss`).
   *
   * PRESENTE ⇒ a coluna é de duração: quem exporta usa este número e IGNORA `accessor`.
   * AUSENTE ⇒ coluna de texto, comportamento de sempre.
   *
   * A TELA continua usando `accessor` (`'2h 44m'`) — este campo NÃO afeta a renderização
   * (a `DataTable` não o lê). O valor vem sempre de um dos helpers do núcleo
   * (`durationCell`, `durationCellFromHours`, `durationCellFromMillis`), nunca de
   * conversão à mão: é ali que mora o guard `== null` (AP-FRONTEND-028).
   *
   * Campo OPCIONAL e aditivo: nenhuma coluna existente precisa mudar.
   */
  durationSeconds?: (row: TRow) => number | null
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
