import { describe, expect, it, vi } from 'vitest'
import type { PaginatedResponse } from '../../../../types/api'
import {
  fetchAllPaginated,
  ExportLimitError,
  DEFAULT_EXPORT_PAGE_SIZE,
} from './fetchAllPaginated'

type Item = { id: number }

/** Cria um fetcher fake que pagina um array em memória. */
function makePagedFetcher(total: number, pageSize = DEFAULT_EXPORT_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return vi.fn(
    async (page: number, size: number): Promise<PaginatedResponse<Item>> => {
      const start = (page - 1) * size
      const items: Item[] = []
      for (let i = start; i < Math.min(start + size, total); i++) {
        items.push({ id: i })
      }
      return {
        items,
        totalCount: total,
        page,
        pageSize: size,
        totalPages,
      }
    },
  )
}

describe('fetchAllPaginated', () => {
  it('agrega todas as páginas do conjunto filtrado', async () => {
    const fetchPage = makePagedFetcher(450, 200)

    const result = await fetchAllPaginated<Item>(fetchPage)

    expect(result).toHaveLength(450)
    // 450 / 200 → 3 páginas (200 + 200 + 50)
    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(result[0].id).toBe(0)
    expect(result[449].id).toBe(449)
  })

  it('usa pageSize 200 por padrão (cap do backend)', async () => {
    const fetchPage = makePagedFetcher(10)

    await fetchAllPaginated<Item>(fetchPage)

    expect(fetchPage).toHaveBeenCalledWith(1, 200)
  })

  it('faz uma única chamada quando há só uma página', async () => {
    const fetchPage = makePagedFetcher(50, 200)

    const result = await fetchAllPaginated<Item>(fetchPage)

    expect(result).toHaveLength(50)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('retorna vazio quando não há itens', async () => {
    const fetchPage = makePagedFetcher(0, 200)

    const result = await fetchAllPaginated<Item>(fetchPage)

    expect(result).toEqual([])
    expect(fetchPage).toHaveBeenCalledOnce()
  })

  it('lança ExportLimitError quando totalCount excede maxRows (aborta antes do loop)', async () => {
    const fetchPage = makePagedFetcher(100_000, 200)

    await expect(fetchAllPaginated<Item>(fetchPage, { maxRows: 50_000 })).rejects.toBeInstanceOf(
      ExportLimitError,
    )
    // Só buscou a primeira página antes de abortar.
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('lança ExportLimitError quando totalPages excede maxPages', async () => {
    const fetchPage = makePagedFetcher(10_000, 10) // 1000 páginas

    await expect(
      fetchAllPaginated<Item>(fetchPage, { pageSize: 10, maxPages: 250, maxRows: 1_000_000 }),
    ).rejects.toBeInstanceOf(ExportLimitError)
  })

  it('respeita pageSize/maxRows customizados', async () => {
    const fetchPage = makePagedFetcher(120, 50)

    const result = await fetchAllPaginated<Item>(fetchPage, { pageSize: 50, maxRows: 1000 })

    expect(result).toHaveLength(120)
    // 120 / 50 → 3 páginas
    expect(fetchPage).toHaveBeenCalledTimes(3)
    expect(fetchPage).toHaveBeenCalledWith(1, 50)
  })
})
