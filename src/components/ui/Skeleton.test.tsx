import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Skeleton } from './Skeleton'

describe('Skeleton', () => {
  it('renderiza 5 barras por padrão (lines=5)', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5)
  })

  it('renderiza a quantidade de barras informada em `lines`', () => {
    const { container } = render(<Skeleton lines={3} />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
  })

  it('aplica a altura informada em `height` a cada barra', () => {
    const { container } = render(<Skeleton lines={2} height="h-6" />)
    const bars = container.querySelectorAll('.animate-pulse')
    bars.forEach((bar) => expect(bar.className).toContain('h-6'))
  })

  it('expõe aria-busy e aria-label de carregamento', () => {
    render(<Skeleton />)
    const wrapper = screen.getByLabelText('Carregando…')
    expect(wrapper).toHaveAttribute('aria-busy', 'true')
  })
})
