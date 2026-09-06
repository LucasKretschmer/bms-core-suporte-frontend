/**
 * 123/D3b — `ChartSeriesFilter`: contrato do componente genérico de isolamento de série.
 *
 * O que faz cada asserção ficar VERMELHA está anotado ao lado. Em resumo:
 * - trocar `onChange(ativo ? null : item.key)` por `onChange(item.key)` mata os dois
 *   testes de "caminho de volta pelo próprio chip";
 * - remover o botão "Todas" mata o teste de caminho de volta permanente;
 * - trocar `aria-pressed` por classe de cor mata os testes de estado anunciado;
 * - remover `aria-labelledby` mata o teste de nome acessível do grupo.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChartSeriesFilter } from './ChartSeriesFilter'
import type { ChartSeriesFilterItem } from './ChartSeriesFilter'

const ITENS: ChartSeriesFilterItem[] = [
  { key: 'novos', label: 'Novos', color: '#111111' },
  { key: 'cancelados', label: 'Cancelados', color: '#444444' },
  { key: 'emAberto', label: 'Em aberto', color: '#555555' },
]

function renderFiltro(
  selected: string | null,
  onChange = vi.fn<(key: string | null) => void>(),
  items: ChartSeriesFilterItem[] = ITENS,
) {
  const utils = render(
    <ChartSeriesFilter label="Séries:" items={items} selected={selected} onChange={onChange} />,
  )
  return { ...utils, onChange }
}

describe('ChartSeriesFilter', () => {
  it('lista "Todas" + uma opção por série, nesta ordem', () => {
    renderFiltro(null)
    const nomes = screen.getAllByRole('button').map((b) => b.textContent?.trim())
    // Identidade da enumeração, não só a contagem.
    expect(nomes).toEqual(['Todas', 'Novos', 'Cancelados', 'Em aberto'])
  })

  it('estado é ANUNCIADO por aria-pressed, não só por cor', () => {
    renderFiltro('cancelados')
    expect(screen.getByRole('button', { name: 'Cancelados' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Companheiras negativas — na mesma execução, com a positiva acima.
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Novos' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('sem seleção, "Todas" é a opção vigente', () => {
    renderFiltro(null)
    expect(screen.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Cancelados' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('clicar numa série NÃO vigente pede o isolamento dela (a chave certa, não "alguma")', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFiltro(null)

    await user.click(screen.getByRole('button', { name: 'Cancelados' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('cancelados')
  })

  it('caminho de volta 1: "Todas" pede null mesmo já havendo série isolada', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFiltro('cancelados')

    await user.click(screen.getByRole('button', { name: 'Todas' }))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('caminho de volta 2: clicar na série JÁ isolada pede null (não repete a chave)', async () => {
    const user = userEvent.setup()
    const { onChange } = renderFiltro('cancelados')

    await user.click(screen.getByRole('button', { name: 'Cancelados' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(null)
    // Discriminador: se o handler ignorasse o estado vigente, viria 'cancelados' aqui.
    expect(onChange).not.toHaveBeenCalledWith('cancelados')
  })

  it('o grupo tem nome acessível vindo do rótulo VISÍVEL', () => {
    renderFiltro(null)
    const grupo = screen.getByRole('group', { name: 'Séries:' })
    // Positiva na mesma execução: o grupo é o que contém os botões.
    expect(grupo.querySelectorAll('button')).toHaveLength(4)
  })

  it('a amostra de cor é aria-hidden (cor é redundante, o rótulo é texto)', () => {
    const { container } = renderFiltro(null)
    const amostras = container.querySelectorAll('span[aria-hidden="true"]')
    expect(amostras).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Cancelados' })).toBeInTheDocument()
  })

  it('sem itens não renderiza nada — e COM itens renderiza (companheira positiva)', () => {
    const { container, unmount } = renderFiltro(null, vi.fn(), [])
    expect(container.querySelectorAll('button')).toHaveLength(0)
    unmount()

    const comItens = renderFiltro(null)
    expect(comItens.container.querySelectorAll('button')).toHaveLength(4)
  })
})
