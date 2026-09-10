/**
 * 133/FE-2 — a trava da caixa "Cobrar por fora do plano" no painel (T-FE2-3 … T-FE2-9).
 *
 * Como estes casos estão escritos, contra os padrões que passam nos dois mundos
 * (`rules/tests.md` § Prova de detecção):
 *
 *  - **par travado × livre na MESMA execução**: sem o caso livre, todo assert de trava
 *    passaria num componente que trava tudo, sempre;
 *  - **discriminador para toda prova por ausência**: onde se afirma que a trava resiste ao
 *    clique, existe o caso irmão em que o mesmo clique **alterna** — provando que o ponto
 *    observado é alcançável nos dois cenários;
 *  - **espião com lista, não `raise`**: as escritas são registradas num array e a asserção
 *    é sobre o array (`toEqual([])`), com um submit no mesmo teste provando que o espião
 *    **registra** — "não chamou" com espião morto passaria;
 *  - **identidade, não presença**: o `aria-describedby` do switch é comparado com o `id`
 *    real do parágrafo, não só "o texto está no documento".
 *
 * A árvore é real: RHF, Zod, `Modal`, `Combobox` e `Switch` de verdade; só a camada de
 * serviço (a escrita na API) é falsa.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
  classesDoTexto,
  razaoDoTexto,
  reprovacoesDasFrases,
  varrer,
} from '../../../test/medidor-de-contraste'

/** Espiões com LISTA — o que se assevera é o registro, não "a função lançou". */
const chamadasCreate: unknown[] = []
const chamadasUpdate: unknown[] = []

vi.mock('../services/timeEntryService', () => ({
  createManualTimeEntry: vi.fn(async (payload: unknown) => {
    chamadasCreate.push(payload)
    return { id: 99 }
  }),
  updateManualTimeEntry: vi.fn(async (id: number, payload: unknown) => {
    chamadasUpdate.push({ id, payload })
    return { id }
  }),
  cancelTimeEntry: vi.fn(),
  restoreTimeEntry: vi.fn(),
}))

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}))

import { TimeEntryModal } from './TimeEntryModal'
import type { TicketTimeEntryDto } from '../types/ticketDetail'

const CATEGORIAS = [
  { value: '2', label: 'Consultoria' },
  { value: '3', label: 'Suporte' },
]
const ATENDENTES = [{ value: '1', label: 'Ana' }]

const TEXTO_DA_TRAVA =
  'A categoria "Consultoria" é sempre cobrada fora do plano de suporte. A marcação é obrigatória e não pode ser desmarcada.'

