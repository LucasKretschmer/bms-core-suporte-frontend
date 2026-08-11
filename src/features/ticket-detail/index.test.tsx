/**
 * 122/A11Y-2 — devolução do foco ao gatilho nos TRÊS modais do detalhe do ticket
 * (achado da classe medida em `a11y-1-report.md`, itens 5, 6 e 7).
 *
 * Requisito §5.3: "modal com foco preso **E** devolve o foco ao gatilho". A prisão é do
 * `Modal` compartilhado (coberta em `components/ui/Modal.test.tsx` e, no consumidor, em
 * `BillingExceptionsCard.test.tsx`); a DEVOLUÇÃO é de quem abre — está escrito no próprio
 * `Modal.tsx`. Estes casos cobrem a metade que faltava nesta tela.
 *
 * Como estão escritos, contra os padrões que passam nos dois mundos:
 *
 *  - **identidade, nunca ausência**: o assert final é `expect(gatilho).toHaveFocus()` sobre
 *    o nó capturado ANTES de abrir, mais `expect(gatilho).toBe(<consulta pela tela>)` — que
 *    impede o caso em que o nó foi recriado e o teste passaria medindo um elemento fora do
 *    documento. Não existe assert do tipo "não é o body" como prova principal;
 *  - **discriminador na mesma execução**: antes de fechar, o teste prova que o foco está
 *    DENTRO do dialog e que **não** está no gatilho. Sem isso, todos passariam num mundo em
 *    que o foco nunca saiu do gatilho — o ponto observado é alcançado nos dois cenários.
 *
 * Hooks REAIS (react-query, RHF, Zod, o `Modal` de verdade); só a camada de serviço é fake.
 * O que se quer provar é o comportamento do foco na árvore real, não que um mock foi chamado.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

vi.mock('./services/ticketDetailService', () => ({
  getTicketById: vi.fn(),
  listTicketTimeEntries: vi.fn(),
}))
vi.mock('./services/modalOptionsService', () => ({
  listAgentOptions: vi.fn(),
  listActiveCategoryOptions: vi.fn(),
}))
vi.mock('../../hooks/usePermissions', () => ({ usePermissions: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}))

import TicketDetailPage from './index'
import { getTicketById, listTicketTimeEntries } from './services/ticketDetailService'
import { listActiveCategoryOptions, listAgentOptions } from './services/modalOptionsService'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../hooks/useAuth'
import type { TicketHeaderDto, TicketTimeEntryDto } from './types/ticketDetail'

const mockedHeader = vi.mocked(getTicketById)
const mockedEntries = vi.mocked(listTicketTimeEntries)
const mockedAgents = vi.mocked(listAgentOptions)
const mockedCategories = vi.mocked(listActiveCategoryOptions)
const mockedPermissions = vi.mocked(usePermissions)
const mockedAuth = vi.mocked(useAuth)

const header: TicketHeaderDto = {
  id: 42,
  hubspotTicketId: '90001',
  assunto: 'Erro na emissão',
  categoria: null,
  pipelineStage: 'Em atendimento',
  owner: null,
  client: { id: 7, nomeFantasia: 'Acme', razaoSocial: 'Acme LTDA', cnpj: null },
  requester: null,
  hubspotUrl: null,
  conteudo: null,
  hsCriadoEm: null,
}

function entry(partial: Partial<TicketTimeEntryDto> = {}): TicketTimeEntryDto {
  return {
    id: 1,
    userId: 9,
    agenteNome: 'Ana',
    serviceCategoryId: 3,
    categorizacaoNome: 'Suporte',
    billableOutsidePlan: false,
    status: 'COMPLETED',
    startTime: '2026-07-10T13:00:00Z',
    endTime: '2026-07-10T14:00:00Z',
    totalSeconds: 3600,
    note: null,
    pendingCategory: false,
    canceladoPorUserId: null,
    canceladoPorNome: null,
    segments: [
      { id: 11, type: 'WORK', segmentStart: '2026-07-10T13:00:00Z', segmentEnd: '2026-07-10T14:00:00Z' },
    ],
    ...partial,
  }
}

/** COMPLETED com tempo → botões "editar" e "Descartar apontamento" no card. */
const apontamentoConcluido = entry({ id: 1 })
/** CANCELLED → botão "Restaurar apontamento" no card (e nenhum "editar"). */
const apontamentoCancelado = entry({
  id: 2,
  status: 'CANCELLED',
  agenteNome: 'Bruno',
  totalSeconds: 0,
  canceladoPorNome: 'Chefe',
  note: 'Lançado no ticket errado',
})

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  // `from={undefined}`: breadcrumb sem <Link>, o que dispensa contexto de router.
  return render(<TicketDetailPage ticketId={42} from={undefined} />, { wrapper })
}

