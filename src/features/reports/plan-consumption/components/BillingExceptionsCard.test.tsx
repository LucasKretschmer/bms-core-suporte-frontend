/**
 * 121/A2 + F-15 — card de exceções de faturamento na tela de Consumo de Planos.
 *
 * Usa os hooks REAIS; só a camada de serviço é fake — o que se quer provar é o wiring
 * (período da tela → requisição → número na tela), não que o mock foi chamado.
 *
 * QUATRO estados, não três: loading · erro · **nada a conferir (sucesso)** · com
 * exceções. "Nenhum chamado exige conferência" é sucesso, não vazio-por-erro
 * (AP-FRONTEND-021) — e o card é renderizado nos quatro, inclusive no zero: esconder
 * no zero tornaria "não há exceções" indistinguível de "a requisição falhou".
 *
 * E o ponto de F-15: **as duas seções nunca se confundem na tela**. A acionável dita o
 * tom do card; a informativa diz explicitamente que não exige ação.
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
import { BillingExceptionsCard } from './BillingExceptionsCard'
import type {
  BillingExceptionItemDto,
  BillingExceptionsSummaryDto,
} from '../../shared/types/reports'

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

function renderCard(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(ui, { wrapper })
}

/**
 * Tabula (ou volta com `Shift`) até o foco retornar a `inicial`, asseverando em CADA
 * parada que ele continua DENTRO do dialog e que nunca pousa no gatilho atrás do overlay
 * nem no `body`. Devolve o tamanho do anel percorrido — a asserção de tamanho é a
 * companheira POSITIVA: um trap que grudasse o foco num único elemento, ou uma travessia
 * que não andasse, devolveria 0.
 *
 * O anel é descoberto pela travessia, nunca por uma lista de seletores mantida à mão —
 * ela seria uma segunda fonte de verdade sobre o mesmo conjunto.
 */
async function percorrerAnel(
  dialog: HTMLElement,
  inicial: Element | null,
  gatilho: HTMLElement,
  shift = false,
): Promise<number> {
  let paradas = 0
  for (let i = 0; i < 60; i += 1) {
    await userEvent.tab({ shift })
    const ativo = document.activeElement
    expect(dialog.contains(ativo), `parada ${i + 1} caiu FORA do dialog`).toBe(true)
    expect(ativo, `parada ${i + 1} pousou no gatilho atrás do overlay`).not.toBe(gatilho)
    expect(ativo).not.toBe(document.body)
    if (ativo === inicial) return paradas
    paradas += 1
  }
  throw new Error('o anel de foco não fechou em 60 passos')
}

/** Linha de exceção mínima — só o modal com dados precisa dela. */
function itemExcecao(id: number): BillingExceptionItemDto {
  return {
    ticketId: id,
    hubspotTicketId: String(70000 + id),
    assunto: `Chamado ${id}`,
    clientId: 1,
    clienteNome: 'Acme',
    equipe: 'Suporte N2',
    ownerNome: 'Ana',
    status: 'Fechado (Suporte BR)',
    statusNome: 'Fechado',
    statusCategoria: 'fechado',
    ultimaAtividadeEm: '2026-07-10T14:00:00Z',
    segundosPlano: 3600,
    segundosFaturado: 0,
    segundosAnalise: 0,
    segundosTotais: 3600,
    hubspotUrl: null,
  }
}

/** O card sempre existe: é este landmark que os 4 estados compartilham. */
function card(): HTMLElement {
  return screen.getByRole('region', { name: 'Exceções de faturamento' })
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

describe('BillingExceptionsCard — os 4 estados', () => {
  it('LOADING: o card existe e mostra skeleton (nunca some da tela)', () => {
    mockedSummary.mockReturnValue(new Promise(() => {}))
    renderCard(<BillingExceptionsCard from="2026-07-01" to="2026-07-31" />)

    expect(card()).toBeInTheDocument()
    expect(within(card()).getByLabelText('Carregando…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conferir/i })).not.toBeInTheDocument()
  })

  it('ERRO: mensagem própria + retry que refaz a requisição', async () => {
    mockedSummary.mockRejectedValue(new Error('500'))
    renderCard(<BillingExceptionsCard from="2026-07-01" to="2026-07-31" />)

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível verificar as exceções de faturamento.'),
      ).toBeInTheDocument(),
    )
    expect(card()).toBeInTheDocument()

    mockedSummary.mockResolvedValue(summary())
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() =>
      expect(
        screen.getByText(/Nenhum chamado exige conferência no período filtrado/),
      ).toBeInTheDocument(),
    )
  })

  it('TUDO ZERADO é sucesso: card neutro, sem botão, e as duas frases de vazio', async () => {
    mockedSummary.mockResolvedValue(summary())
    renderCard(<BillingExceptionsCard from="2026-07-01" to="2026-07-31" />)

    await waitFor(() =>
      expect(
        screen.getByText(/Nenhum chamado exige conferência no período filtrado/),
      ).toBeInTheDocument(),
    )
    expect(screen.getByText(/Nada foi postergado no período filtrado/)).toBeInTheDocument()
    // A frase NÃO afirma que não há exceções no sistema — só no recorte.
    expect(
      screen.getByText(/Mostrando as que têm apontamento entre 01\/07\/2026 e 31\/07\/2026\./),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /conferir/i })).not.toBeInTheDocument()
  })

  it('nenhuma frase de vazio soa como erro de carregamento', async () => {
    mockedSummary.mockResolvedValue(summary())
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    const anomalias = await screen.findByTestId('excecoes-anomalias')
    expect(anomalias).not.toHaveTextContent(/erro|falha|não foi possível/i)
    expect(anomalias).toHaveTextContent('Nenhum chamado exige conferência')
  })
})

