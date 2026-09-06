import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UnmatchedPlansCard } from './UnmatchedPlansCard'
import { textoResumoUnmatched } from '../utils/unmatchedTexts'
import type { UnmatchedPlanDto } from '../types/supportPlan'
import { derivarCascataDeCssDoApp, lerTokensDeCor } from '../../../utils/cssCascade'
import { medirTextosDoDom, reprovacoesAA, temaDaCascata } from '../utils/contrasteDeTexto'

const itens: UnmatchedPlanDto[] = [
  { valorHubspot: 'Support Gold', clientesAfetados: 9, exemploClienteId: 42 },
  { valorHubspot: 'Support Platinum', clientesAfetados: 5, exemploClienteId: null },
]

describe('textoResumoUnmatched', () => {
  it('soma os clientes afetados de todas as linhas', () => {
    // Cardinalidades DIFERENTES (9 e 5) de propósito: com 1 e 1 o assert passaria com a
    // soma trocada por `length` (rules/tests.md, padrão 2).
    expect(textoResumoUnmatched(itens)).toBe(
      '2 valores de plano vindos do HubSpot não correspondem a nenhum plano cadastrado — 14 clientes afetados.',
    )
  })

  it('usa singular quando há um valor e um cliente', () => {
    expect(
      textoResumoUnmatched([
        { valorHubspot: 'Support Gold', clientesAfetados: 1, exemploClienteId: null },
      ]),
    ).toBe(
      '1 valor de plano vindo do HubSpot não corresponde a nenhum plano cadastrado — 1 cliente afetado.',
    )
  })
})

describe('UnmatchedPlansCard — estados', () => {
  it('loading mostra o card com skeleton (nunca some da tela)', () => {
    render(
      <UnmatchedPlansCard itens={undefined} isLoading isError={false} onRetry={vi.fn()} />,
    )
    expect(
      screen.getByRole('region', { name: 'Planos do HubSpot sem correspondência' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Carregando…')).toBeInTheDocument()
  })

  it('erro mostra mensagem e botão de tentar de novo', async () => {
    const onRetry = vi.fn()
    render(<UnmatchedPlansCard itens={undefined} isLoading={false} isError onRetry={onRetry} />)

    expect(screen.getByText(/Não foi possível verificar os planos/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('sucesso SEM itens continua renderizando o card com a afirmação positiva', () => {
    // Esconder no zero tornaria "não há divergência" indistinguível de "a requisição
    // falhou" (AP-FRONTEND-021) — que é justamente o silêncio que esta unidade combate.
    render(<UnmatchedPlansCard itens={[]} isLoading={false} isError={false} onRetry={vi.fn()} />)
    expect(
      screen.getByRole('region', { name: 'Planos do HubSpot sem correspondência' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Todos os valores de plano recebidos do HubSpot correspondem/)).toBeInTheDocument()
  })

  it('sucesso sem corpo (itens undefined) cai no estado de erro, não em "está tudo certo"', () => {
    render(
      <UnmatchedPlansCard itens={undefined} isLoading={false} isError={false} onRetry={vi.fn()} />,
    )
    expect(screen.getByText(/Não foi possível verificar os planos/)).toBeInTheDocument()
    expect(screen.queryByText(/Todos os valores de plano/)).toBeNull()
  })
})

describe('UnmatchedPlansCard — lista', () => {
  it('lista cada valor com os clientes afetados e o cliente de exemplo', () => {
    render(<UnmatchedPlansCard itens={itens} isLoading={false} isError={false} onRetry={vi.fn()} />)

    expect(screen.getByText('Support Gold')).toBeInTheDocument()
    expect(screen.getByText(/9 clientes afetados/)).toHaveTextContent('ex.: cliente #42')
    expect(screen.getByText('Support Platinum')).toBeInTheDocument()
    // `exemploClienteId: null` não vira "#null".
    expect(screen.getByText(/5 clientes afetados/)).not.toHaveTextContent('#')
  })

  it('"Criar plano" devolve o valor exato que o HubSpot mandou', async () => {
    const onCriarPlano = vi.fn()
    render(
      <UnmatchedPlansCard
        itens={itens}
        isLoading={false}
        isError={false}
        onRetry={vi.fn()}
        onCriarPlano={onCriarPlano}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Criar plano para o valor Support Gold' }))
    expect(onCriarPlano).toHaveBeenCalledWith('Support Gold')
  })

  it('sem permissão de criar, a ação some e o diagnóstico permanece', () => {
    render(<UnmatchedPlansCard itens={itens} isLoading={false} isError={false} onRetry={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Criar plano/ })).toBeNull()
    expect(screen.getByText('Support Gold')).toBeInTheDocument()
  })
})

const lerCssDoDisco = (caminho: string): string =>
  readFileSync(resolve(process.cwd(), caminho), 'utf8')
const CASCATA_CSS = derivarCascataDeCssDoApp(lerCssDoDisco)
const TOKENS = lerTokensDeCor(CASCATA_CSS, lerCssDoDisco)
const TEMA = temaDaCascata(CASCATA_CSS, lerCssDoDisco, TOKENS)

/**
 * 124/FE-FIX2 · `D-3` — os dois `/60` deste card (4,04:1) viraram `/70` (5,47:1).
 * A medição é do DOM renderizado; o medidor tem controle positivo em
 * `utils/contrasteDeTexto.test.ts`.
 */
describe('UnmatchedPlansCard — contraste AA (D-3)', () => {
  function medir(container: HTMLElement) {
    return medirTextosDoDom(container, {
      tema: TEMA,
      fundoPadrao: TOKENS['--color-background'],
    })
  }

  it('a lista (fundo de alerta) não tem nenhum texto abaixo de 4,5:1', () => {
    const { container } = render(
      <UnmatchedPlansCard itens={itens} isLoading={false} isError={false} onRetry={vi.fn()} />,
    )

    const medidas = medir(container)
    expect(medidas.length).toBeGreaterThan(2)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('"N clientes afetados" está em /70 sobre o card do item (5,47:1), não em /60', () => {
    const { container } = render(
      <UnmatchedPlansCard itens={itens} isLoading={false} isError={false} onRetry={vi.fn()} />,
    )

    const linha = screen.getByText(/9 clientes afetados/)
    expect(linha.className).toContain('text-foreground/70')

    const medida = medir(container).find((m) => m.texto.startsWith('9 clientes afetados'))
    expect(medida?.fundo).toBe(TOKENS['--color-card'])
    expect(medida?.razao.toFixed(2)).toBe('5.47')
  })

  it('o estado "tudo corresponde" também passa AA', () => {
    const { container } = render(
      <UnmatchedPlansCard itens={[]} isLoading={false} isError={false} onRetry={vi.fn()} />,
    )

    const frase = screen.getByText(/Todos os valores de plano recebidos do HubSpot/)
    expect(frase.className).toContain('text-foreground/70')
    expect(reprovacoesAA(medir(container))).toEqual([])
  })
})
