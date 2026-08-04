/**
 * 121/A2 + F-15 — modal de conferência, com as DUAS seções em abas.
 *
 * Hook real, serviço fake **discriminado por params** e com cardinalidade
 * ASSIMÉTRICA (julho/anomalia: 2 linhas · todas: 3 · postergado: 4, com segundos
 * distintos) — com números iguais o teste passaria até com o toggle ou a aba
 * invertidos (rules/tests.md § "cardinalidade simétrica não discrimina").
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement, ReactNode } from 'react'

vi.mock('../../shared/services/reportsService', () => ({
  listBillingExceptions: vi.fn(),
}))

import { listBillingExceptions } from '../../shared/services/reportsService'
import type { BillingExceptionsParams } from '../../shared/services/reportsService'
import { BillingExceptionsModal } from './BillingExceptionsModal'
import type { BillingExceptionItemDto } from '../../shared/types/reports'
import type { PaginatedResponse } from '../../../../types/api'

const mocked = vi.mocked(listBillingExceptions)

function item(
  id: number,
  overrides: Partial<BillingExceptionItemDto> = {},
): BillingExceptionItemDto {
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
    ...overrides,
  }
}

function resposta(
  items: BillingExceptionItemDto[],
): PaginatedResponse<BillingExceptionItemDto> {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 25,
    totalPages: items.length === 0 ? 0 : 1,
  }
}

/** Anomalias em julho: 2 chamados (2h 0m e 0h 30m). Sem período: 3 (+ 5h 0m). */
const JULHO = [
  item(1, { segundosTotais: 7200, assunto: 'Fatura travada em julho' }),
  item(2, { segundosTotais: 1800, assunto: 'Sem data de conclusão' }),
]
const TODAS = [...JULHO, item(3, { segundosTotais: 18000, assunto: 'Exceção antiga' })]

/** Postergado: 4 chamados abertos — quantidade DIFERENTE das anomalias, de propósito. */
const POSTERGADO = [
  item(11, { segundosTotais: 3600, assunto: 'Aberto em andamento', status: 'Em atendimento' }),
  item(12, { segundosTotais: 5400, assunto: 'Aberto aguardando cliente' }),
  item(13, { segundosTotais: 900, assunto: 'Aberto triagem' }),
  item(14, { segundosTotais: 300, assunto: 'Aberto novo' }),
]

function fakeBackend(params: BillingExceptionsParams) {
  if (params.tipo === 'postergado') return Promise.resolve(resposta(POSTERGADO))
  if (params.from === null && params.to === null) return Promise.resolve(resposta(TODAS))
  return Promise.resolve(resposta(JULHO))
}

function renderModal(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(ui, { wrapper })
}

const noop = () => {}

beforeEach(() => {
  vi.clearAllMocks()
  mocked.mockImplementation(fakeBackend)
})

describe('BillingExceptionsModal — estados', () => {
  it('LOADING: skeleton dentro do modal', () => {
    mocked.mockReturnValue(new Promise(() => {}))
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    expect(within(screen.getByRole('dialog')).getByLabelText('Carregando…')).toBeInTheDocument()
  })

  it('ERRO: mensagem própria + retry', async () => {
    mocked.mockRejectedValue(new Error('500'))
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() =>
      expect(
        screen.getByText('Não foi possível carregar as exceções de faturamento.'),
      ).toBeInTheDocument(),
    )

    mocked.mockImplementation(fakeBackend)
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))

    await waitFor(() =>
      expect(screen.getByText('Fatura travada em julho')).toBeInTheDocument(),
    )
  })

  it('ZERO: "nada exige conferência" citando o recorte — e nenhuma tabela', async () => {
    mocked.mockResolvedValue(resposta([]))
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() =>
      expect(
        screen.getByText('Nenhum chamado exige conferência no período filtrado.'),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('COM DADOS: tabela com os valores LITERAIS de cada linha', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const linhas = screen.getAllByRole('row')
    // 1 header + 2 linhas de dados
    expect(linhas).toHaveLength(3)
    expect(within(linhas[1]).getByText('#70001')).toBeInTheDocument()
    expect(within(linhas[1]).getByText('2h 0m')).toBeInTheDocument()
    expect(within(linhas[2]).getByText('0h 30m')).toBeInTheDocument()
    // Paginação com o total do conjunto
    expect(screen.getByText('2 registros')).toBeInTheDocument()
  })

  it('NUNCA expõe a categoria do HubSpot (AP-SECURITY-001) — não há coluna de categoria', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    const cabecalhos = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '')
    expect(cabecalhos.some((h) => /categoria/i.test(h))).toBe(false)
  })
})