describe('BillingExceptionsCard — as duas seções (F-15)', () => {
  it('mostra as DUAS linhas com números LITERAIS e distintos', async () => {
    // anomalias: 3 chamados / 6300 s = 1h 45m · postergado: 12 chamados / 54000 s = 15h 0m
    mockedSummary.mockResolvedValue(
      summary({
        anomaliasCount: 3,
        anomaliasSegundos: 6300,
        postergadoCount: 12,
        postergadoSegundos: 54000,
      }),
    )
    renderCard(<BillingExceptionsCard from="2026-07-01" to="2026-07-31" />)

    const anomalias = await screen.findByTestId('excecoes-anomalias')
    expect(anomalias).toHaveTextContent(
      'Precisa ação: 3 chamados fechados sem data de conclusão · 1h 45m fora de qualquer fatura',
    )

    const postergado = screen.getByTestId('excecoes-postergado')
    expect(postergado).toHaveTextContent(
      'Postergado: 12 chamados ainda abertos · 15h 0m entram na fatura de quando o chamado fechar (não exige ação).',
    )
  })

  it('só a linha ACIONÁVEL pede ação — a informativa nega explicitamente', async () => {
    mockedSummary.mockResolvedValue(
      summary({
        anomaliasCount: 1,
        anomaliasSegundos: 3600,
        postergadoCount: 5,
        postergadoSegundos: 7200,
      }),
    )
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    const anomalias = await screen.findByTestId('excecoes-anomalias')
    const postergado = screen.getByTestId('excecoes-postergado')

    expect(anomalias).toHaveTextContent('Precisa ação')
    expect(postergado).toHaveTextContent('não exige ação')
    expect(postergado).not.toHaveTextContent('Precisa ação')
    // Singular correto nas duas.
    expect(anomalias).toHaveTextContent('1 chamado fechado sem data de conclusão')
  })

  it('o TOM de alerta vem só das anomalias: postergado > 0 e anomalias 0 ⇒ card neutro', async () => {
    mockedSummary.mockResolvedValue(
      summary({ postergadoCount: 40, postergadoSegundos: 360000 }),
    )
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    await waitFor(() =>
      expect(screen.getByTestId('excecoes-postergado')).toHaveTextContent(
        '40 chamados ainda abertos · 100h 0m entram na fatura de quando o chamado fechar',
      ),
    )
    // Sem fundo de alerta: pedir atenção onde não há ação é o mesmo defeito de
    // misturar as duas seções.
    expect(card().className).not.toContain('bg-excecao-fatura-bg')
    expect(card().className).toContain('bg-card')
    // Mas o botão existe: há o que inspecionar.
    expect(screen.getByRole('button', { name: /conferir/i })).toBeInTheDocument()
  })

  it('anomalias > 0 ⇒ card em tom de alerta', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 2, anomaliasSegundos: 100 }))
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    await waitFor(() => expect(card().className).toContain('bg-excecao-fatura-bg'))
  })
})

describe('BillingExceptionsCard — nota do ponto cego (F-15)', () => {
  it('com contagem: mostra o número de chamados não classificados', async () => {
    mockedSummary.mockResolvedValue(
      summary({ anomaliasCount: 1, anomaliasSegundos: 60, naoClassificadosCount: 7 }),
    )
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    const nota = await screen.findByTestId('excecoes-nota-cega')
    expect(nota).toHaveTextContent(
      '7 chamados não puderam ser classificados (estágio sem cadastro) e não aparecem em nenhuma das seções.',
    )
  })

  it('AUSENTE: a nota aparece SEM número (o buraco continua visível)', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 1, anomaliasSegundos: 60 }))
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    const nota = await screen.findByTestId('excecoes-nota-cega')
    expect(nota).toHaveTextContent(
      'Chamados cujo estágio não tem cadastro não entram nesta conferência — a contagem ainda não está disponível.',
    )
  })

  it('ZERO de verdade: nenhuma nota (não há ponto cego a declarar)', async () => {
    mockedSummary.mockResolvedValue(
      summary({ anomaliasCount: 1, anomaliasSegundos: 60, naoClassificadosCount: 0 }),
    )
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    await screen.findByTestId('excecoes-anomalias')
    expect(screen.queryByTestId('excecoes-nota-cega')).not.toBeInTheDocument()
  })
})