/**
 * Discriminador — roda na MESMA execução do caso, antes de fechar o modal. Prova que o
 * foco realmente saiu do gatilho e entrou no dialog; sem ele, o assert final passaria
 * também num mundo em que o foco nunca se moveu.
 */
async function esperarFocoDentroDoDialog(dialog: HTMLElement, gatilho: HTMLElement) {
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
  expect(document.activeElement).not.toBe(gatilho)
  expect(document.activeElement).not.toBe(document.body)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedHeader.mockResolvedValue(header)
  mockedEntries.mockResolvedValue([apontamentoConcluido, apontamentoCancelado])
  mockedAgents.mockResolvedValue([])
  mockedCategories.mockResolvedValue([])
  mockedAuth.mockReturnValue({
    user: { id: 9, nome: 'Ana', email: 'ana@migrate.info', role: 'GERENTE' },
    isAuthenticated: true,
  } as unknown as ReturnType<typeof useAuth>)
  mockedPermissions.mockReturnValue({
    role: 'GERENTE',
    isCoordenadorOuAcima: true,
    isGerentePlus: true,
    isAtendente: false,
    isGestor: true,
    primaryTeamId: null,
    isAuthenticated: true,
  })
})

describe('TicketDetailPage — §5.3: o modal devolve o foco ao gatilho', () => {
  it('TimeEntryModal: fechar devolve o foco ao "editar" do card que o abriu', async () => {
    renderPage()

    const gatilho = await screen.findByRole('button', { name: /editar/i })
    await userEvent.click(gatilho)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Editar lançamento' })).toBeInTheDocument()
    await esperarFocoDentroDoDialog(dialog, gatilho)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Fechar modal' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await waitFor(() => expect(gatilho).toHaveFocus())
    // Identidade: o nó focado é o gatilho VIVO da tela — não um nó órfão homônimo.
    expect(gatilho).toBe(screen.getByRole('button', { name: /editar/i }))
  })

  it('CancelTimeEntryDialog: fechar devolve o foco ao "Descartar apontamento" do card', async () => {
    renderPage()

    const gatilho = await screen.findByRole('button', { name: 'Descartar apontamento' })
    await userEvent.click(gatilho)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Descartar apontamento' }),
    ).toBeInTheDocument()
    await esperarFocoDentroDoDialog(dialog, gatilho)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Fechar modal' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await waitFor(() => expect(gatilho).toHaveFocus())
    expect(gatilho).toBe(screen.getByRole('button', { name: 'Descartar apontamento' }))
  })

  it('Modal "Restaurar apontamento": fechar devolve o foco ao "Restaurar" do card', async () => {
    renderPage()

    const gatilho = await screen.findByRole('button', { name: 'Restaurar apontamento' })
    await userEvent.click(gatilho)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Restaurar apontamento' }),
    ).toBeInTheDocument()
    await esperarFocoDentroDoDialog(dialog, gatilho)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Fechar modal' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await waitFor(() => expect(gatilho).toHaveFocus())
    expect(gatilho).toBe(screen.getByRole('button', { name: 'Restaurar apontamento' }))
  })

  /**
   * Encadeamento (`onRequestCancel`): o TimeEntryModal fecha e o diálogo de cancelamento
   * abre no mesmo passo. O gatilho de dentro do modal desaparece com ele, então quem
   * responde pelo foco continua sendo o "editar" do card — sem a transferência do
   * `triggerRef`, o fim do fluxo largaria o foco no `body`.
   */
  it('modal → diálogo de cancelamento: ao fim do fluxo o foco volta ao "editar" original', async () => {
    renderPage()

    const gatilho = await screen.findByRole('button', { name: /editar/i })
    await userEvent.click(gatilho)

    const modal = await screen.findByRole('dialog')
    await userEvent.click(within(modal).getByRole('button', { name: 'Descartar apontamento' }))

    const dialogo = await screen.findByRole('dialog')
    expect(
      within(dialogo).getByRole('heading', { name: 'Descartar apontamento' }),
    ).toBeInTheDocument()
    // Discriminador: o foco entrou no NOVO dialog e não voltou ao gatilho no caminho.
    await esperarFocoDentroDoDialog(dialogo, gatilho)

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Fechar modal' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await waitFor(() => expect(gatilho).toHaveFocus())
    expect(gatilho).toBe(screen.getByRole('button', { name: /editar/i }))
  })
})
