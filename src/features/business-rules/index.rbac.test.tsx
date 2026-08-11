/**
 * 122/REG-1-FE — RBAC da tela de Configurações (decisão D16 × D19).
 *
 * O que este arquivo prova (e o que o teste de componente NÃO prova): que a página liga o
 * card global a `isGerentePlus`, e não a `isCoordenadorOuAcima`. Um `GlobalRulesCard`
 * perfeito recebendo `canEdit={isCoordenadorOuAcima}` passaria em todos os testes de
 * componente e entregaria o defeito.
 *
 * Prova de detecção:
 * - trocar `canEdit={isGerentePlus}` por `canEdit={isCoordenadorOuAcima}` (ou por `true`)
 *   → cai "COORDENADOR: card global somente-leitura";
 * - trocar por `false` → cai "GERENTE: card global editável";
 * - travar a escrita por equipe de carona (o que a D19 proíbe) → cai "COORDENADOR:
 *   continua salvando a regra da EQUIPE", que é a companheira positiva de todas as
 *   asserções negativas deste arquivo.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BusinessRulesPage from './index'
import { usePermissions } from '../../hooks/usePermissions'
import { useGlobalRules, useTeamRules, useTeamsList } from './hooks/useBusinessRules'
import { useRuleMutations } from './hooks/useRuleMutations'
import { GLOBAL_IDLE_KEY, type BusinessRuleDto } from './types/businessRule'

vi.mock('../../hooks/usePermissions')
vi.mock('./hooks/useBusinessRules')
vi.mock('./hooks/useRuleMutations')

const mockedPermissions = vi.mocked(usePermissions)
const mockedGlobalRules = vi.mocked(useGlobalRules)
const mockedTeamsList = vi.mocked(useTeamsList)
const mockedTeamRules = vi.mocked(useTeamRules)
const mockedRuleMutations = vi.mocked(useRuleMutations)

const mutate = vi.fn()

const GLOBAL_RULE: BusinessRuleDto = {
  id: 42,
  teamId: null,
  chave: GLOBAL_IDLE_KEY,
  valor: 5,
  criadoEm: '2026-08-05T00:00:00Z',
  atualizadoEm: '2026-08-05T00:00:00Z',
}

const TEAM_RULE: BusinessRuleDto = {
  id: 7,
  teamId: 3,
  chave: 'singleActiveTimer',
  valor: true,
  criadoEm: '2026-08-05T00:00:00Z',
  atualizadoEm: '2026-08-05T00:00:00Z',
}

type Papel = 'COORDENADOR' | 'GERENTE'

function comPapel(papel: Papel) {
  mockedPermissions.mockReturnValue({
    role: papel,
    isCoordenadorOuAcima: true,
    isGerentePlus: papel === 'GERENTE',
    isAtendente: false,
    isGestor: true,
    primaryTeamId: null,
    isAuthenticated: true,
  })
}

/**
 * O `<label>` do campo envolve também o botão do `InfoIcon`, então `getByLabelText`
 * casa dois elementos. `role="spinbutton"` é o input `type="number"` — único na tela.
 */
function getIdleInput(): HTMLInputElement {
  return screen.getByRole('spinbutton') as HTMLInputElement
}

/**
 * Resolve o toggle pelo rótulo visível, atravessando o `htmlFor` do `<label>`
 * (mesmo helper de TeamRulesCard.test.tsx — `role=switch` não herda nome de `<label for>`).
 */
function getToggle(labelText: string): HTMLElement {
  const label = screen.getByText(labelText).closest('label')
  expect(label).not.toBeNull()
  const control = document.getElementById((label as HTMLLabelElement).htmlFor)
  expect(control).not.toBeNull()
  return control as HTMLElement
}

describe('BusinessRulesPage — D16 restringe a ESCRITA global, D19 mantém a leitura', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockedGlobalRules.mockReturnValue({
      data: [GLOBAL_RULE],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useGlobalRules>)

    mockedTeamsList.mockReturnValue({
      data: [{ id: 3, nome: 'Suporte', gerencia: null }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTeamsList>)

    mockedTeamRules.mockReturnValue({
      3: { rules: [TEAM_RULE], isLoading: false, isError: false },
    })

    mockedRuleMutations.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useRuleMutations>)
  })

  it('GERENTE: card global EDITÁVEL — alterar e sair do campo grava com teamId null', () => {
    comPapel('GERENTE')
    render(<BusinessRulesPage />)

    const input = getIdleInput()
    expect(input).not.toHaveAttribute('readonly')
    expect(screen.queryByText('Somente leitura')).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.blur(input)

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith({
      ruleId: 42,
      teamId: null,
      chave: GLOBAL_IDLE_KEY,
      valor: 12,
    })
  })

  it('COORDENADOR: card global SOMENTE-LEITURA — visível, com motivo, e a escrita não sai', () => {
    comPapel('COORDENADOR')
    render(<BusinessRulesPage />)

    const input = getIdleInput()
    // Visível (D19 manteve a leitura): o valor atual continua na tela.
    expect(input).toHaveValue(5)
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByText('Somente leitura')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.blur(input)

    expect(mutate).not.toHaveBeenCalled()
  })

  it('COORDENADOR: continua salvando a regra da EQUIPE (D19 — a leitura e a escrita por equipe não mudam)', () => {
    comPapel('COORDENADOR')
    render(<BusinessRulesPage />)

    // Companheira POSITIVA do teste acima, na mesma configuração de papel: prova que
    // "nada foi gravado" ali é efeito da restrição global, não de a tela estar inerte.
    expect(screen.getByRole('heading', { name: 'Suporte' })).toBeInTheDocument()

    fireEvent.click(getToggle('Timer único'))

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith({
      ruleId: 7,
      teamId: 3,
      chave: 'singleActiveTimer',
      valor: false,
    })
  })

  it('COORDENADOR: a lista de equipes NÃO é filtrada (a D16 não toca em GET /teams)', () => {
    mockedTeamsList.mockReturnValue({
      data: [
        { id: 3, nome: 'Suporte', gerencia: null },
        { id: 4, nome: 'Projetos', gerencia: null },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTeamsList>)
    mockedTeamRules.mockReturnValue({
      3: { rules: [TEAM_RULE], isLoading: false, isError: false },
      4: { rules: [], isLoading: false, isError: false },
    })

    comPapel('COORDENADOR')
    render(<BusinessRulesPage />)

    expect(screen.getByRole('heading', { name: 'Suporte' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Projetos' })).toBeInTheDocument()
    // Cardinalidade assimétrica de propósito (2 equipes, não 1): um filtro por posse
    // deixaria só uma na tela e o assert cairia.
    expect(mockedTeamRules).toHaveBeenCalledWith([3, 4])
  })

  it('ATENDENTE: segue barrado da tela inteira (regressão do guard existente)', () => {
    mockedPermissions.mockReturnValue({
      role: 'ATENDENTE',
      isCoordenadorOuAcima: false,
      isGerentePlus: false,
      isAtendente: true,
      isGestor: false,
      primaryTeamId: 3,
      isAuthenticated: true,
    })
    render(<BusinessRulesPage />)

    expect(screen.getByText(/não tem permissão/i)).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByText('Regras globais')).not.toBeInTheDocument()
  })
})
