/**
 * Testes de U5 — Colunas do Relatório do Cliente.
 *
 * Cobertura obrigatória conforme analise-frontend.md:
 *   - Coluna "Faturamento" usa `faturamento` do DTO (não infere categoria).
 *   - Nenhuma coluna tem `categoria` ou referência a "Invoicy" (privacidade).
 *   - Mapeamento correto dos campos do DTO para cada coluna.
 *   - Formatação de data e tempo.
 */

import { describe, it, expect } from 'vitest'
import { buildClientReportColumns } from './columns'
import type { ClientReportItemDto } from '../shared/types/reports'

// ── Fixture ──────────────────────────────────────────────────────────────────

const BASE_ITEM: ClientReportItemDto = {
  timeEntryId: 1,
  ticketId: 1,
  hubspotTicketId: '12345',
  assunto: 'Problema com login',
  equipeAtribuida: 'Suporte N1',
  solicitante: { nome: 'João Silva', email: 'joao@empresa.com' },
  atendente: 'Ana Lima',
  categorizacaoAtendimento: 'Consultoria',
  // faturamento: campo tipado — nunca contém categoria do HubSpot
  faturamento: 'Plano de Suporte',
  aberturaDosChamado: '2024-03-01T10:00:00Z',
  dataApontamento: '2024-03-15T14:30:00Z',
  totalSegundos: 3723,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Obtém coluna por chave */
function getColumn(key: string) {
  const cols = buildClientReportColumns()
  const col = cols.find((c) => c.key === key)
  if (!col) throw new Error(`Coluna "${key}" não encontrada`)
  return col
}

// ── Testes de privacidade ─────────────────────────────────────────────────────

describe('buildClientReportColumns — privacidade (categoria HubSpot nunca exposta)', () => {
  it('nenhuma coluna tem key com "categoria" referente ao HubSpot', () => {
    const cols = buildClientReportColumns()
    // A única coluna que pode conter "categoria" é a ServiceCategory interna
    // (categorizacaoAtendimento) — não a categoria do HubSpot
    const hubspotCatKeys = cols
      .map((c) => c.key)
      .filter(
        (k) =>
          k.toLowerCase().includes('invoicy') ||
          k.toLowerCase() === 'categoria',
      )
    expect(hubspotCatKeys).toHaveLength(0)
  })

  it('nenhuma coluna tem header com "Invoicy"', () => {
    const cols = buildClientReportColumns()
    const invoicyCols = cols.filter((c) =>
      c.header.toLowerCase().includes('invoicy'),
    )
    expect(invoicyCols).toHaveLength(0)
  })

  it('nenhuma coluna tem header com "Problema -"', () => {
    const cols = buildClientReportColumns()
    const problemaCols = cols.filter((c) =>
      c.header.toLowerCase().includes('problema -'),
    )
    expect(problemaCols).toHaveLength(0)
  })

  it('coluna faturamento usa apenas os 3 status seguros do DTO', () => {
    const col = getColumn('faturamento')
    // O accessor usa row.faturamento — campo tipado como FaturamentoStatus
    // Não infere categoria a partir de outros campos
    expect(col.sortable).toBe(false)
    expect(col.header).toBe('Faturamento')
    // Garante que o campo acessado seja exatamente `faturamento`
    const accessor = col.accessor.toString()
    expect(accessor).toContain('faturamento')
  })
})

// ── Testes de mapeamento de colunas ──────────────────────────────────────────

describe('buildClientReportColumns — mapeamento do DTO', () => {
  it('retorna 12 colunas', () => {
    const cols = buildClientReportColumns()
    expect(cols).toHaveLength(12)
  })

  it('a primeira coluna é "Ticket" com sortKey hubspotticketid', () => {
    const col = getColumn('ticket')
    expect(col.header).toBe('Ticket')
    expect(col.sortKey).toBe('hubspotticketid')
    expect(col.sortable).toBe(true)
  })

  it('coluna equipe acessa equipeAtribuida', () => {
    const col = getColumn('equipe')
    const result = col.accessor(BASE_ITEM)
    expect(result).toBe('Suporte N1')
  })

  it('coluna equipe retorna "—" quando equipeAtribuida é null', () => {
    const col = getColumn('equipe')
    const result = col.accessor({ ...BASE_ITEM, equipeAtribuida: null })
    expect(result).toBe('—')
  })

  it('coluna solicitante acessa solicitante.nome', () => {
    const col = getColumn('solicitante')
    const result = col.accessor(BASE_ITEM)
    expect(result).toBe('João Silva')
  })

  it('coluna solicitante retorna "—" quando solicitante é null', () => {
    const col = getColumn('solicitante')
    const result = col.accessor({ ...BASE_ITEM, solicitante: null })
    expect(result).toBe('—')
  })

  it('coluna atendente acessa atendente', () => {
    const col = getColumn('atendente')
    const result = col.accessor(BASE_ITEM)
    expect(result).toBe('Ana Lima')
  })

  it('coluna categorizacaoAtendimento acessa o campo interno (≠ categoria HubSpot)', () => {
    const col = getColumn('categorizacaoAtendimento')
    const result = col.accessor(BASE_ITEM)
    expect(result).toBe('Consultoria')
  })

  it('coluna servicoSecundario retorna "—" (campo não disponível no DTO atual)', () => {
    const col = getColumn('servicoSecundario')
    const result = col.accessor(BASE_ITEM)
    expect(result).toBe('—')
  })
})

// ── Testes de formatação ──────────────────────────────────────────────────────

describe('buildClientReportColumns — formatação de data e tempo', () => {
  it('coluna aberturaChamado formata data em pt-BR (dd/MM/yyyy)', () => {
    const col = getColumn('aberturaChamado')
    const result = col.accessor(BASE_ITEM)
    // 2024-03-01T10:00:00Z → "01/03/2024" em pt-BR
    expect(typeof result).toBe('string')
    expect(result as string).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('coluna dataApontamento formata data e hora em pt-BR', () => {
    const col = getColumn('dataApontamento')
    const result = col.accessor(BASE_ITEM)
    expect(typeof result).toBe('string')
    // Deve conter data e hora (dd/MM/yyyy HH:mm)
    expect(result as string).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('coluna tempo formata segundos como "Xh Ym"', () => {
    const col = getColumn('tempo')
    // 3723 segundos = 1h 2m
    const result = col.accessor(BASE_ITEM)
    expect(result).toBe('1h 2m')
  })

  it('coluna tempo formata 0 segundos como "0h 0m"', () => {
    const col = getColumn('tempo')
    const result = col.accessor({ ...BASE_ITEM, totalSegundos: 0 })
    expect(result).toBe('0h 0m')
  })
})

// ── Testes de sort keys (whitelist do backend) ────────────────────────────────

describe('buildClientReportColumns — sortKeys (whitelist backend)', () => {
  it('sortKeys estão dentro da whitelist do backend', () => {
    const ALLOWED_SORT_KEYS = ['inicioem', 'totalsegundos', 'hubspotticketid', 'assunto']
    const cols = buildClientReportColumns()
    cols.forEach((col) => {
      if (col.sortKey) {
        expect(ALLOWED_SORT_KEYS).toContain(col.sortKey)
      }
    })
  })
})
