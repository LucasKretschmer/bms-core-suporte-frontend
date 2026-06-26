/**
 * Helper único para buscar o conjunto FILTRADO COMPLETO de um endpoint paginado.
 *
 * Substitui o loop página-a-página antes duplicado em appointments/productivity.
 * Reusa o GET existente (mesmos filtros/scope/período/sort da tela) — o backend
 * aplica scope/OrganizacaoId/permissões e o cap de 200 por página (A01 garantido
 * no servidor). NUNCA passar um parâmetro de "trazer tudo" vindo do front.
 *
 * Defense-in-depth (A04 — DoS por export gigante): cap de linhas/páginas no front.
 * Ao estourar, lança ExportLimitError — o chamador exibe toast e aborta, em vez de
 * travar o browser. Nunca exporta parcial silenciosamente.
 */

import type { PaginatedResponse } from '../../../../types/api'

/** Página padrão = cap do backend (PaginatedResponse.cs: Math.Min(pageSize, 200)). */
export const DEFAULT_EXPORT_PAGE_SIZE = 200

/** Teto de segurança de linhas no front (defense-in-depth). */
export const MAX_EXPORT_ROWS = 50_000

/** Teto de segurança de páginas no front (defense-in-depth). */
export const MAX_EXPORT_PAGES = 250

/** Erro lançado quando o conjunto filtrado excede os caps de segurança. */
export class ExportLimitError extends Error {
  constructor(message = 'Conjunto muito grande para exportar. Refine os filtros.') {
    super(message)
    this.name = 'ExportLimitError'
  }
}

export type FetchAllPaginatedOptions = {
  pageSize?: number
  maxRows?: number
  maxPages?: number
}

/**
 * Busca todas as páginas do conjunto filtrado e agrega os itens.
 *
 * @param fetchPage Função que busca uma página (recebe page e pageSize, devolve PaginatedResponse).
 *                  Deve já estar amarrada aos filtros/scope/sort da tela.
 * @param opts      pageSize (default 200), maxRows (default 50.000), maxPages (default 250).
 * @returns         Array com TODOS os itens do conjunto filtrado.
 * @throws          ExportLimitError quando estoura maxRows ou maxPages.
 */
export async function fetchAllPaginated<TItem>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<TItem>>,
  opts: FetchAllPaginatedOptions = {},
): Promise<TItem[]> {
  const pageSize = opts.pageSize ?? DEFAULT_EXPORT_PAGE_SIZE
  const maxRows = opts.maxRows ?? MAX_EXPORT_ROWS
  const maxPages = opts.maxPages ?? MAX_EXPORT_PAGES

  const first = await fetchPage(1, pageSize)
  const totalPages = first.totalPages

  // Aborta cedo se o total já estoura os caps (evita iniciar o loop à toa).
  if (first.totalCount > maxRows) throw new ExportLimitError()
  if (totalPages > maxPages) throw new ExportLimitError()

  const allItems: TItem[] = [...first.items]

  for (let page = 2; page <= totalPages; page++) {
    if (page > maxPages) throw new ExportLimitError()
    const next = await fetchPage(page, pageSize)
    allItems.push(...next.items)
    if (allItems.length > maxRows) throw new ExportLimitError()
  }

  return allItems
}
