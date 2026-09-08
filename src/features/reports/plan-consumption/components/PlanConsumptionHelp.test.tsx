/**
 * 127/FE-AJUDA — o `(?)` da tela de Consumo de Planos.
 *
 * Este arquivo trava a **ressalva** da unidade: com a nota de competência e o card de
 * exceções recolhidos, a distinção que o card fazia por estar sempre aberto passou para o
 * **gatilho**. Os quatro estados do indicador têm caso próprio, e o de **erro** tem os
 * seus dois: que ele *nomeia a falha* e que ele **não** se parece com o zero.
 *
 * Usa os hooks REAIS; só a camada de serviço é fake — o que se prova é o wiring (período
 * da tela → requisição → indicador no botão), não que o mock foi chamado.
 *
 * O que deixa cada asserção VERMELHA está dito caso a caso; as duas mutações dirigidas da
 * unidade são (a) indicador sempre neutro e (b) estado de erro renderizado como zero.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

vi.mock('../../shared/services/reportsService', () => ({
  getBillingExceptionsSummary: vi.fn(),
  listBillingExceptions: vi.fn(),
}))

import {
  getBillingExceptionsSummary,
  listBillingExceptions,
} from '../../shared/services/reportsService'
import { PlanConsumptionHelp } from './PlanConsumptionHelp'
import type { BillingExceptionsSummaryDto } from '../../shared/types/reports'
import { TEXTO_COMPETENCIA_TITULO } from '../../shared/utils/competenciaTexts'
import { TEXTO_EXCECOES_TITULO } from '../billingExceptionsTexts'
import { reprovacoesAA, varrer } from '../../../../test/medidor-de-contraste'

const mockedSummary = vi.mocked(getBillingExceptionsSummary)
const mockedLista = vi.mocked(listBillingExceptions)

function summary(
  partial: Partial<BillingExceptionsSummaryDto> = {},
): BillingExceptionsSummaryDto {
  return {
    anomaliasCount: 0,
    anomaliasSegundos: 0,
    postergadoCount: 0,
    postergadoSegundos: 0,
    ...partial,
  }
}

/**
 * Renderiza sobre uma superfície REAL da tela (`bg-background`, o fundo da página onde o
 * `(?)` vive) — é esse fundo que o medidor de contraste precisa enxergar.
 */
function renderAjuda(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <div className="bg-background">{children}</div>
    </QueryClientProvider>
  )
  return render(ui, { wrapper })
}

/** O gatilho é o único elemento que existe nos quatro estados — é por ele que se pergunta. */
function gatilho(): HTMLElement {
  return screen.getByTestId('ajuda-gatilho')
}

