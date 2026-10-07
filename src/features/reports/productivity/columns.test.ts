import { describe, expect, it } from 'vitest'
import { productivityColumns } from './columns'
import type { ProductivityReportItemDto } from '../shared/types/reports'

const completo: ProductivityReportItemDto = {
  userId: 1,
  nome: 'João Silva',
  equipe: 'Equipe A',
  nAtendimentos: 42,
  totalSegundos: 7200,
  ahtSegundos: 600,
  mediaPausas: 1.5,
  ticketsAtendidos: 12,
  mediaTicketsUltimos3Meses: 10.5,
  mediaResolvidosPorDia: 1.25,
  mediaSegundosPorTicket: 1800,
  diasUteis: 5,
  horasUteisSegundos: 144000,
  mediaOciosoSegundosPorDia: 3600,
  extrapolouJornada: false,
}

/** Forma real do wire com WhenWritingNull: as chaves opcionais não vêm. */
const semOpcionais = JSON.parse(
  '{"userId":2,"nome":"Maria Souza","nAtendimentos":0,"totalSegundos":0,' +
    '"ticketsAtendidos":0,"mediaTicketsUltimos3Meses":0,"extrapolouJornada":false}',
) as ProductivityReportItemDto

function celula(key: string, row: ProductivityReportItemDto) {
  const col = productivityColumns.find((c) => c.key === key)
  if (!col) throw new Error(`coluna ${key} não existe`)
  return col.accessor(row)
}

describe('productivityColumns', () => {
  it('ordem das colunas e sortKey da whitelist do backend', () => {
    expect(productivityColumns.map((c) => [c.key, c.sortKey ?? null])).toEqual([
      ['nome', 'nome'],
      ['equipe', 'equipe'],
      ['nAtendimentos', 'atendimentos'],
      ['ticketsAtendidos', 'ticketsatendidos'],
      ['mediaTicketsUltimos3Meses', 'media3meses'],
      ['mediaResolvidosPorDia', 'resolvidospordia'],
      ['totalSegundos', 'totalsegundos'],
      ['horasUteisSegundos', 'horasuteis'],
      ['mediaSegundosPorTicket', 'mediaporticket'],
      ['ahtSegundos', 'aht'],
      ['mediaOciosoSegundosPorDia', 'ocioso'],
      ['mediaPausas', 'mediapausas'],
    ])
  })

  it('formata os valores novos do wire', () => {
    expect(celula('ticketsAtendidos', completo)).toBe('12')
    expect(celula('mediaTicketsUltimos3Meses', completo)).toBe('10,50')
    expect(celula('mediaResolvidosPorDia', completo)).toBe('1,25')
    expect(celula('horasUteisSegundos', completo)).toBe('40h 0m')
    expect(celula('mediaSegundosPorTicket', completo)).toBe('0h 30m')
    expect(celula('ahtSegundos', completo)).toBe('0h 10m')
    expect(celula('mediaOciosoSegundosPorDia', completo)).toBe('1h 0m')
  })

  it('chave ausente no wire vira "-", nunca NaN', () => {
    expect(Object.hasOwn(semOpcionais, 'horasUteisSegundos')).toBe(false)
    const chaves = [
      'equipe',
      'mediaResolvidosPorDia',
      'horasUteisSegundos',
      'mediaSegundosPorTicket',
      'ahtSegundos',
      'mediaOciosoSegundosPorDia',
      'mediaPausas',
    ]
    for (const key of chaves) {
      expect(celula(key, semOpcionais)).toBe('-')
    }
  })

  it('chave nula também vira "-"', () => {
    expect(celula('mediaSegundosPorTicket', { ...completo, mediaSegundosPorTicket: null })).toBe(
      '-',
    )
    expect(celula('mediaOciosoSegundosPorDia', { ...completo, mediaOciosoSegundosPorDia: null })).toBe(
      '-',
    )
  })
})
