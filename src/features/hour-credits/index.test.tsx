import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HourCreditDto } from './types/hourCredit'

const {
  mockUsePermissions,
  mockUseHourCredits,
  mockRefetch,
  mockCreateMutateAsync,
  mockUpdateMutateAsync,
  mockRemoveMutate,
} = vi.hoisted(() => ({
  mockUsePermissions: vi.fn(),
  mockUseHourCredits: vi.fn(),
  mockRefetch: vi.fn(),
  mockCreateMutateAsync: vi.fn(),
  mockUpdateMutateAsync: vi.fn(),
  mockRemoveMutate: vi.fn(),
}))

vi.mock('../../hooks/usePermissions', () => ({ usePermissions: mockUsePermissions }))
vi.mock('./hooks/useHourCredits', () => ({
  useHourCredits: mockUseHourCredits,
  HOUR_CREDITS_QUERY_KEY: 'hour-credits',
}))
vi.mock('./hooks/useHourCreditMutations', () => ({
  useHourCreditMutations: () => ({
    create: { mutateAsync: mockCreateMutateAsync, isPending: false },
    update: { mutateAsync: mockUpdateMutateAsync, isPending: false },
    remove: { mutate: mockRemoveMutate, isPending: false },
  }),
}))
// O combo de motivo e o de cliente fazem query própria — fora do escopo desta tela.
vi.mock('./components/MotivoCombobox', () => ({
  MotivoCombobox: () => <div data-testid="motivo-combobox" />,
}))
vi.mock('../reports/shared/components/ClientCombobox', () => ({
  ClientCombobox: () => <div data-testid="client-combobox" />,
}))

import HourCreditsPage from './index'

const GERENTE = { isGerentePlus: true }
const COORDENADOR = { isGerentePlus: false }

const credito: HourCreditDto = {
  id: 10,
  clientId: 42,
  clienteNome: 'Acme',
  horas: 2,
  competencia: '2026-09',
  status: 'vigente',
  origem: 'manual',
  motivoId: 3,
  motivoNome: 'Estorno de Credito Problema - Invoicy',
  criadoEm: '2026-09-08T12:00:00Z',
  criadoPorNome: 'Ana',
}

function estado(parcial: Partial<ReturnType<typeof estadoPadrao>>) {
  mockUseHourCredits.mockReturnValue({ ...estadoPadrao(), ...parcial })
}

function estadoPadrao() {
  return {
    data: { items: [credito], totalCount: 1, page: 1, pageSize: 25, totalPages: 1 },
    isLoading: false,
    isError: false,
    refetch: mockRefetch,
    sortBy: 'criadoem',
    sortDirection: 'desc' as const,
    filters: { clientId: null, competencia: null, status: [], origem: null, search: '' },
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    setSort: vi.fn(),
    setFilters: vi.fn(),
  }
}

describe('HourCreditsPage — permissão GerentePlus (D10)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    estado({})
  })

  it('🔴 COORDENADOR é barrado ANTES do 403: nem a tabela nem as ações existem', () => {
    // A tela é `GerentePlus` (D10). `isCoordenadorOuAcima` NÃO serve aqui — coordenador
    // passaria. As duas asserções juntas distinguem "barrado" de "tela vazia".
    mockUsePermissions.mockReturnValue(COORDENADOR)
    render(<HourCreditsPage />)

    expect(screen.getByText('Você não tem permissão para acessar esta área.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar crédito/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lançar crédito' })).toBeNull()
  })

  it('companheira positiva: GERENTE vê a tabela e o formulário de lançamento', () => {
    mockUsePermissions.mockReturnValue(GERENTE)
    render(<HourCreditsPage />)

    expect(screen.getByRole('button', { name: 'Lançar crédito' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar crédito de Acme' })).toBeInTheDocument()
  })
})

describe('HourCreditsPage — os 3 estados de UI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GERENTE)
  })

  it('carregando: esqueleto, e NENHUMA das outras duas mensagens', () => {
    estado({ data: undefined, isLoading: true })
    const { container } = render(<HourCreditsPage />)

    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText(/Não foi possível carregar/)).toBeNull()
    expect(screen.queryByText(/Nenhum crédito encontrado/)).toBeNull()
  })

  it('erro: mensagem + botão de nova tentativa que chama `refetch`', () => {
    estado({ data: undefined, isError: true })
    render(<HourCreditsPage />)

    expect(screen.getByText('Não foi possível carregar os créditos.')).toBeInTheDocument()
    screen.getByRole('button', { name: /tentar novamente/i }).click()
    expect(mockRefetch).toHaveBeenCalledTimes(1)
  })

  it('vazio: mensagem própria — e a tabela NÃO é renderizada', () => {
    estado({ data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 } })
    render(<HourCreditsPage />)

    expect(screen.getByText('Nenhum crédito encontrado para os filtros selecionados.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('com dados: a tabela existe e o vazio some — companheira positiva dos três', () => {
    estado({})
    render(<HourCreditsPage />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText(/Nenhum crédito encontrado/)).toBeNull()
  })
})

describe('HourCreditsPage — D15 e D8′ na tela', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUsePermissions.mockReturnValue(GERENTE)
    estado({})
  })

  it('D15: o motivo COMPLETO aparece nesta tela (é `GerentePlus`)', () => {
    render(<HourCreditsPage />)
    expect(screen.getByText('Estorno de Credito Problema - Invoicy')).toBeInTheDocument()
  })

  it('🔴 D8′: o formulário NÃO tem nenhum campo de data/competência', () => {
    // O crédito vale UMA competência, derivada no servidor. Um campo de "válido até"
    // aqui é resíduo da revisão 1 — reprovação, não melhoria.
    const { container } = render(<HourCreditsPage />)
    const form = container.querySelector('form[aria-label="Lançar novo crédito"]')
    expect(form).not.toBeNull()
    expect(form?.querySelectorAll('input[type="date"], input[type="month"]').length).toBe(0)
    // Companheira positiva: os campos que DEVEM existir estão lá (senão o assert acima
    // passaria com um formulário quebrado ou vazio).
    expect(form?.querySelector('#novo-credito-horas')).not.toBeNull()
    expect(container.querySelectorAll('[data-testid="motivo-combobox"]').length).toBeGreaterThan(0)
  })
})