/** O nome ACESSÍVEL do gatilho: é nele, não numa cor, que a distinção vive. */
function nomeDoGatilho(): string {
  return gatilho().getAttribute('aria-label') ?? ''
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedLista.mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 25,
    totalPages: 0,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. Os QUATRO estados do indicador — literais escritos à mão, um por caso
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanConsumptionHelp — os 4 estados do indicador do (?)', () => {
  it('CARREGANDO: diz que ainda não se sabe, e nunca "nenhum"', () => {
    mockedSummary.mockReturnValue(new Promise(() => {}))
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)

    expect(nomeDoGatilho()).toBe(
      'Ajuda e conferência — verificando se há chamados a conferir',
    )
    expect(gatilho()).toHaveAttribute('data-estado', 'carregando')
    // Meio não-cromático: o selo é um glifo, legível por quem não distingue cor.
    expect(screen.getByTestId('ajuda-selo')).toHaveTextContent('…')
    // Vermelho se o carregando passar a ser escrito como conjunto vazio.
    expect(nomeDoGatilho()).not.toMatch(/nenhum/i)
  })

  it('ERRO: NOMEIA a falha — e o nome é diferente do de zero (a ressalva da 127)', async () => {
    mockedSummary.mockRejectedValue(new Error('500'))
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)

    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'erro'))
    expect(nomeDoGatilho()).toBe(
      'Ajuda e conferência — não foi possível verificar se há chamados a conferir',
    )
    // As duas metades da ressalva, explícitas:
    // (1) a falha é nomeada;
    expect(nomeDoGatilho()).toMatch(/não foi possível/)
    // (2) e NÃO soa como conjunto vazio — este é o assert que a mutação (b) derruba.
    expect(nomeDoGatilho()).not.toContain('nenhum chamado exige conferência')
    expect(screen.getByTestId('ajuda-selo')).toHaveTextContent('!')
  })

  it('ZERO: neutro, sem selo — e continua afirmando o zero por escrito', async () => {
    mockedSummary.mockResolvedValue(summary())
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)

    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'zero'))
    expect(nomeDoGatilho()).toBe('Ajuda e conferência — nenhum chamado exige conferência')
    // O repouso é a AUSÊNCIA de marca — se o zero ganhar selo, o alerta perde significado.
    expect(screen.queryByTestId('ajuda-selo')).not.toBeInTheDocument()
  })

  it('N > 0: diz QUANTOS, no nome acessível e no selo visível', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 3, anomaliasSegundos: 6300 }))
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)

    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'pendente'))
    expect(nomeDoGatilho()).toBe('Ajuda e conferência — 3 chamados exigem conferência')
    expect(screen.getByTestId('ajuda-selo')).toHaveTextContent('3')
  })

  it('N = 1: singular correto (número diferente, não um literal fixo)', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 1, anomaliasSegundos: 60 }))
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    await waitFor(() =>
      expect(nomeDoGatilho()).toBe('Ajuda e conferência — 1 chamado exige conferência'),
    )
    expect(screen.getByTestId('ajuda-selo')).toHaveTextContent('1')
  })

  /**
   * Cardinalidades DIFERENTES nos dois casos com número (3 e 1) e o selo asseverado pelo
   * VALOR: um indicador que mostrasse sempre "1", ou o `length` de qualquer coisa, passaria
   * num só (rules/tests.md, padrão 2).
   */
  it('os quatro nomes acessíveis são DISTINTOS entre si (nenhum par se confunde)', async () => {
    const nomes: string[] = []

    mockedSummary.mockReturnValue(new Promise(() => {}))
    const carregando = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    nomes.push(nomeDoGatilho())
    carregando.unmount()

    mockedSummary.mockRejectedValue(new Error('500'))
    const erro = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'erro'))
    nomes.push(nomeDoGatilho())
    erro.unmount()

    mockedSummary.mockResolvedValue(summary())
    const zero = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'zero'))
    nomes.push(nomeDoGatilho())
    zero.unmount()

    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 2 }))
    const pendente = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'pendente'))
    nomes.push(nomeDoGatilho())
    pendente.unmount()

    // Identidade, não cardinalidade: é a lista literal que reprova quando dois estados
    // passam a dizer a mesma coisa (mutação (a) — indicador sempre neutro).
    expect(nomes).toEqual([
      'Ajuda e conferência — verificando se há chamados a conferir',
      'Ajuda e conferência — não foi possível verificar se há chamados a conferir',
      'Ajuda e conferência — nenhum chamado exige conferência',
      'Ajuda e conferência — 2 chamados exigem conferência',
    ])
    expect(new Set(nomes).size).toBe(4)
  })

  it('sucesso SEM o número (`anomaliasCount: null` no wire) cai em ERRO, nunca em zero', async () => {
    // AP-FRONTEND-021/028: "o servidor não sabe responder" ≠ "não há nada". `null`
    // EXPLÍCITO — com `undefined` o caso passaria nas duas implementações.
    mockedSummary.mockResolvedValue({
      ...summary(),
      anomaliasCount: null,
    } as unknown as BillingExceptionsSummaryDto)
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'erro'))
    expect(nomeDoGatilho()).toContain('não foi possível verificar')
    expect(nomeDoGatilho()).not.toContain('nenhum')
  })

  it('postergado > 0 com anomalias 0 continua NEUTRO (só a seção acionável chama)', async () => {
    // Mesma hierarquia de F-15 já travada no card: pedir ação onde não há ação é o defeito
    // de misturar as duas listas. Cardinalidade alta de propósito (40) — se o indicador
    // somasse as duas seções, este caso ficaria vermelho.
    mockedSummary.mockResolvedValue(
      summary({ postergadoCount: 40, postergadoSegundos: 360000 }),
    )
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'zero'))
    expect(nomeDoGatilho()).toBe('Ajuda e conferência — nenhum chamado exige conferência')
    expect(screen.queryByTestId('ajuda-selo')).not.toBeInTheDocument()
  })

  it('a mudança de estado é ANUNCIADA (region status), não só trocada no aria-label', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 2 }))
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    const anuncio = screen.getByTestId('ajuda-anuncio')
    expect(anuncio).toHaveAttribute('role', 'status')
    // Mudança de `aria-label` não é anunciada a quem já leu o botão — a região carrega a
    // MESMA frase, e é o que torna a transição perceptível.
    await waitFor(() =>
      expect(anuncio).toHaveTextContent('Ajuda e conferência — 2 chamados exigem conferência'),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. O recolhimento — o que o (?) abre, e o que ele esconde
// ─────────────────────────────────────────────────────────────────────────────

describe('PlanConsumptionHelp — recolher e abrir', () => {
  it('FECHADO: nem a nota, nem o card, nem "Conferir" estão na tela', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 3, anomaliasSegundos: 6300 }))
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)

    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'pendente'))
    expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(TEXTO_COMPETENCIA_TITULO)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: TEXTO_EXCECOES_TITULO }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conferir/i })).not.toBeInTheDocument()
    // O contêiner existe (o `aria-controls` aponta para algo real) e está oculto.
    expect(screen.getByTestId('ajuda-conteudo')).toHaveAttribute('hidden')
  })

  it('ABERTO: mostra os textos E o botão Conferir (o pedido da 127, literal)', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 3, anomaliasSegundos: 6300 }))
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)

    await userEvent.click(gatilho())

    expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
    // (1) a nota "Como o período é contado aqui"…
    expect(screen.getByText(TEXTO_COMPETENCIA_TITULO)).toBeInTheDocument()
    expect(
      screen.getByText('Mostrando os chamados concluídos entre 01/07/2026 e 31/07/2026.'),
    ).toBeInTheDocument()
    // (2) …o card de exceções…
    const card = screen.getByRole('region', { name: TEXTO_EXCECOES_TITULO })
    expect(within(card).getByTestId('excecoes-anomalias')).toHaveTextContent(
      'Precisa ação: 3 chamados fechados sem data de conclusão',
    )
    // (3) …e o botão Conferir.
    expect(screen.getByRole('button', { name: /conferir/i })).toBeInTheDocument()
    expect(screen.getByTestId('ajuda-conteudo')).not.toHaveAttribute('hidden')
  })

  it('o segundo clique recolhe de novo (é um disclosure, não um caminho de ida)', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 1, anomaliasSegundos: 60 }))
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    await userEvent.click(gatilho())
    expect(screen.getByText(TEXTO_COMPETENCIA_TITULO)).toBeInTheDocument()

    await userEvent.click(gatilho())
    expect(gatilho()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(TEXTO_COMPETENCIA_TITULO)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conferir/i })).not.toBeInTheDocument()
  })

  it('abre pelo TECLADO — Tab até o gatilho e Enter (nada exige mouse)', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 1, anomaliasSegundos: 60 }))
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    // Ancorado FORA do componente: a travessia começa no início do documento.
    await userEvent.tab()
    expect(document.activeElement).toBe(gatilho())

    await userEvent.keyboard('{Enter}')
    expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(TEXTO_COMPETENCIA_TITULO)).toBeInTheDocument()
  })

  it('espaço também alterna (semântica nativa de <button>, não de div clicável)', async () => {
    mockedSummary.mockResolvedValue(summary())
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    expect(gatilho().tagName).toBe('BUTTON')
    expect(gatilho()).toHaveAttribute('type', 'button')
    gatilho().focus()
    await userEvent.keyboard(' ')
    expect(gatilho()).toHaveAttribute('aria-expanded', 'true')
  })

  it('`aria-controls` aponta para um id que EXISTE nos dois estados', async () => {
    mockedSummary.mockResolvedValue(summary())
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    const id = gatilho().getAttribute('aria-controls')
    expect(id).toBeTruthy()
    expect(document.getElementById(id ?? '')).toBe(screen.getByTestId('ajuda-conteudo'))

    await userEvent.click(gatilho())
    expect(document.getElementById(id ?? '')).toBe(screen.getByTestId('ajuda-conteudo'))
  })

  it('nenhum focável fica escondido atrás do recolhido (o Tab não visita o Conferir)', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 1, anomaliasSegundos: 60 }))
    renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'pendente'))

    const paradas: (Element | null)[] = []
    for (let i = 0; i < 3; i += 1) {
      await userEvent.tab()
      paradas.push(document.activeElement)
    }
    // Só o gatilho é focável enquanto fechado; as paradas seguintes saem para o body.
    expect(paradas[0]).toBe(gatilho())
    expect(paradas.slice(1).every((p) => p === document.body || p === gatilho())).toBe(true)
  })

  it('abrir NÃO devolve o card ao esqueleto: ele nasce com o número (mesma queryKey)', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 3, anomaliasSegundos: 6300 }))
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'pendente'))

    await userEvent.click(gatilho())

    // Vermelho se o card passar a usar outra chave/outro endpoint: ali ele montaria em
    // `isLoading` e piscaria o Skeleton antes do número.
    const card = screen.getByRole('region', { name: TEXTO_EXCECOES_TITULO })
    expect(within(card).queryByLabelText('Carregando…')).not.toBeInTheDocument()
    expect(within(card).getByTestId('excecoes-anomalias')).toHaveTextContent(
      '3 chamados fechados sem data de conclusão',
    )
  })

  it('o período da tela chega à requisição do resumo (e não o mês do backend)', async () => {
    mockedSummary.mockResolvedValue(summary())
    renderAjuda(<PlanConsumptionHelp from="2026-05-10" to="2026-05-20" />)

    await waitFor(() => expect(mockedSummary).toHaveBeenCalled())
    expect(mockedSummary.mock.calls[0][0]).toEqual({ from: '2026-05-10', to: '2026-05-20' })
  })

  it('com ERRO, abrir mostra a mensagem do card e o retry (a falha é inspecionável)', async () => {
    mockedSummary.mockRejectedValue(new Error('500'))
    renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'erro'))

    await userEvent.click(gatilho())

    expect(
      screen.getByText('Não foi possível verificar as exceções de faturamento.'),
    ).toBeInTheDocument()

    // E o retry conserta os DOIS: o card e o indicador do gatilho.
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 2, anomaliasSegundos: 120 }))
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() =>
      expect(nomeDoGatilho()).toBe('Ajuda e conferência — 2 chamados exigem conferência'),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Contraste medido no DOM — com controle positivo e `pulados` vazio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mede o que a árvore RENDERIZA (nunca a classe que o teste passou), com o medidor
 * consolidado do repo. `pulados` vazio é obrigatório: recusa do medidor reprova aqui em
 * vez de virar fallback silencioso (125/FE-A11Y-4, `Q-3`).
 */