function apontamento(partial: Partial<TicketTimeEntryDto> = {}): TicketTimeEntryDto {
  return {
    id: 5,
    userId: 1,
    agenteNome: 'Ana',
    serviceCategoryId: 2,
    categorizacaoNome: 'Consultoria',
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
      {
        id: 11,
        type: 'WORK',
        segmentStart: '2026-07-10T13:00:00Z',
        segmentEnd: '2026-07-10T14:00:00Z',
      },
    ],
    ...partial,
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

type Opcoes = {
  categoriasQueForcam?: ReadonlySet<string>
  mode?: 'create' | 'edit'
  entry?: TicketTimeEntryDto
}

function montar({ categoriasQueForcam = new Set<string>(), mode = 'create', entry }: Opcoes = {}) {
  return render(
    <Wrapper>
      <button type="button">âncora</button>
      <TimeEntryModal
        isOpen
        mode={mode}
        ticketId={42}
        ticketLabel="#4321 — Erro ao emitir nota"
        entry={entry}
        agentOptions={ATENDENTES}
        categoryOptions={CATEGORIAS}
        categoriasQueForcam={categoriasQueForcam}
        canChangeAgent
        currentUserId={1}
        canManage={false}
        onClose={vi.fn()}
        onRequestCancel={vi.fn()}
        onSubmitted={vi.fn()}
      />
    </Wrapper>,
  )
}

async function selecionarCategoria(user: ReturnType<typeof userEvent.setup>, rotulo: string) {
  await user.click(screen.getByRole('combobox', { name: /Categorização/ }))
  await user.click(screen.getByRole('option', { name: rotulo }))
}

function oSwitch() {
  return screen.getByRole('switch', { name: 'Cobrar por fora do plano' })
}

async function preencherHorarios(user: ReturnType<typeof userEvent.setup>) {
  const inicio = screen.getByLabelText('Início')
  await user.clear(inicio)
  await user.type(inicio, '2026-07-10T13:00')
  const fim = screen.getByLabelText('Fim')
  await user.clear(fim)
  await user.type(fim, '2026-07-10T14:00')
}

describe('TimeEntryModal — trava por categoria (133)', () => {
  beforeEach(() => {
    chamadasCreate.length = 0
    chamadasUpdate.length = 0
  })

  it('T-FE2-3 · categoria COM flag: marca, trava e explica — com a explicação associada', async () => {
    const user = userEvent.setup()
    montar({ categoriasQueForcam: new Set(['2']) })

    await selecionarCategoria(user, 'Consultoria')

    const sw = oSwitch()
    expect(sw).toHaveAttribute('aria-checked', 'true')
    expect(sw).toHaveAttribute('aria-disabled', 'true')

    // O texto nomeia a categoria — é regra de negócio dita ao usuário, não copy genérica.
    const apoio = screen.getByText(TEXTO_DA_TRAVA)
    // Identidade: o aria-describedby aponta para ESTE parágrafo, não para o nada.
    expect(apoio.id).not.toBe('')
    expect(sw.getAttribute('aria-describedby')).toBe(apoio.id)
    expect(document.getElementById(apoio.id)).toBe(apoio)

    // Visível e permanente: não é `title`, não é hover, não é foco.
    expect(sw).not.toHaveAttribute('title')
    expect(apoio).toBeVisible()
    expect(apoio).not.toHaveAttribute('hidden')
  })

  it('T-FE2-4 · companheira positiva: categoria SEM flag continua livre e alternável', async () => {
    const user = userEvent.setup()
    montar({ categoriasQueForcam: new Set(['2']) })

    await selecionarCategoria(user, 'Suporte')

    const sw = oSwitch()
    expect(sw).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText(TEXTO_DA_TRAVA)).toBeNull()
    // O texto genérico continua no lugar (o parágrafo é permanente; só o conteúdo muda).
    expect(screen.getByText(/Marca este apontamento como faturável/)).toBeInTheDocument()

    // Discriminador: o mesmo clique que "não faz nada" no caso travado ALTERNA aqui.
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await user.click(sw)
    expect(oSwitch()).toHaveAttribute('aria-checked', 'true')
    await user.click(oSwitch())
    expect(oSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('T-FE2-5 · a trava resiste ao clique E o valor coagido chega ao payload', async () => {
    const user = userEvent.setup()
    montar({ categoriasQueForcam: new Set(['2']) })

    await selecionarCategoria(user, 'Consultoria')
    await user.click(oSwitch())
    expect(oSwitch()).toHaveAttribute('aria-checked', 'true')

    await preencherHorarios(user)
    await user.click(screen.getByRole('button', { name: 'Adicionar' }))

    // Valor literal escrito à mão — nada derivado da própria resposta.
    expect(chamadasCreate).toHaveLength(1)
    expect(chamadasCreate[0]).toMatchObject({
      ticketId: 42,
      userId: 1,
      serviceCategoryId: 2,
      billableOutsidePlan: true,
    })
  })

  it('T-FE2-6 · chegada tardia das opções: o índice que resolve DEPOIS ainda trava', async () => {
    // O modal abre antes de `useModalOptions` resolver (a query só é habilitada na
    // abertura). Travar apenas no `onChange` do combo deixaria este caso de fora.
    const user = userEvent.setup()
    const { rerender } = montar({ categoriasQueForcam: new Set() })

    await selecionarCategoria(user, 'Consultoria')
    expect(oSwitch()).toHaveAttribute('aria-checked', 'false')
    expect(oSwitch()).not.toHaveAttribute('aria-disabled')

    rerender(
      <Wrapper>
        <button type="button">âncora</button>
        <TimeEntryModal
          isOpen
          mode="create"
          ticketId={42}
          ticketLabel="#4321 — Erro ao emitir nota"
          agentOptions={ATENDENTES}
          categoryOptions={CATEGORIAS}
          categoriasQueForcam={new Set(['2'])}
          canChangeAgent
          currentUserId={1}
          canManage={false}
          onClose={vi.fn()}
          onRequestCancel={vi.fn()}
          onSubmitted={vi.fn()}
        />
      </Wrapper>,
    )

    expect(oSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(oSwitch()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(TEXTO_DA_TRAVA)).toBeInTheDocument()
  })

  it('T-FE2-7 · o texto da trava passa AA (5,47:1 sobre o painel branco do modal)', async () => {
    const user = userEvent.setup()
    montar({ categoriasQueForcam: new Set(['2']) })
    await selecionarCategoria(user, 'Consultoria')

    // O modal vai para um portal em `document.body` — varrer só o container perderia tudo.
    const { medidas, pulados } = varrer(document.body)
    // `pulados` não é decorativo: um medidor que descarta em silêncio devolve 0 reprovações.
    expect(pulados).toEqual([])

    const trecho = 'é sempre cobrada fora do plano'
    expect(classesDoTexto(medidas, trecho)).toEqual(['text-foreground/70'])
    expect(razaoDoTexto(medidas, trecho).toFixed(2)).toBe('5.47')
    expect(razaoDoTexto(medidas, trecho)).toBeGreaterThanOrEqual(4.5)
    expect(reprovacoesDasFrases(medidas, [trecho])).toEqual([])
  })

  it('T-FE2-8 · travado, o switch continua na ordem de tabulação (é o `aria-disabled`)', async () => {
    const user = userEvent.setup()
    montar({ categoriasQueForcam: new Set(['2']) })
    await selecionarCategoria(user, 'Consultoria')

    // Reancoragem obrigatória: a travessia vem depois de um clique, e foco herdado de
    // clique mede reconciliação em vez de ordem de tabulação (AP-QA-007).
    const combo = screen.getByRole('combobox', { name: /Categorização/ })
    combo.focus()
    expect(combo).toHaveFocus()

    await user.tab()
    // Travessia real: a parada seguinte é o próprio switch travado. Com `disabled`
    // nativo o botão sairia da ordem e a parada seria outra.
    expect(oSwitch()).toHaveFocus()
    expect(oSwitch()).toHaveAttribute('aria-disabled', 'true')
  })

  it('T-FE2-9 · não retroage: abrir apontamento antigo marca e trava SEM escrever nada', async () => {
    const user = userEvent.setup()
    // Apontamento gravado com `false` numa categoria que HOJE força.
    montar({
      mode: 'edit',
      entry: apontamento({ billableOutsidePlan: false, serviceCategoryId: 2 }),
      categoriasQueForcam: new Set(['2']),
    })

    expect(oSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(oSwitch()).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(TEXTO_DA_TRAVA)).toBeInTheDocument()

    // Abrir não é salvar: nenhuma escrita saiu.
    expect(chamadasCreate).toEqual([])
    expect(chamadasUpdate).toEqual([])

    // Discriminador do assert acima, na MESMA execução: o espião REGISTRA quando há
    // submit — sem isto, "não chamou" passaria com o modal quebrado.
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(chamadasUpdate).toHaveLength(1)
    expect(chamadasUpdate[0]).toMatchObject({
      id: 5,
      payload: { serviceCategoryId: 2, billableOutsidePlan: true },
    })
  })

  it('D-133-1 · trocar para categoria SEM flag destrava e MANTÉM o valor marcado', async () => {
    // Opção (c): quem edita decide se desmarca. A catraca só empurra para `true`.
    const user = userEvent.setup()
    montar({ categoriasQueForcam: new Set(['2']) })

    await selecionarCategoria(user, 'Consultoria')
    expect(oSwitch()).toHaveAttribute('aria-checked', 'true')

    await selecionarCategoria(user, 'Suporte')
    expect(oSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(oSwitch()).not.toHaveAttribute('aria-disabled')
    expect(screen.queryByText(TEXTO_DA_TRAVA)).toBeNull()

    // Destravado de verdade: agora o usuário consegue desmarcar.
    await user.click(oSwitch())
    expect(oSwitch()).toHaveAttribute('aria-checked', 'false')
  })
})
