import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceCategoryDto } from './types/serviceCategory'

const {
  mockUsePermissions,
  mockUseServiceCategories,
  mockUpdateMutateAsync,
  mockToggleMutate,
  mockRefetch,
} = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
  mockUseServiceCategories: vi.fn(),
  mockUpdateMutateAsync: vi.fn(),
  mockToggleMutate: vi.fn(),
  mockRefetch: vi.fn(),
}))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('./hooks/useServiceCategories', () => ({
  useServiceCategories: mockUseServiceCategories,
  SERVICE_CATEGORIES_QUERY_KEY: ['service-categories', { includeInactive: true }],
}))
vi.mock('./hooks/useCategoryMutations', () => ({
  useCategoryMutations: () => ({
    create: { mutate: vi.fn(), isPending: false },
    update: { mutateAsync: mockUpdateMutateAsync, isPending: false },
    toggleActive: { mutate: mockToggleMutate, isPending: false },
    remove: { mutate: vi.fn(), isPending: false },
  }),
}))
vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

import ServiceCategoriesPage from './index'

const categorias: ServiceCategoryDto[] = [
  { id: 7, nome: 'Consultoria', isActive: true },
  { id: 9, nome: 'Plantão', isActive: false },
]

function comLista(data: ServiceCategoryDto[]) {
  mockUseServiceCategories.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
  })
}

const GESTOR = { isCoordenadorOuAcima: true }
const ATENDENTE = { isCoordenadorOuAcima: false }

describe('ServiceCategoriesPage — permissão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    comLista(categorias)
  })

  it('ATENDENTE não vê a tela nem a ação de editar — barrado antes do 403', () => {
    // O PUT exige CoordenadorPlus (`ServiceCategoriesController.cs:68`). A UI precisa
    // barrar ANTES, senão o atendente clica e toma 403.
    // Vermelho se o early-return do gate sair: a tabela renderizaria e o botão "editar"
    // apareceria — é exatamente o par de asserções que distingue as duas situações.
    mockUsePermissions.mockReturnValue(ATENDENTE)
    render(<ServiceCategoriesPage />)

    expect(screen.getByText('Você não tem permissão para acessar esta área.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar categoria/ })).toBeNull()
  })

  it('gestor (CoordenadorPlus) vê "editar" em TODAS as linhas — companheira positiva', () => {
    mockUsePermissions.mockReturnValue(GESTOR)
    render(<ServiceCategoriesPage />)

    expect(screen.getByRole('button', { name: 'Editar categoria Consultoria' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar categoria Plantão' })).toBeInTheDocument()
  })
})

describe('ServiceCategoriesPage — renomear ponta a ponta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GESTOR)
    comLista(categorias)
  })

  it('clicar em "editar" abre o modal com o nome da LINHA clicada', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    await user.click(screen.getByRole('button', { name: 'Editar categoria Plantão' }))

    // Vermelho se o `setToEdit` receber a linha errada (ex.: sempre a primeira) — o
    // usuário renomearia a categoria errada sem perceber.
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nome da categoria/)).toHaveValue('Plantão')
  })

  it('salvar dispara o PUT no ID da linha e fecha o modal', async () => {
    const user = userEvent.setup()
    mockUpdateMutateAsync.mockResolvedValue({ id: 9, nome: 'Plantão N2', isActive: false })
    render(<ServiceCategoriesPage />)

    await user.click(screen.getByRole('button', { name: 'Editar categoria Plantão' }))
    const campo = screen.getByLabelText(/Nome da categoria/)
    await user.clear(campo)
    await user.type(campo, 'Plantão N2')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    // `id: 9` é literal escrito à mão, não derivado da resposta — vermelho se o wiring
    // passar o índice, o id da primeira linha, ou um fallback tipo `?? 0`.
    await waitFor(() =>
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({ id: 9, nome: 'Plantão N2' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('o campo "Nova categoria" da toolbar não é afetado pelo modal (forms independentes)', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    await user.type(screen.getByLabelText('Nome da nova categoria'), 'Treinamento')
    await user.click(screen.getByRole('button', { name: 'Editar categoria Consultoria' }))

    expect(screen.getByLabelText(/Nome da categoria/)).toHaveValue('Consultoria')
    expect(screen.getByLabelText('Nome da nova categoria')).toHaveValue('Treinamento')
  })

  it('fechar o modal devolve o foco ao botão "editar" da linha (a11y)', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    const gatilho = screen.getByRole('button', { name: 'Editar categoria Consultoria' })
    await user.click(gatilho)
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    // A prisão do foco é do `Modal`; a DEVOLUÇÃO é de quem abre (`useReturnFocus`) — dois
    // mecanismos, dois donos. Vermelho se `capture()`/`restore()` saírem do handler: o
    // foco ficaria no `body` e o usuário de teclado voltaria ao topo da página.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Editar categoria Consultoria' })).toHaveFocus(),
    )
  })

  it('renomear e excluir nunca abrem ao mesmo tempo (estados separados)', async () => {
    const user = userEvent.setup()
    render(<ServiceCategoriesPage />)

    await user.click(screen.getByRole('button', { name: 'Editar categoria Consultoria' }))

    // Vermelho se um estado só (`selected`) passar a servir os dois overlays.
    expect(screen.queryByText(/Esta ação não pode ser desfeita/)).toBeNull()
  })
})

describe('ServiceCategoriesPage — estados de UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GESTOR)
  })

  it('loading: skeleton e nenhuma ação de editar', () => {
    mockUseServiceCategories.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    })
    render(<ServiceCategoriesPage />)

    expect(screen.queryByRole('button', { name: /Editar categoria/ })).toBeNull()
    expect(screen.queryByText('Nenhuma categoria cadastrada.')).toBeNull()
  })

  it('erro: ErrorState com retry que chama refetch', async () => {
    const user = userEvent.setup()
    mockUseServiceCategories.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    })
    render(<ServiceCategoriesPage />)

    expect(screen.getByText('Não foi possível carregar as categorias.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Tentar novamente/i }))
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('vazio: EmptyState em vez de tabela em branco', () => {
    comLista([])
    render(<ServiceCategoriesPage />)

    expect(screen.getByText('Nenhuma categoria cadastrada.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar categoria/ })).toBeNull()
  })
})