describe('PlanConsumptionHelp — contraste AA do (?) nos 4 estados', () => {
  function medir(container: HTMLElement) {
    const { medidas, pulados } = varrer(container)
    expect(pulados).toEqual([])
    return medidas
  }

  it('CARREGANDO: nenhum texto abaixo de 4,5:1', () => {
    mockedSummary.mockReturnValue(new Promise(() => {}))
    const { container } = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)

    const medidas = medir(container)
    expect(medidas.length).toBeGreaterThan(2)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('ERRO: o selo "!" (error-fg sobre error-bg) passa AA', async () => {
    mockedSummary.mockRejectedValue(new Error('500'))
    const { container } = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'erro'))

    const medidas = medir(container)
    // A companheira positiva: o selo foi de fato medido (senão a asserção passaria vazia).
    expect(medidas.some((m) => m.texto === '!')).toBe(true)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('ZERO: nenhum texto abaixo de 4,5:1', async () => {
    mockedSummary.mockResolvedValue(summary())
    const { container } = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'zero'))

    expect(reprovacoesAA(medir(container))).toEqual([])
  })

  it('N > 0: o selo com o número (excecao-fatura-fg sobre excecao-fatura-bg) passa AA', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 3, anomaliasSegundos: 6300 }))
    const { container } = renderAjuda(<PlanConsumptionHelp from={null} to={null} />)
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'pendente'))

    const medidas = medir(container)
    expect(medidas.some((m) => m.texto === '3')).toBe(true)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('ABERTO: a árvore inteira (nota + card + Conferir) continua sem reprovação', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 3, anomaliasSegundos: 6300 }))
    const { container } = renderAjuda(<PlanConsumptionHelp from="2026-07-01" to="2026-07-31" />)
    await userEvent.click(gatilho())

    const medidas = medir(container)
    expect(medidas.length).toBeGreaterThan(8)
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  /**
   * Controle positivo, na MESMA execução e na MESMA árvore: um medidor que morresse
   * (parasse de alcançar o componente e devolvesse "0 reprovações") deixaria este caso
   * vermelho. Sem ele, os cinco casos acima passariam vacuamente.
   */
  it('controle positivo: um texto propositalmente ruim NA ÁRVORE é reprovado', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 3, anomaliasSegundos: 6300 }))
    const { container } = renderAjuda(
      <div>
        <PlanConsumptionHelp from={null} to={null} />
        <p className="text-muted/30">controle positivo de contraste</p>
      </div>,
    )
    await waitFor(() => expect(gatilho()).toHaveAttribute('data-estado', 'pendente'))

    const reprovacoes = reprovacoesAA(medir(container))
    expect(reprovacoes).toHaveLength(1)
    expect(reprovacoes[0]).toContain('controle positivo de contraste')
    expect(reprovacoes[0]).toContain('text-muted/30')
  })
})
