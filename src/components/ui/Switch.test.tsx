import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

describe('Switch', () => {
  it('renderiza com role="switch" e aria-checked refletindo o estado', () => {
    render(<Switch checked={false} onChange={vi.fn()} label="Ativo" />)
    const el = screen.getByRole('switch', { name: 'Ativo' })
    expect(el).toHaveAttribute('aria-checked', 'false')
  })

  it('chama onChange com o valor invertido ao clicar', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} label="Ativo" />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('não chama onChange quando disabled', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} label="Ativo" disabled />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('é operável por teclado (Enter/Espaço, via clique do botão nativo)', () => {
    const onChange = vi.fn()
    render(<Switch checked={true} onChange={onChange} label="Ativo" />)
    const el = screen.getByRole('switch')
    el.focus()
    fireEvent.click(el)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('usa aria-label quando hideLabel=true (padrão)', () => {
    render(<Switch checked={false} onChange={vi.fn()} label="Notificações" />)
    expect(screen.getByRole('switch', { name: 'Notificações' })).toHaveAttribute(
      'aria-label',
      'Notificações',
    )
  })

  it('não duplica aria-label quando hideLabel=false (rótulo visível externo)', () => {
    render(<Switch checked={false} onChange={vi.fn()} label="Notificações" hideLabel={false} />)
    expect(screen.getByRole('switch')).not.toHaveAttribute('aria-label')
  })

  /**
   * 133/FE-2 · T-FE2-2 — as duas props aditivas da trava por regra de negócio.
   *
   * `ariaDisabled` existe **porque** `disabled` não serve: o `<button disabled>` sai da
   * ordem de tabulação e do leitor de tela, e o usuário de teclado nunca alcançaria o
   * controle nem a explicação apontada por `describedById`
   * (`rules/frontend.md` § Acessibilidade de teclado).
   */
  describe('133 — travado por regra de negócio (ariaDisabled + describedById)', () => {
    it('aponta aria-describedby para o texto que explica o estado', () => {
      render(
        <>
          <p id="apoio">A categoria é sempre cobrada fora do plano.</p>
          <Switch checked onChange={vi.fn()} label="Cobrar" describedById="apoio" />
        </>,
      )
      const el = screen.getByRole('switch')
      expect(el).toHaveAttribute('aria-describedby', 'apoio')
      // Identidade, não presença: o id apontado precisa existir no documento.
      expect(document.getElementById('apoio')).not.toBeNull()
    })

    it('sem describedById, não inventa aria-describedby', () => {
      render(<Switch checked onChange={vi.fn()} label="Cobrar" />)
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-describedby')
    })

    it('ariaDisabled bloqueia a mudança MAS mantém o botão focável e alcançável por Tab', async () => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      render(
        <>
          <button type="button">âncora</button>
          <Switch checked onChange={onChange} label="Cobrar" ariaDisabled />
        </>,
      )
      const el = screen.getByRole('switch')

      expect(el).toHaveAttribute('aria-disabled', 'true')
      expect(el).toHaveAttribute('aria-checked', 'true')
      // O ponto da prop: o atributo NATIVO não existe — é ele que tira do Tab.
      expect(el).not.toBeDisabled()
      expect(el).not.toHaveAttribute('disabled')

      // Travessia real a partir de uma âncora FORA do componente (AP-QA-007):
      // `.focus()` não provaria que o usuário de teclado chega ao switch.
      screen.getByRole('button', { name: 'âncora' }).focus()
      await user.tab()
      expect(el).toHaveFocus()

      await user.click(el)
      expect(onChange).not.toHaveBeenCalled()
    })

    it('sem ariaDisabled o clique alterna — o discriminador do caso acima', () => {
      // Companheira positiva: prova que "não chamou" veio da trava, e não de um
      // componente quebrado que nunca chama onChange.
      const onChange = vi.fn()
      render(<Switch checked onChange={onChange} label="Cobrar" describedById="apoio" />)
      const el = screen.getByRole('switch')
      expect(el).not.toHaveAttribute('aria-disabled')
      fireEvent.click(el)
      expect(onChange).toHaveBeenCalledExactlyOnceWith(false)
    })

    it('travado NÃO recebe opacity nem pointer-events-none (WCAG 1.4.11); disabled continua recebendo', () => {
      // Reduzir a opacidade de um trilho `bg-primary` MARCADO custa contraste
      // não-textual sem ganho — quem comunica a trava é o texto visível.
      const { rerender } = render(<Switch checked onChange={vi.fn()} label="Cobrar" ariaDisabled />)
      const travado = screen.getByRole('switch')
      expect(travado.className).toContain('cursor-not-allowed')
      expect(travado.className).not.toContain('opacity-50')
      expect(travado.className).not.toContain('pointer-events-none')

      // Regressão do caminho antigo, na mesma execução.
      rerender(<Switch checked onChange={vi.fn()} label="Cobrar" disabled />)
      const desabilitado = screen.getByRole('switch')
      expect(desabilitado.className).toContain('opacity-50')
      expect(desabilitado.className).toContain('pointer-events-none')
      expect(desabilitado).toBeDisabled()
    })
  })
})
