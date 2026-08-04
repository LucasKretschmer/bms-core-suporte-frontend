import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamRulesCard } from './TeamRulesCard'
import type { BusinessRuleDto } from '../types/businessRule'

function makeRule(over: Partial<BusinessRuleDto>): BusinessRuleDto {
  return {
    id: 1,
    teamId: 5,
    chave: 'singleActiveTimer',
    valor: true,
    criadoEm: '2026-06-19T00:00:00Z',
    atualizadoEm: '2026-06-19T00:00:00Z',
    ...over,
  }
}

const onSave = vi.fn()

/**
 * Resolve o toggle pelo rótulo visível, atravessando o `htmlFor` do `<label>`.
 * (O `<button role="switch">` não herda nome acessível de `<label for>`, então
 * `getByRole('switch', { name })` não serve aqui.)
 */
function getToggle(labelText: string): HTMLElement {
  const label = screen.getByText(labelText).closest('label')
  expect(label).not.toBeNull()
  const control = document.getElementById((label as HTMLLabelElement).htmlFor)
  expect(control).not.toBeNull()
  return control as HTMLElement
}

function renderCard(rules: BusinessRuleDto[], isSaving = false) {
  return render(
    <TeamRulesCard
      teamNome="Suporte"
      rules={rules}
      isLoading={false}
      isError={false}
      isSaving={isSaving}
      onSave={onSave}
    />,
  )
}

describe('TeamRulesCard (121/AUTH-3 — combo "Ao enviar resposta" removido)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renderiza os 6 toggles e nenhum combo', () => {
    renderCard([])

    // Companheira POSITIVA das negativas abaixo: os 6 controles vivos estão na tela,
    // então "não achei o combo" não é consequência de a tela não ter renderizado.
    expect(screen.getAllByRole('switch')).toHaveLength(6)
    expect(screen.getByText('Timer único')).toBeInTheDocument()
    expect(screen.getByText('Notificar novo chamado na fila')).toBeInTheDocument()

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('Ao enviar resposta')).not.toBeInTheDocument()
  })

  it('regra revogada já persistida no banco não quebra a tela e é ignorada', () => {
    // O backend continua devolvendo a linha órfã de `autoStopOnReply` (nada foi
    // apagado do banco). Ramo explícito de AP-FRONTEND-021: chave PRESENTE e
    // desconhecida — não é renderizada, não é gravada e não é apagada.
    const rules = [
      makeRule({ id: 1, chave: 'singleActiveTimer', valor: true }),
      makeRule({ id: 99, chave: 'autoStopOnReply', valor: 'off' }),
    ]

    renderCard(rules)

    expect(screen.getAllByRole('switch')).toHaveLength(6)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText('Perguntar')).not.toBeInTheDocument()
    expect(screen.queryByText('Encerrar automático')).not.toBeInTheDocument()

    // Ao salvar, a chave revogada e o id 99 nunca aparecem no payload.
    fireEvent.click(getToggle('Timer único'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ ruleId: 1, chave: 'singleActiveTimer', valor: false })
  })

  it('o valor persistido de cada chave viva ainda é lido (o card não ficou inerte)', () => {
    // Discriminador do teste acima: com `singleActiveTimer` = false o toggle vem
    // desmarcado e o clique manda `true`.
    renderCard([makeRule({ id: 7, chave: 'singleActiveTimer', valor: false })])

    const toggle = getToggle('Timer único')
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)
    expect(onSave).toHaveBeenCalledWith({ ruleId: 7, chave: 'singleActiveTimer', valor: true })
  })

  it('desabilita os toggles enquanto salva', () => {
    renderCard([], true)
    for (const toggle of screen.getAllByRole('switch')) {
      expect(toggle).toBeDisabled()
    }
  })
})