describe('BillingExceptionsModal — as duas seções em abas (F-15)', () => {
  it('abre na seção ACIONÁVEL, e é ela que a requisição pede', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    expect(screen.getByRole('tab', { name: /Precisa ação/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: /Postergado/ })).toHaveAttribute(
      'aria-selected',
      'false',
    )
    await waitFor(() => expect(mocked.mock.calls[0][0].tipo).toBe('anomalia'))
  })

  it('trocar de aba troca o conjunto (2 anomalias → 4 postergados) e o tipo enviado', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3)) // header + 2
    expect(screen.getByText('Fatura travada em julho')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /Postergado/ }))

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5)) // header + 4
    expect(screen.getByText('Aberto aguardando cliente')).toBeInTheDocument()
    expect(screen.queryByText('Fatura travada em julho')).not.toBeInTheDocument()
    expect(mocked.mock.calls.at(-1)![0].tipo).toBe('postergado')
  })

  it('cada aba tem a SUA definição — e a de postergado nega ação', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    expect(screen.getByText(/Exige conferência\./)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: /Postergado/ }))

    await waitFor(() =>
      expect(screen.getByText(/Não exige ação\./)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/Exige conferência\./)).not.toBeInTheDocument()
  })

  it('o vazio de cada aba tem frase própria, nunca a da outra', async () => {
    mocked.mockResolvedValue(resposta([]))
    renderModal(<BillingExceptionsModal isOpen onClose={noop} from={null} to={null} />)

    await waitFor(() =>
      expect(
        screen.getByText(
          'Nenhum chamado exige conferência: todo chamado em estágio fechado tem data de conclusão.',
        ),
      ).toBeInTheDocument(),
    )

    await userEvent.click(screen.getByRole('tab', { name: /Postergado/ }))

    await waitFor(() =>
      expect(
        screen.getByText('Nada foi postergado: nenhum chamado aberto com horas apontadas.'),
      ).toBeInTheDocument(),
    )
    expect(
      screen.queryByText(/Nenhum chamado exige conferência/),
    ).not.toBeInTheDocument()
  })

  it('trocar de aba volta à página 1 (a página 7 pode não existir na outra seção)', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('tab', { name: /Postergado/ }))

    await waitFor(() => expect(mocked.mock.calls.at(-1)![0].tipo).toBe('postergado'))
    expect(mocked.mock.calls.at(-1)![0].page).toBe(1)
  })

  /**
   * 121/F1 — cobertura de IDREF é assimétrica por construção: `getByRole('tab')` e o par
   * ATIVO passam sempre, e o defeito morava no irmão que o teste não visitava (a aba
   * "Postergado" apontava para `…-panel-postergado`, id inexistente ⇒ `getElementById`
   * = `null`, medido pelo QA). Por isso este caso ITERA todas as abas e trava a
   * cardinalidade do conjunto — um laço vazio passaria vacuamente.
   */
  it('TODA aba tem aria-controls resolvível — antes e depois de trocar de seção', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    const conferir = () => {
      const abas = screen.getAllByRole('tab')
      for (const aba of abas) {
        const idPainel = aba.getAttribute('aria-controls')
        expect(idPainel, `aba "${aba.textContent ?? ''}" sem aria-controls`).toBeTruthy()
        const painel = document.getElementById(idPainel!)
        expect(
          painel,
          `aria-controls="${idPainel}" da aba "${aba.textContent ?? ''}" não resolve`,
        ).not.toBeNull()
        expect(painel!.getAttribute('role')).toBe('tabpanel')
        expect(painel!.getAttribute('aria-labelledby')).toBe(aba.id)
      }
      return abas.length
    }

    expect(conferir()).toBe(2)

    await userEvent.click(screen.getByRole('tab', { name: /Postergado/ }))
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5))

    expect(conferir()).toBe(2)
    // O painel da seção que saiu de cena fica no DOM só para o id resolver: vazio e
    // fora da árvore de acessibilidade (por isso `getByRole` acha um só).
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'id',
      'billing-exceptions-secoes-panel-postergado',
    )
  })

  it('a nota do ponto cego vale para as duas abas', async () => {
    renderModal(
      <BillingExceptionsModal
        isOpen
        onClose={noop}
        from={null}
        to={null}
        naoClassificadosCount={5}
      />,
    )

    expect(screen.getByTestId('excecoes-nota-cega-modal')).toHaveTextContent(
      '5 chamados não puderam ser classificados',
    )

    await userEvent.click(screen.getByRole('tab', { name: /Postergado/ }))

    await waitFor(() =>
      expect(screen.getByTestId('excecoes-nota-cega-modal')).toHaveTextContent(
        '5 chamados não puderam ser classificados',
      ),
    )
  })
})

