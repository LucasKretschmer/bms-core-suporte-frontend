import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HourCreditReasonDto } from './types/hourCreditReason'

const { mockUsePermissions, mockUseReasons, mockRefetch, mockCreate, mockUpdateAsync, mockRemove } =
  vi.hoisted(() => ({
    mockUsePermissions: vi.fn(),
    mockUseReasons: vi.fn(),
    mockRefetch: vi.fn(),
    mockCreate: vi.fn(),
    mockUpdateAsync: vi.fn(),
    mockRemove: vi.fn(),
  }))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('./hooks/useHourCreditReasons', () => ({
  useHourCreditReasons: mockUseReasons,
  HOUR_CREDIT_REASONS_QUERY_KEY: 'hour-credit-reasons',
}))
vi.mock('./hooks/useHourCreditReasonMutations', () => ({
  useHourCreditReasonMutations: () => ({
    create: { mutate: mockCreate, isPending: false },
    update: { mutateAsync: mockUpdateAsync, isPending: false },
    remove: { mutate: mockRemove, isPending: false },
  }),
}))

import HourCreditReasonsPage from './index'

const GERENTE = { isGerentePlus: true }
const COORDENADOR = { isGerentePlus: false }

const MOTIVOS: HourCreditReasonDto[] = [
  { id: 1, nome: 'Estorno de Credito Problema - Invoicy', isActive: true, isSistema: true },
  { id: 2, nome: 'Cortesia comercial', isActive: true, isSistema: false },
]

function comLista(data: HourCreditReasonDto[] | undefined, extra: Record<string, unknown> = {}) {
  mockUseReasons.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
    ...extra,
  })
}

describe('HourCreditReasonsPage — permissão GerentePlus (D10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    comLista(MOTIVOS)
  })

  it('🔴 COORDENADOR é barrado: nem a tabela nem o formulário existem', () => {
    mockUsePermissions.mockReturnValue(COORDENADOR)
    render(<HourCreditReasonsPage />)

    expect(screen.getByText('Você não tem permissão para acessar esta área.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Excluir motivo/ })).toBeNull()
  })

  it('companheira positiva: GERENTE vê a lista e o formulário', () => {
    mockUsePermissions.mockReturnValue(GERENTE)
    render(<HourCreditReasonsPage />)

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir motivo Cortesia comercial' })).toBeInTheDocument()
  })
})

describe('HourCreditReasonsPage — os 3 estados de UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GERENTE)
  })

  it('carregando: esqueleto e nenhuma das outras mensagens', () => {
    comLista(undefined, { isLoading: true })
    const { container } = render(<HourCreditReasonsPage />)

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText(/Não foi possível carregar/)).toBeNull()
    expect(screen.queryByText('Nenhum motivo cadastrado.')).toBeNull()
  })

  it('erro: mensagem + nova tentativa que chama `refetch`', async () => {
    comLista(undefined, { isError: true })
    render(<HourCreditReasonsPage />)

    expect(screen.getByText('Não foi possível carregar os motivos.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('vazio: mensagem própria, sem tabela', () => {
    comLista([])
    render(<HourCreditReasonsPage />)

    expect(screen.getByText('Nenhum motivo cadastrado.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('com dados: tabela presente e vazio ausente', () => {
    comLista(MOTIVOS)
    render(<HourCreditReasonsPage />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Nenhum motivo cadastrado.')).toBeNull()
  })
})

describe('HourCreditReasonsPage — o motivo semeado, ponta a ponta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GERENTE)
    comLista(MOTIVOS)
  })

  it('D15: o texto COMPLETO do motivo aparece nesta tela', () => {
    render(<HourCreditReasonsPage />)
    expect(screen.getByText('Estorno de Credito Problema - Invoicy')).toBeInTheDocument()
  })

  it('🔴 clicar em "excluir" do semeado NÃO abre a confirmação — e o motivo está escrito', async () => {
    render(<HourCreditReasonsPage />)

    await userEvent.click(screen.getByRole('button', { name: /Excluir motivo Estorno de Credito/ }))

    // Segunda camada do fail-closed: o handler da página também recusa. Se só a coluna
    // bloqueasse, um caminho novo de chamada abriria o diálogo.
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByText(/não pode ser renomeado nem excluído/)).toBeInTheDocument()
  })

  it('companheira positiva: "excluir" do motivo comum ABRE a confirmação', async () => {
    // Sem este par, uma página que nunca abrisse o diálogo passaria no teste acima.
    render(<HourCreditReasonsPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Excluir motivo Cortesia comercial' }))

    const dialogo = await screen.findByRole('alertdialog')
    expect(dialogo).toHaveTextContent('Cortesia comercial')
    // O texto avisa que o servidor pode recusar (409 MOTIVO_EM_USO) em vez de prometer
    // que a exclusão passa (`AP-FRONTEND-022`).
    expect(dialogo).toHaveTextContent(/a exclusão será recusada/)
  })

  it('confirmar a exclusão dispara o DELETE no ID da linha', async () => {
    render(<HourCreditReasonsPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Excluir motivo Cortesia comercial' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir' }))

    // Id da LINHA, não o primeiro da lista: mandar o id errado apagaria o motivo errado.
    expect(mockRemove).toHaveBeenCalledWith(2, expect.anything())
  })

  it('clicar em "editar" do motivo comum abre o modal com o nome da LINHA', async () => {
    render(<HourCreditReasonsPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Editar motivo Cortesia comercial' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome do motivo/)).toHaveValue('Cortesia comercial')
  })

  it('adicionar motivo com nome vazio não chama a mutation — erro inline', async () => {
    render(<HourCreditReasonsPage />)

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('Informe o nome do motivo.')).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('companheira positiva: nome válido chama a mutation com o nome trimado', async () => {
    render(<HourCreditReasonsPage />)

    await userEvent.type(screen.getByLabelText('Nome do novo motivo'), '  Bonificação  ')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(mockCreate).toHaveBeenCalledWith('Bonificação', expect.anything())
  })
})
