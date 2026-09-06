import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CancelTimeEntryDialog } from './CancelTimeEntryDialog'

describe('CancelTimeEntryDialog', () => {
  it('não renderiza quando fechado', () => {
    render(<CancelTimeEntryDialog isOpen={false} onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByText('Cancelar apontamento')).not.toBeInTheDocument()
  })

  it('exige motivo: erro inline e não chama onConfirm quando vazio', async () => {
    const onConfirm = vi.fn()
    render(<CancelTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/motivo/i)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('bloqueia quando o motivo tem menos de 10 caracteres', async () => {
    const onConfirm = vi.fn()
    render(<CancelTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.type(screen.getByLabelText(/motivo do cancelamento/i), 'curto')
    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirma com o motivo (trim) quando válido (>= 10 chars)', async () => {
    const onConfirm = vi.fn()
    render(<CancelTimeEntryDialog isOpen onConfirm={onConfirm} onClose={vi.fn()} />)

    await userEvent.type(
      screen.getByLabelText(/motivo do cancelamento/i),
      '  lançamento duplicado  ',
    )
    await userEvent.click(screen.getByRole('button', { name: /confirmar cancelamento/i }))

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('lançamento duplicado'))
  })

  it('dispara onClose ao voltar', async () => {
    const onClose = vi.fn()
    render(<CancelTimeEntryDialog isOpen onConfirm={vi.fn()} onClose={onClose} />)

    await userEvent.click(screen.getByRole('button', { name: /voltar/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('desabilita os controles durante o submit', () => {
    render(<CancelTimeEntryDialog isOpen isSubmitting onConfirm={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByLabelText(/motivo do cancelamento/i)).toBeDisabled()
    expect(screen.getByRole('button', { name: /confirmar cancelamento/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /voltar/i })).toBeDisabled()
  })

  it('exibe erro de API quando fornecido', () => {
    render(
      <CancelTimeEntryDialog
        isOpen
        apiError="Você não tem permissão para realizar esta ação."
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByText(/não tem permissão/i)).toBeInTheDocument()
  })
})

describe('CancelTimeEntryDialog — hasConsolidatedTime (120, D-1)', () => {
  it('default (hasConsolidatedTime não informado) preserva o comportamento atual — título/texto/botão de cancelamento', () => {
    render(<CancelTimeEntryDialog isOpen onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Cancelar apontamento')).toBeInTheDocument()
    expect(screen.getByText(/O tempo deixa de contar nas somas/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirmar cancelamento/i })).toBeInTheDocument()
  })

  it('hasConsolidatedTime=true → título "Descartar apontamento", texto menciona "Descartado" e "faturamento"', () => {
    render(
      <CancelTimeEntryDialog isOpen hasConsolidatedTime onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByText('Descartar apontamento')).toBeInTheDocument()
    expect(screen.getByText(/marcado como Descartado/i)).toBeInTheDocument()
    expect(screen.getByText(/faturamento/i)).toBeInTheDocument()
  })

  /**
   * 123/FE-FIX3 — companheira COMPORTAMENTAL da trava derivada de `alertTokenContrast`.
   *
   * A varredura de `arquivo::classe` prova que o FONTE deste arquivo diz `bg-error-fg`;
   * este caso prova que a classe chega ao BOTÃO RENDERIZADO — o fonte poderia carregar a
   * string num ramo morto. Juntas fecham a mutação `QMA2d` do QA em duas classes de prova.
   *
   * O que deixa isto vermelho: trocar `bg-error-fg`/`border-error-fg` por
   * `bg-error`/`border-error` (a migração para o token irmão) — exatamente a QMA2d.
   * A comparação é por TOKEN de `classList`, nunca por substring: `bg-error-fg` contém
   * `bg-error` como texto, e um `toContain` passaria nos dois mundos.
   */
  it('o botão destrutivo pinta com --color-error-fg (bg-error-fg), não com o token irmão --color-error', () => {
    render(
      <CancelTimeEntryDialog isOpen hasConsolidatedTime onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    const botao = screen.getByRole('button', { name: /confirmar descarte/i })
    const classes = Array.from(botao.classList)

    expect(classes).toContain('bg-error-fg')
    expect(classes).toContain('border-error-fg')
    // Controle negativo: o token irmão não pode estar aqui.
    expect(classes).not.toContain('bg-error')
    expect(classes).not.toContain('border-error')
  })

  it('hasConsolidatedTime=true → botão de submit "Confirmar descarte"', () => {
    render(
      <CancelTimeEntryDialog isOpen hasConsolidatedTime onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /confirmar descarte/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirmar cancelamento/i })).not.toBeInTheDocument()
  })

  it('validação do motivo (min 10 / max 500) permanece inalterada com hasConsolidatedTime=true', async () => {
    const onConfirm = vi.fn()
    render(
      <CancelTimeEntryDialog isOpen hasConsolidatedTime onConfirm={onConfirm} onClose={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /confirmar descarte/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/motivo/i)
    expect(onConfirm).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText(/motivo do descarte/i), 'motivo do descarte válido')
    await userEvent.click(screen.getByRole('button', { name: /confirmar descarte/i }))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('motivo do descarte válido'))
  })

  it('rótulo do campo de motivo: "Motivo do cancelamento" (default) vs "Motivo do descarte" (hasConsolidatedTime)', () => {
    const { rerender } = render(
      <CancelTimeEntryDialog isOpen onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByText('* Motivo do cancelamento')).toBeInTheDocument()
    expect(screen.queryByText('* Motivo do descarte')).not.toBeInTheDocument()

    rerender(
      <CancelTimeEntryDialog isOpen hasConsolidatedTime onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByText('* Motivo do descarte')).toBeInTheDocument()
    expect(screen.queryByText('* Motivo do cancelamento')).not.toBeInTheDocument()
  })

  it('placeholder do campo de motivo acompanha a ação (cancelamento vs descarte)', () => {
    const { rerender } = render(
      <CancelTimeEntryDialog isOpen onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByPlaceholderText('Descreva por que este apontamento está sendo cancelado.')).toBeInTheDocument()

    rerender(
      <CancelTimeEntryDialog isOpen hasConsolidatedTime onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    expect(screen.getByPlaceholderText('Descreva por que este apontamento está sendo descartado.')).toBeInTheDocument()
  })

  it('no modo descarte (hasConsolidatedTime=true), nenhum texto visível menciona "cancelar/cancelamento"', () => {
    render(
      <CancelTimeEntryDialog isOpen hasConsolidatedTime onConfirm={vi.fn()} onClose={vi.fn()} />,
    )
    // "Voltar" é o único botão neutro esperado; título, texto de ajuda, rótulo,
    // placeholder e botão de submit não podem vazar a família "cancelar/cancelamento".
    expect(document.body.textContent).not.toMatch(/cancelamento/i)
    expect(document.body.textContent).not.toMatch(/cancelar apontamento/i)
    const textarea = screen.getByLabelText(/motivo do descarte/i)
    expect(textarea).toHaveAttribute(
      'placeholder',
      'Descreva por que este apontamento está sendo descartado.',
    )
  })
})
