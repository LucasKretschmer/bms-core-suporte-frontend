import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { ClientListItemDto } from '../types/reports'
import { ClientCombobox } from './ClientCombobox'
import * as service from '../services/reportsService'

vi.mock('../services/reportsService', () => ({
  listClients: vi.fn(),
}))

function makeClient(overrides: Partial<ClientListItemDto> = {}): ClientListItemDto {
  return {
    id: 1,
    hubspotCompanyId: 100,
    cnpj: '12.345.678/0001-90',
    razaoSocial: 'Acme Tecnologia LTDA',
    nomeFantasia: 'Acme',
    planNome: 'Plano Ouro',
    ...overrides,
  }
}

function emptyPage() {
  return { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 }
}

function renderCombobox(props: Partial<{ showCnpj: boolean }> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(
    <ClientCombobox value={null} onChange={vi.fn()} {...props} />,
    { wrapper },
  )
}

describe('ClientCombobox', () => {
  beforeEach(() => {
    vi.mocked(service.listClients).mockReset()
  })

  it('lista clientes na carga inicial ao abrir, sem digitar', async () => {
    vi.mocked(service.listClients).mockResolvedValue({
      items: [makeClient({ id: 1, nomeFantasia: 'Acme' }), makeClient({ id: 2, nomeFantasia: 'Globex', cnpj: null })],
      totalCount: 2,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })

    const user = userEvent.setup()
    renderCombobox()

    // Carga inicial dispara a busca com search vazio.
    await waitFor(() => {
      expect(service.listClients).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 25 })
    })

    // Abre o dropdown sem digitar nada.
    await user.click(screen.getByRole('combobox'))

    expect(await screen.findByText(/Acme/)).toBeInTheDocument()
    expect(screen.getByText('Globex')).toBeInTheDocument()
  })

  it('refaz a busca server-side ao digitar o termo', async () => {
    vi.mocked(service.listClients).mockResolvedValue(emptyPage())

    const user = userEvent.setup()
    renderCombobox()

    await waitFor(() => {
      expect(service.listClients).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 25 })
    })

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByPlaceholderText('Filtrar…'), 'acme')

    // Debounce de 300ms do Combobox antes de propagar o onSearch.
    await waitFor(() => {
      expect(service.listClients).toHaveBeenCalledWith({ search: 'acme', page: 1, pageSize: 25 })
    })
  })

  it('exibe o CNPJ no rótulo por padrão (showCnpj=true)', async () => {
    vi.mocked(service.listClients).mockResolvedValue({
      items: [makeClient({ id: 1, nomeFantasia: 'Acme', cnpj: '12.345.678/0001-90' })],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })

    const user = userEvent.setup()
    renderCombobox()

    await waitFor(() => expect(service.listClients).toHaveBeenCalled())
    await user.click(screen.getByRole('combobox'))

    expect(
      await screen.findByText('Acme (12.345.678/0001-90)'),
    ).toBeInTheDocument()
  })

  it('oculta o CNPJ do rótulo quando showCnpj=false (exibe só o nome)', async () => {
    vi.mocked(service.listClients).mockResolvedValue({
      items: [makeClient({ id: 1, nomeFantasia: 'Acme', cnpj: '12.345.678/0001-90' })],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    })

    const user = userEvent.setup()
    renderCombobox({ showCnpj: false })

    await waitFor(() => expect(service.listClients).toHaveBeenCalled())
    await user.click(screen.getByRole('combobox'))

    // Nome aparece sem o CNPJ entre parênteses.
    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.queryByText(/12\.345\.678\/0001-90/)).not.toBeInTheDocument()
  })

  it('mantém a busca por CNPJ mesmo com showCnpj=false (server-side)', async () => {
    vi.mocked(service.listClients).mockResolvedValue(emptyPage())

    const user = userEvent.setup()
    renderCombobox({ showCnpj: false })

    await waitFor(() => {
      expect(service.listClients).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 25 })
    })

    await user.click(screen.getByRole('combobox'))
    await user.type(screen.getByPlaceholderText('Filtrar…'), '12.345.678/0001-90')

    // O termo de CNPJ é enviado ao servidor (busca por CNPJ continua funcionando).
    await waitFor(() => {
      expect(service.listClients).toHaveBeenCalledWith({
        search: '12.345.678/0001-90',
        page: 1,
        pageSize: 25,
      })
    })
  })

  it('mostra estado vazio quando nenhum cliente é retornado', async () => {
    vi.mocked(service.listClients).mockResolvedValue(emptyPage())

    const user = userEvent.setup()
    renderCombobox()

    await waitFor(() => expect(service.listClients).toHaveBeenCalled())

    await user.click(screen.getByRole('combobox'))

    expect(await screen.findByText('Nenhum resultado.')).toBeInTheDocument()
  })
})
