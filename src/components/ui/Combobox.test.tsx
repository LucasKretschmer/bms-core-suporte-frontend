import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Combobox, type ComboboxOption } from './Combobox'

/**
 * Harness que simula o uso async real do Combobox:
 * - mantém o valor selecionado;
 * - troca a lista de `options` conforme o termo de busca (server-side simulado);
 * - ao fechar o dropdown, o Combobox reseta search='' → onSearch('') →
 *   a lista volta para a "página inicial" (25 primeiros). Reproduz o bug onde
 *   o item selecionado some da lista e o trigger voltava ao placeholder.
 */
function AsyncHarness({
  initialPage,
  searchResults,
}: {
  initialPage: ComboboxOption[]
  searchResults: Record<string, ComboboxOption[]>
}) {
  const [value, setValue] = useState<string | null>(null)
  const [options, setOptions] = useState<ComboboxOption[]>(initialPage)

  function handleSearch(query: string) {
    if (query === '') {
      setOptions(initialPage)
      return
    }
    setOptions(searchResults[query] ?? [])
  }

  return (
    <Combobox
      value={value}
      options={options}
      onChange={setValue}
      isAsync
      onSearch={handleSearch}
      placeholder="Selecione…"
    />
  )
}

describe('Combobox — cache de rótulo do selecionado (modo async)', () => {
  it('mantém o rótulo do item selecionado mesmo quando ele sai da lista após o refetch (search vazio)', async () => {
    const user = userEvent.setup()

    const initialPage: ComboboxOption[] = [
      { value: '1', label: 'Cliente Um' },
      { value: '2', label: 'Cliente Dois' },
    ]
    // "Cliente Zeta" NÃO está na página inicial — só aparece ao buscar "zeta".
    const searchResults = {
      zeta: [{ value: '99', label: 'Cliente Zeta' }],
    }

    render(<AsyncHarness initialPage={initialPage} searchResults={searchResults} />)

    // Antes de selecionar, mostra o placeholder.
    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveTextContent('Selecione…')

    // Abre, busca "zeta" e seleciona o item fora da página inicial.
    await user.click(trigger)
    await user.type(screen.getByPlaceholderText('Filtrar…'), 'zeta')

    // Aguarda o debounce de 300ms propagar o onSearch e a lista trocar.
    const option = await screen.findByText('Cliente Zeta', undefined, { timeout: 2000 })
    await user.click(option)

    // Ao fechar, o effect reseta search='' → onSearch('') → options voltam à
    // página inicial (sem o item 99). O trigger DEVE continuar exibindo o rótulo
    // do selecionado (vindo do cache), e não voltar ao placeholder.
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toHaveTextContent('Cliente Zeta')
    })
    expect(screen.getByRole('combobox')).not.toHaveTextContent('Selecione…')
  }, 10000)

  it('exibe o placeholder quando nada está selecionado', () => {
    render(
      <Combobox
        value={null}
        options={[{ value: '1', label: 'Um' }]}
        onChange={vi.fn()}
        placeholder="Escolha…"
      />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Escolha…')
  })

  it('exibe o rótulo a partir das options atuais quando o item ainda está na lista', () => {
    render(
      <Combobox
        value="2"
        options={[
          { value: '1', label: 'Um' },
          { value: '2', label: 'Dois' },
        ]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('combobox')).toHaveTextContent('Dois')
  })
})
