import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildSupportPlanColumns } from './columns'
import type { SupportPlanDto } from './types/supportPlan'
// 125/FE-A11Y-4 (`Q-2`): o medidor do repo é UM SÓ (`utils/contrasteDeTexto.ts`), servido
// pelo harness `test/medidor-de-contraste.ts`, que deriva o tema da cascata real de CSS.
import {
  TOKENS,
  fundoDoTexto,
  razaoDoTexto,
  reprovacoesAA,
  varrer,
} from '../../test/medidor-de-contraste'

/** Varre e exige que nada tenha sido pulado — recusa do medidor reprova aqui. */
function medirTela(raiz: Element) {
  const { medidas, pulados } = varrer(raiz)
  expect(pulados).toEqual([])
  return medidas
}

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

    const medidas = medirTela(container)
    expect(fundoDoTexto(medidas, 'Plano Antigo')).toEqual([TOKENS['--color-card']])
    expect(razaoDoTexto(medidas, 'Plano Antigo').toFixed(2)).toBe('5.47')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('plano ativo continua em `text-foreground` cheio (13,82:1) — companheira positiva', () => {
    // Sem este par, trocar as duas classes por uma só passaria no teste de cima.
    const { container } = renderCelulaDoNome(plano({ isActive: true, nome: 'Plano Vigente' }))

    const nome = screen.getByText('Plano Vigente')
    expect(nome.className).toContain('text-foreground')
    expect(nome.className).not.toContain('text-foreground/')

    const medidas = medirTela(container)
    expect(razaoDoTexto(medidas, 'Plano Vigente').toFixed(2)).toBe('13.82')
  })
})
