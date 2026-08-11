/**
 * 122/REG-1-FE (decisão D16) — card global somente-leitura para quem não é GerentePlus.
 *
 * Prova de detecção de cada asserção (o que faz ficar vermelho):
 * - "não salva com canEdit=false": remover o `if (!canEdit) return` de `commit()` →
 *   `onSaveIdle` volta a ser chamado e o teste cai. `readOnly` sozinho NÃO segura este
 *   caso: no jsdom `fireEvent.change` escreve no input mesmo com `readOnly`, então o
 *   teste exercita a guarda de verdade, não o atributo.
 * - "salva com canEdit=true" (companheira POSITIVA): sem ela, o assert negativo acima
 *   passaria por vazio — um card quebrado, ou um rótulo trocado, também não salvaria.
 * - "valor continua visível": trocar o card por `return null` quando `!canEdit` (esconder,
 *   que é o que a decisão PROÍBE) derruba este assert.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalRulesCard } from './GlobalRulesCard'
import { GLOBAL_IDLE_KEY, type BusinessRuleDto } from '../types/businessRule'

const onSaveIdle = vi.fn()

function makeIdleRule(minutes: number): BusinessRuleDto {
  return {
    id: 42,
    teamId: null,
    chave: GLOBAL_IDLE_KEY,
    valor: minutes,
    criadoEm: '2026-08-05T00:00:00Z',
    atualizadoEm: '2026-08-05T00:00:00Z',
  }
}

function renderCard(canEdit: boolean, isSaving = false) {
  return render(
    <GlobalRulesCard
      rules={[makeIdleRule(5)]}
      isSaving={isSaving}
      canEdit={canEdit}
      onSaveIdle={onSaveIdle}
    />,
  )
}

/**
 * O `<label>` do campo envolve também o botão do `InfoIcon`, então `getByLabelText`
 * casa dois elementos. `role="spinbutton"` é o input `type="number"` — único na tela.
 */
function getInput(): HTMLInputElement {
  return screen.getByRole('spinbutton') as HTMLInputElement
}

describe('GlobalRulesCard — escrita restrita a GerentePlus (122/D16)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('canEdit=true: alterar e sair do campo salva (companheira positiva)', () => {
    renderCard(true)

    const input = getInput()
    expect(input).not.toHaveAttribute('readonly')

    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.blur(input)

    expect(onSaveIdle).toHaveBeenCalledTimes(1)
    expect(onSaveIdle).toHaveBeenCalledWith({ ruleId: 42, minutes: 30 })
  })

  it('canEdit=false: o valor continua VISÍVEL (o card não é escondido)', () => {
    renderCard(false)

    // Se alguém "resolver" a restrição escondendo o card, este assert cai.
    expect(screen.getByRole('heading', { name: 'Regras globais' })).toBeInTheDocument()
    expect(getInput()).toHaveValue(5)
  })

  it('canEdit=false: a mesma interação NÃO salva e o valor digitado é revertido', () => {
    renderCard(false)

    const input = getInput()
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.blur(input)

    expect(onSaveIdle).not.toHaveBeenCalled()
    expect(input).toHaveValue(5)
  })

  it('canEdit=false: o campo é somente-leitura e o motivo é texto na tela, associado por aria-describedby', () => {
    renderCard(false)

    const input = getInput()
    expect(input).toHaveAttribute('readonly')
    // `disabled` tiraria o campo da ordem de tabulação e tornaria o motivo inalcançável
    // por teclado — a escolha de `readOnly` é deliberada e está travada aqui.
    expect(input).not.toBeDisabled()

    const describedBy = input.getAttribute('aria-describedby') ?? ''
    const ids = describedBy.split(' ').filter(Boolean)
    expect(ids.length).toBeGreaterThan(0)

    const textos = ids.map((id) => document.getElementById(id)?.textContent ?? '')
    expect(textos.join(' ')).toMatch(/somente leitura/i)
    expect(textos.join(' ')).toMatch(/gerente/i)

    // Perceptível sem depender só de cor: o estado também é dito por texto.
    expect(screen.getByText('Somente leitura')).toBeInTheDocument()
  })

  it('canEdit=true: nenhum aviso de somente-leitura aparece (discriminador do teste acima)', () => {
    renderCard(true)

    expect(screen.queryByText('Somente leitura')).not.toBeInTheDocument()
    expect(screen.queryByText(/apenas os perfis Gerente/i)).not.toBeInTheDocument()
    // Positiva na mesma execução: o campo está lá, então "não achei o aviso" não é
    // consequência de a tela não ter renderizado.
    expect(getInput()).toBeInTheDocument()
  })

  it('canEdit=true + isSaving: o campo é desabilitado enquanto a mutation corre (regressão)', () => {
    renderCard(true, true)
    expect(getInput()).toBeDisabled()
  })

  it('canEdit=true: valor fora de 1..60 não salva e reverte (regressão)', () => {
    renderCard(true)

    const input = getInput()
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.blur(input)

    expect(onSaveIdle).not.toHaveBeenCalled()
    expect(input).toHaveValue(5)
  })
})