describe('BillingExceptionsCard — período e modal', () => {
  it('repassa o período da tela à requisição (e não o mês corrente do backend)', async () => {
    mockedSummary.mockResolvedValue(summary())
    renderCard(<BillingExceptionsCard from="2026-05-10" to="2026-05-20" />)

    await waitFor(() => expect(mockedSummary).toHaveBeenCalled())
    expect(mockedSummary.mock.calls[0][0]).toEqual({ from: '2026-05-10', to: '2026-05-20' })
  })

  it('sem período filtrado, from/to vão nulos e as frases falam do conjunto inteiro', async () => {
    mockedSummary.mockResolvedValue(summary())
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    await waitFor(() =>
      expect(
        screen.getByText(
          /Nenhum chamado exige conferência: todo chamado em estágio fechado tem data de conclusão/,
        ),
      ).toBeInTheDocument(),
    )
    expect(mockedSummary.mock.calls[0][0]).toEqual({ from: null, to: null })
  })

  it('"Conferir" abre o modal na seção ACIONÁVEL e devolve o foco ao fechar', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 1, anomaliasSegundos: 3600 }))
    renderCard(<BillingExceptionsCard from="2026-07-01" to="2026-07-31" />)

    const botao = await screen.findByRole('button', { name: /conferir/i })
    await userEvent.click(botao)

    const dialog = screen.getByRole('dialog')
    // Abre em "Precisa ação": a primeira pergunta do gestor é se algo exige ação.
    expect(within(dialog).getByRole('tab', { name: /Precisa ação/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await waitFor(() => expect(mockedLista.mock.calls[0][0].tipo).toBe('anomalia'))

    await userEvent.click(within(dialog).getByRole('button', { name: 'Fechar modal' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // O foco volta ao gatilho — sem isso o usuário de teclado é jogado ao início da página.
    await waitFor(() => expect(botao).toHaveFocus())
  })

  /**
   * 121/F2 — o requisito de §5.3 ("Modal com foco preso **e** devolve o foco ao
   * gatilho") são DOIS mecanismos com donos diferentes: a devolução é deste componente
   * (teste acima) e a prisão é do `Modal` compartilhado. Um caso só dava a impressão de
   * cobrir os dois — o retorno funcionava e o trap não existia. Este é o caso que
   * faltava, e mora no consumidor porque é ele que tem o requisito.
   *
   * Travessia REAL, ancorada no foco inicial do dialog, com a asserção de contenção em
   * TODA parada (AP-QA-007). Medição do QA antes da correção:
   * `["Fechar modal", "Conferir exceções de faturamento", "BODY"]`.
   */
  it('foco PRESO no modal: o anel de Tab fecha dentro do dialog e nunca alcança "Conferir" nem o BODY', async () => {
    mockedSummary.mockResolvedValue(summary({ anomaliasCount: 1, anomaliasSegundos: 3600 }))
    // Com a listagem VAZIA o modal teria 3 focáveis e o anel seria trivial: a lista real
    // (tabela + ordenação + paginação) é o que faz a travessia valer alguma coisa.
    mockedLista.mockResolvedValue({
      items: [itemExcecao(1), itemExcecao(2)],
      totalCount: 2,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })
    renderCard(<BillingExceptionsCard from="2026-07-01" to="2026-07-31" />)

    const gatilho = await screen.findByRole('button', { name: /conferir/i })
    await userEvent.click(gatilho)
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('table')).toBeInTheDocument())

    const inicial = document.activeElement
    expect(inicial).toBe(within(dialog).getByRole('button', { name: 'Fechar modal' }))

    // Ida: tabula até o anel fechar. Cada parada é conferida — o defeito mora na
    // vizinha, não na primeira.
    expect(await percorrerAnel(dialog, inicial, gatilho)).toBeGreaterThan(5)
    expect(document.activeElement).toBe(inicial)

    // Volta: Shift+Tab a partir do MESMO ponto — foi este o passo que reprovou.
    expect(await percorrerAnel(dialog, inicial, gatilho, true)).toBeGreaterThan(5)
    expect(document.activeElement).toBe(inicial)
  })

  it('naoClassificadosCount `null` do wire: nota SEM número, nunca "null chamados" (121/F4)', async () => {
    mockedSummary.mockResolvedValue(
      summary({ anomaliasCount: 1, anomaliasSegundos: 60, naoClassificadosCount: null }),
    )
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    const nota = await screen.findByTestId('excecoes-nota-cega')
    expect(nota).toHaveTextContent(
      'Chamados cujo estágio não tem cadastro não entram nesta conferência — a contagem ainda não está disponível.',
    )
    expect(nota.textContent).not.toContain('null')
  })

  it('repassa a contagem de não classificados ao modal', async () => {
    mockedSummary.mockResolvedValue(
      summary({ anomaliasCount: 1, anomaliasSegundos: 60, naoClassificadosCount: 4 }),
    )
    renderCard(<BillingExceptionsCard from={null} to={null} />)

    await userEvent.click(await screen.findByRole('button', { name: /conferir/i }))

    expect(screen.getByTestId('excecoes-nota-cega-modal')).toHaveTextContent(
      '4 chamados não puderam ser classificados',
    )
  })
})
