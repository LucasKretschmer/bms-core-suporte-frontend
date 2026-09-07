import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { razaoDoTexto, reprovacoesAA, varrer } from '../../test/medidor-de-contraste'
import { EmptyState } from './EmptyState'

/**
 * 125/FE-A11Y-1 — o que mudou e por que estes testes existem.
 *
 * O wrapper deixou de delegar a mensagem ao `EmptyState` do design system, cujo `<p>`
 * interno saía em `text-xs italic text-primary/30` = **1,84:1** (QA 124 `D-2`). Os testes
 * abaixo cobrem o contrato novo (`description`, `children`, `announce`) e, sobretudo, a
 * propriedade que o defeito violava: **o `className` de fora não decide a cor do texto**.
 *
 * A trava repo-wide, com controle positivo e universo derivado do disco, é
 * `src/utils/primitivosDeUiContraste.test.tsx`.
 */
describe('EmptyState', () => {
  it('renderiza a mensagem', () => {
    render(<EmptyState message="Nenhum item encontrado." />)
    expect(screen.getByText('Nenhum item encontrado.')).toBeInTheDocument()
  })

  it('não renderiza botão de ação quando `action` não é passado', () => {
    render(<EmptyState message="Vazio." />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renderiza o botão de ação e chama onClick ao clicar', () => {
    const onClick = vi.fn()
    render(<EmptyState message="Vazio." action={{ label: 'Adicionar', onClick }} />)
    const button = screen.getByRole('button', { name: 'Adicionar' })
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('só renderiza a descrição quando ela é passada', () => {
    const { rerender } = render(<EmptyState message="Vazio." />)
    expect(screen.queryByText('Explicação.')).not.toBeInTheDocument()

    rerender(<EmptyState message="Vazio." description="Explicação." />)
    expect(screen.getByText('Explicação.')).toBeInTheDocument()
  })

  it('renderiza `children` — o slot de ação por NAVEGAÇÃO, que não é botão', () => {
    render(
      <EmptyState message="Vazio.">
        <a href="/planos">Configurar em Planos</a>
      </EmptyState>,
    )
    expect(screen.getByRole('link', { name: 'Configurar em Planos' })).toBeInTheDocument()
  })

  it('`announce` liga o `role="status"`; sem ele a região não é anunciada', () => {
    const { rerender } = render(<EmptyState message="Vazio." />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(<EmptyState announce message="Vazio." />)
    expect(screen.getByRole('status')).toHaveTextContent('Vazio.')
  })

  it('o ícone padrão é decorativo — `aria-hidden`, fora da árvore de acessibilidade', () => {
    const { container } = render(<EmptyState message="Vazio." />)
    const icone = container.querySelector('svg')
    expect(icone).not.toBeNull()
    expect(icone?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('🔴 o `className` de FORA não alcança a mensagem — a classe é do componente', () => {
    // É a propriedade que o defeito de 1,84:1 violava, só que ao contrário: antes, a
    // classe interna do DS vencia o `className` do call site. Agora a mensagem tem
    // classe própria, e um `className` hostil (a própria classe de 1,84:1) fica no
    // contêiner sem contaminar o texto.
    render(<EmptyState className="text-primary/30" message="Mensagem legível." />)

    const mensagem = screen.getByText('Mensagem legível.')
    expect(mensagem.className).toContain('text-foreground')
    expect(mensagem.className).not.toContain('text-primary/30')
    expect(mensagem.className).not.toContain('italic')
  })

  it('mensagem e descrição atendem AA sobre o card — medido no DOM', () => {
    const { container } = render(
      <div className="bg-card">
        <EmptyState
          className="text-primary/30"
          message="Nenhum plano cadastrado."
          description="Cadastre os planos para definir as horas contratadas."
        />
      </div>,
    )

    const { medidas, pulados } = varrer(container.firstElementChild as Element)
    // O que o medidor não soube medir aparece — nunca some em silêncio.
    expect(pulados).toEqual([])
    expect(reprovacoesAA(medidas)).toEqual([])
    // Literais escritos à mão: `text-foreground` e `text-foreground/70` sobre #ffffff.
    expect(razaoDoTexto(medidas, 'Nenhum plano cadastrado.').toFixed(2)).toBe('13.82')
    expect(razaoDoTexto(medidas, 'Cadastre os planos').toFixed(2)).toBe('5.47')
  })
})
