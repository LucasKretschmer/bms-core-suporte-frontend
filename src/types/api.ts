/**
 * Tipos globais de envelope da API backend.
 * O backend tem dois formatos principais de response — nunca assumir um só.
 */

/** Envelope de item único / sucesso */
export type ApiResponse<T> = {
  data: T
  message?: string
}

/**
 * Envelope de lista paginada.
 * ATENÇÃO: items vem diretamente (não dentro de data).
 */
export type PaginatedResponse<T> = {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
}

/** Envelope de erro padronizado do backend */
export type ApiError = {
  error: {
    code: string
    message: string
    details?: Array<{ field: string; message: string }>
  }
}
