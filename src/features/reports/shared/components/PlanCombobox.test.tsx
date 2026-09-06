import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { SUPPORT_PLANS_QUERY_KEY } from '../../../support-plans/hooks/useSupportPlans'
import type { SupportPlanDto as SupportPlanDtoDeAdministracao } from '../../../support-plans/types/supportPlan'
import { PlanCombobox } from './PlanCombobox'
import * as service from '../services/reportsService'

vi.mock('../services/reportsService', () => ({
  listSupportPlans: vi.fn(),
}))

/**
 * 124/FE-FIX2 · `D-8` — prova de COMPORTAMENTO de que este combobox não divide entrada de
 * cache com a tela de administração de planos.
 *
 * O teste envenena o cache com a chave da OUTRA tela (importada de lá, nunca escrita à
 * mão) e afirma que o combobox continua lendo a sua própria fonte. Com a chave colidente
 * de volta (`['support-plans']`), o TanStack Query devolve o dado semeado — que está
 * fresco, `staleTime` de 5 min — a `queryFn` daqui **nem é chamada**, e os dois asserts
 * caem.
 */

/** O DTO LARGO, o que a tela de administração escreve no cache dela. */
const PLANOS_DA_TELA_DE_ADMINISTRACAO: SupportPlanDtoDeAdministracao[] = [
  {
    id: 101,
    nome: 'Plano escrito pela tela de administração',
    horasMes: 40,
    precoHoraExtra: 250,
    moeda: 'BRL',
    isActive: true,
    hubspotValor: 'plano_gold',
    slaPrimeiroAtendimentoMinutos: 60,
    slaIsento: false,
    calendarioId: 1,
    clientesVinculados: 14,
  },
  {
    id: 102,
    nome: 'Segundo plano da administração',
    horasMes: 10,
    precoHoraExtra: null,
    moeda: 'BRL',
    isActive: true,
    hubspotValor: null,
    slaPrimeiroAtendimentoMinutos: null,
    slaIsento: true,
    calendarioId: null,
    clientesVinculados: 0,
  },
  {
    id: 103,
    nome: 'Terceiro plano da administração',
    horasMes: 20,
    precoHoraExtra: 100,
    moeda: 'BRL',
    isActive: false,
    hubspotValor: null,
    slaPrimeiroAtendimentoMinutos: null,
    slaIsento: false,
    calendarioId: null,
    clientesVinculados: 3,
  },
]

/** O DTO ESTREITO, o que este combobox busca. Cardinalidade DIFERENTE de propósito. */
const PLANO_DO_RELATORIO = {
  id: 7,
  nome: 'Plano buscado pelo relatório',
  horasMes: 30,
  precoHoraExtra: null,
  moeda: 'BRL',
  isActive: true,
}

function renderCombobox(semear: (cliente: QueryClient) => void = () => {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  semear(queryClient)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<PlanCombobox value={null} onChange={vi.fn()} />, { wrapper })
}

describe('PlanCombobox', () => {
  beforeEach(() => {
    vi.mocked(service.listSupportPlans).mockReset()
    vi.mocked(service.listSupportPlans).mockResolvedValue([PLANO_DO_RELATORIO])
  })

  it('lista os planos da sua própria fonte, com a opção "Todos os planos"', async () => {
    const user = userEvent.setup()
    renderCombobox()

    await waitFor(() => expect(service.listSupportPlans).toHaveBeenCalled())
    await user.click(screen.getByRole('combobox'))

    expect(await screen.findByText('Plano buscado pelo relatório')).toBeInTheDocument()
    // Por `role=option`: "Todos os planos" também é o placeholder do campo fechado.
    expect(screen.getByRole('option', { name: 'Todos os planos' })).toBeInTheDocument()
  })

  it('NÃO lê o cache da tela de administração, mesmo com ele já preenchido (D-8)', async () => {
    const user = userEvent.setup()
    renderCombobox((cliente) => {
      // A chave vem de `useSupportPlans`, não de um literal: se a tela de administração
      // mudar a chave dela, este teste continua envenenando a entrada certa.
      cliente.setQueryData(SUPPORT_PLANS_QUERY_KEY, PLANOS_DA_TELA_DE_ADMINISTRACAO)
    })

    // Companheira POSITIVA: prova que o combobox buscou de fato (asserção negativa
    // sozinha passaria com a tela em branco).
    await waitFor(() => expect(service.listSupportPlans).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByText('Plano buscado pelo relatório')).toBeInTheDocument()

    // Os 3 planos semeados na entrada vizinha não aparecem em nenhum lugar.
    for (const plano of PLANOS_DA_TELA_DE_ADMINISTRACAO) {
      expect(screen.queryByText(plano.nome)).toBeNull()
    }
  })
})