/**
 * 121/F7 — o tom de alerta é a informação da aba acionável, e D14 decidiu que ele não
 * pode vazar para a informativa: "Horas presas" ali pede providência onde, por
 * definição, não há nenhuma. Os literais são escritos à mão de propósito — comparar com
 * a própria constante do módulo seria tautologia.
 */
describe('BillingExceptionsModal — a copy da coluna de horas é por seção (F7)', () => {
  it('na aba acionável: "Horas presas", com a explicação de que ficam fora de qualquer fatura', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    expect(
      screen.getByRole('columnheader', { name: /Horas presas/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /fica fora de qualquer fatura/ }),
    ).toBeInTheDocument()
  })

  it('na aba informativa: rótulo NEUTRO e nenhuma palavra alarmista na tela', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('tab', { name: /Postergado/ }))
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(5))

    expect(
      screen.getByRole('columnheader', { name: /Horas do chamado/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /presas/i })).not.toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    // Nem no texto visível…
    expect(dialog.textContent ?? '').not.toMatch(/presa/i)
    // …nem no `aria-label` do ícone de ajuda (que é onde a frase alarmista morava).
    const rotulosDeAjuda = Array.from(dialog.querySelectorAll('[aria-label]')).map(
      (el) => el.getAttribute('aria-label') ?? '',
    )
    expect(rotulosDeAjuda.some((r) => /fora de qualquer fatura/.test(r))).toBe(false)
    // Companheira POSITIVA: a explicação da seção informativa ESTÁ lá — sem ela, "não
    // diz 'presas'" passaria com uma coluna sem `headerInfo` nenhum.
    expect(
      rotulosDeAjuda.some((r) =>
        /Entram na fatura da competência em que o chamado for concluído/.test(r),
      ),
    ).toBe(true)
  })

  it('voltar para a aba acionável restaura "Horas presas" (a copy segue a seção, não a 1ª render)', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('tab', { name: /Postergado/ }))
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /Horas do chamado/ })).toBeInTheDocument(),
    )

    await userEvent.click(screen.getByRole('tab', { name: /Precisa ação/ }))
    await waitFor(() =>
      expect(screen.getByRole('columnheader', { name: /Horas presas/ })).toBeInTheDocument(),
    )
    expect(
      screen.queryByRole('columnheader', { name: /Horas do chamado/ }),
    ).not.toBeInTheDocument()
  })
})

describe('BillingExceptionsModal — toggle "Ignorar período (todas)"', () => {
  it('ligar o toggle omite from/to e traz o conjunto inteiro (2 → 3 linhas)', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3))
    expect(screen.queryByText('Exceção antiga')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch', { name: 'Ignorar período (todas)' }))

    await waitFor(() => expect(screen.getByText('Exceção antiga')).toBeInTheDocument())
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(screen.getByText('5h 0m')).toBeInTheDocument()

    const ultima = mocked.mock.calls.at(-1)![0]
    expect(ultima.from).toBeNull()
    expect(ultima.to).toBeNull()
  })

  it('o texto do recorte acompanha o toggle', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() =>
      expect(
        screen.getByText(/Mostrando as que têm apontamento entre 01\/07\/2026 e 31\/07\/2026\./),
      ).toBeInTheDocument(),
    )

    await userEvent.click(screen.getByRole('switch', { name: 'Ignorar período (todas)' }))

    await waitFor(() =>
      expect(screen.getByText(/Mostrando todas, sem recorte de período\./)).toBeInTheDocument(),
    )
  })
})

describe('BillingExceptionsModal — ordenação', () => {
  it('o default é segundos desc e clicar no mesmo cabeçalho inverte a direção', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    expect(mocked.mock.calls[0][0]).toMatchObject({ sortBy: 'segundos', sortDirection: 'desc' })

    await userEvent.click(screen.getByRole('button', { name: /Horas presas/i }))

    await waitFor(() =>
      expect(mocked.mock.calls.at(-1)![0]).toMatchObject({
        sortBy: 'segundos',
        sortDirection: 'asc',
      }),
    )
  })

  it('trocar de coluna manda o sortKey da whitelist do backend', async () => {
    renderModal(
      <BillingExceptionsModal isOpen onClose={noop} from="2026-07-01" to="2026-07-31" />,
    )

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /Última atividade/i }))

    await waitFor(() =>
      expect(mocked.mock.calls.at(-1)![0]).toMatchObject({
        sortBy: 'ultimaatividade',
        sortDirection: 'desc',
      }),
    )
  })
})
