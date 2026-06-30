import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MultiSelectCombobox, type MultiSelectOption } from './MultiSelectCombobox'

const STATUS_OPTIONS: MultiSelectOption<string>[] = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'andamento', label: 'Em andamento' },
  { value: 'fechado', label: 'Fechado' },
]

const TEAM_OPTIONS: MultiSelectOption<number>[] = [
  { value: 1, label: 'Relacionamento BR' },
  { value: 2, label: 'Onboarding' },
]

function Harness<T extends string | number>({
  options,
  summaryLabel,
  searchable,
  initial = [],
}: {
  options: MultiSelectOption<T>[]
  summaryLabel?: string
  searchable?: boolean
  initial?: T[]
}) {
  const [value, setValue] = useState<T[]>(initial)
  return (
    <MultiSelectCombobox<T>
      value={value}
      options={options}
      onChange={setValue}
      summaryLabel={summaryLabel}
      searchable={searchable}
      placeholder="Todos"
    />
  )
}

describe('MultiSelectCombobox', () => {
  it('exibe o placeholder quando nada está selecionado', () => {
    render(<Harness options={STATUS_OPTIONS} />)
    expect(screen.getByRole('button')).toHaveTextContent('Todos')
  })

  it('abre o dropdown ao clicar e lista as opções como checkboxes', async () => {
    const user = userEvent.setup()
    render(<Harness options={STATUS_OPTIONS} summaryLabel="Status" />)

    const trigger = screen.getByRole('button')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    options.forEach((o) => expect(o).toHaveAttribute('aria-checked', 'false'))
  })

  it('marca e desmarca opções (multi-seleção)', async () => {
    const user = userEvent.setup()
    render(<Harness options={STATUS_OPTIONS} summaryLabel="Status" />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('option', { name: 'Aberto' }))
    await user.click(screen.getByRole('option', { name: 'Fechado' }))

    expect(screen.getByRole('option', { name: 'Aberto' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('option', { name: 'Fechado' })).toHaveAttribute('aria-checked', 'true')

    // Desmarca "Aberto"
    await user.click(screen.getByRole('option', { name: 'Aberto' }))
    expect(screen.getByRole('option', { name: 'Aberto' })).toHaveAttribute('aria-checked', 'false')
  })

  it('exibe o resumo "Label (N)" no controle quando há 2+ selecionados', async () => {
    const user = userEvent.setup()
    render(<Harness options={STATUS_OPTIONS} summaryLabel="Status" />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('option', { name: 'Aberto' }))
    await user.click(screen.getByRole('option', { name: 'Em andamento' }))

    expect(screen.getByRole('button')).toHaveTextContent('Status (2)')
  })

  it('exibe o rótulo do único item quando há exatamente 1 selecionado', async () => {
    const user = userEvent.setup()
    render(<Harness options={STATUS_OPTIONS} summaryLabel="Status" />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('option', { name: 'Fechado' }))

    expect(screen.getByRole('button')).toHaveTextContent('Fechado')
  })

  it('alterna seleção via teclado (Espaço) e fecha com Escape', async () => {
    const user = userEvent.setup()
    render(<Harness options={STATUS_OPTIONS} summaryLabel="Status" />)

    const trigger = screen.getByRole('button')
    await user.click(trigger)

    const option = screen.getByRole('option', { name: 'Aberto' })
    option.focus()
    await user.keyboard(' ')
    expect(option).toHaveAttribute('aria-checked', 'true')

    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('fecha ao clicar fora do componente', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <Harness options={STATUS_OPTIONS} summaryLabel="Status" />
        <button type="button">fora</button>
      </div>,
    )

    const trigger = screen.getByRole('button', { name: /Todos|Status/ })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: 'fora' }))
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('filtra opções pela busca quando searchable', async () => {
    const user = userEvent.setup()
    render(<Harness options={STATUS_OPTIONS} summaryLabel="Status" searchable />)

    await user.click(screen.getByRole('button'))
    await user.type(screen.getByLabelText('Filtrar opções'), 'fech')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('Fechado')
  })

  it('funciona com valores numéricos (equipes)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MultiSelectCombobox<number>
        value={[]}
        options={TEAM_OPTIONS}
        onChange={onChange}
        summaryLabel="Equipes"
        placeholder="Todas"
      />,
    )

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('option', { name: 'Onboarding' }))

    expect(onChange).toHaveBeenCalledWith([2])
  })

  it('mostra estado de carregamento das opções sem quebrar', async () => {
    const user = userEvent.setup()
    render(
      <MultiSelectCombobox<string>
        value={[]}
        options={[]}
        onChange={vi.fn()}
        isLoading
        placeholder="Todos"
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
  })

  it('expõe erro de fetch via role="alert" sem quebrar', () => {
    render(
      <MultiSelectCombobox<string>
        value={[]}
        options={[]}
        onChange={vi.fn()}
        error="Falha ao carregar status."
        placeholder="Todos"
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao carregar status.')
  })
})
