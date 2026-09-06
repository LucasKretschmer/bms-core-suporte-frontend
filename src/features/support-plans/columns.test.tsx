import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { derivarCascataDeCssDoApp, lerTokensDeCor } from '../../utils/cssCascade'
import { buildSupportPlanColumns } from './columns'
import type { SupportPlanDto } from './types/supportPlan'
import { medirTextosDoDom, reprovacoesAA, temaDaCascata } from './utils/contrasteDeTexto'

const lerCssDoDisco = (caminho: string): string =>
  readFileSync(resolve(process.cwd(), caminho), 'utf8')
const CASCATA_CSS = derivarCascataDeCssDoApp(lerCssDoDisco)
const TOKENS = lerTokensDeCor(CASCATA_CSS, lerCssDoDisco)
const TEMA = temaDaCascata(CASCATA_CSS, lerCssDoDisco, TOKENS)

function plano(overrides: Partial<SupportPlanDto> = {}): SupportPlanDto {
  return {
    id: 1,
    nome: 'Support Pro',
    horasMes: 40,
    precoHoraExtra: 250,
    moeda: 'BRL',
    isActive: true,
    hubspotValor: 'plano_pro',
    slaPrimeiroAtendimentoMinutos: 60,
    slaIsento: false,
    calendarioId: null,
    clientesVinculados: 3,
    ...overrides,
  }
}

function renderCelulaDoNome(row: SupportPlanDto) {
  const colunas = buildSupportPlanColumns({
    onEdit: vi.fn(),
    calendarios: [],
    podeEditar: true,
  })
  const coluna = colunas.find((c) => c.key === 'nome')
  expect(coluna).toBeDefined()
  // A linha da tabela vive dentro do contêiner `bg-card` da tela.
  return render(<div className="bg-card">{coluna?.accessor?.(row)}</div>)
}

/**
 * 124/FE-FIX2 · `D-3` — o nome do plano INATIVO era `text-foreground/50` (3,04:1 sobre o
 * card). Virou `/70` (5,47:1), preservando a distinção visual ativo × inativo.
 */
describe('buildSupportPlanColumns — contraste do nome do plano (D-3)', () => {
  it('plano inativo usa /70 e passa AA — a distinção com o ativo continua existindo', () => {
    const { container } = renderCelulaDoNome(plano({ isActive: false, nome: 'Plano Antigo' }))

    const nome = screen.getByText('Plano Antigo')
    expect(nome.className).toContain('text-foreground/70')
    expect(nome.className).not.toContain('text-foreground/50')

    const medidas = medirTextosDoDom(container, {
      tema: TEMA,
      fundoPadrao: TOKENS['--color-background'],
    })
    expect(medidas[0].fundo).toBe(TOKENS['--color-card'])
    expect(medidas[0].razao.toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('plano ativo continua em `text-foreground` cheio (13,82:1) — companheira positiva', () => {
    // Sem este par, trocar as duas classes por uma só passaria no teste de cima.
    const { container } = renderCelulaDoNome(plano({ isActive: true, nome: 'Plano Vigente' }))

    const nome = screen.getByText('Plano Vigente')
    expect(nome.className).toContain('text-foreground')
    expect(nome.className).not.toContain('text-foreground/')

    const medidas = medirTextosDoDom(container, {
      tema: TEMA,
      fundoPadrao: TOKENS['--color-background'],
    })
    expect(medidas[0].razao.toFixed(2)).toBe('13.82')
  })
})
