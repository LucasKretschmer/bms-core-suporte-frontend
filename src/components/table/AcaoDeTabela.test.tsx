import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AcaoDeTabela } from './AcaoDeTabela'

describe('AcaoDeTabela — ação livre', () => {
  it('chama o handler no clique e não anuncia indisponibilidade', async () => {
    const onClick = vi.fn()
    render(
      <AcaoDeTabela aria-label="Excluir motivo X" onClick={onClick} tom="danger">
        excluir
      </AcaoDeTabela>,
    )

    const botao = screen.getByRole('button', { name: 'Excluir motivo X' })
    expect(botao).not.toHaveAttribute('aria-disabled')
    expect(botao).not.toHaveAttribute('aria-describedby')
    await userEvent.click(botao)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('o clique não escapa para a linha (tabelas com linha clicável)', async () => {
    const onClick = vi.fn()
    const onLinha = vi.fn()
    render(
      <div onClick={onLinha} role="presentation">
        <AcaoDeTabela aria-label="Editar X" onClick={onClick}>
          editar
        </AcaoDeTabela>
      </div>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Editar X' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    // Sem `stopPropagation`, editar abriria também o drawer da linha.
    expect(onLinha).not.toHaveBeenCalled()
  })
})

describe('AcaoDeTabela — ação bloqueada (AP-QA-007)', () => {
  const bloqueio = { motivo: 'Motivo protegido pelo sistema.', motivoId: 'explicacao-1' }

  function renderBloqueada(onClick = vi.fn()) {
    render(
      <>
        <button type="button">âncora</button>
        <AcaoDeTabela aria-label="Excluir motivo X" onClick={onClick} bloqueio={bloqueio}>
          excluir
        </AcaoDeTabela>
        <p id="explicacao-1">{bloqueio.motivo}</p>
      </>,
    )
    return onClick
  }

  it('🔴 usa `aria-disabled` e NÃO o atributo `disabled`', () => {
    renderBloqueada()
    const botao = screen.getByRole('button', { name: 'Excluir motivo X' })
    expect(botao).toHaveAttribute('aria-disabled', 'true')
    expect(botao).not.toBeDisabled()
  })

  it('🔴 continua ALCANÇÁVEL por Tab — a prova de que não é `disabled` mudo', async () => {
    const user = userEvent.setup()
    renderBloqueada()

    // Ancorado num elemento FORA do componente: `el.focus()` não responderia à pergunta
    // "o usuário chega nele apertando Tab?" (`rules/frontend.md`). Trocar `aria-disabled`
    // por `disabled` deixa esta asserção vermelha — é a mutação dirigida deste arquivo.
    screen.getByRole('button', { name: 'âncora' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Excluir motivo X' }))
  })

  it('🔴 o clique é neutralizado — bloqueio real, não decorativo', async () => {
    const onClick = renderBloqueada()
    await userEvent.click(screen.getByRole('button', { name: 'Excluir motivo X' }))
    // Sem isto, o `aria-disabled` seria uma afirmação falsa: o leitor de tela diria
    // "indisponível" e a ação aconteceria assim mesmo.
    expect(onClick).not.toHaveBeenCalled()
  })

  it('aponta para o motivo VISÍVEL e o repete no `title`', () => {
    renderBloqueada()
    const botao = screen.getByRole('button', { name: 'Excluir motivo X' })
    expect(botao).toHaveAttribute('aria-describedby', 'explicacao-1')
    expect(botao).toHaveAttribute('title', bloqueio.motivo)
    expect(document.getElementById('explicacao-1')?.textContent).toBe(bloqueio.motivo)
  })
})
