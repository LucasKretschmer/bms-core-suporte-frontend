import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import { EditCategoryModal } from './EditCategoryModal'
import type { ServiceCategoryDto } from '../types/serviceCategory'

const consultoria: ServiceCategoryDto = { id: 7, nome: 'Consultoria', isActive: true }
const plantao: ServiceCategoryDto = { id: 9, nome: 'Plantão', isActive: false }

function conflito(message: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code: 'CONFLICT', message } },
    status: 409,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError('Request failed with status code 409', undefined, config, {}, response)
}

const campoNome = () => screen.getByLabelText(/Nome da categoria/)
const botaoSalvar = () => screen.getByRole('button', { name: 'Salvar' })

describe('EditCategoryModal', () => {
  it('não renderiza nada quando não há categoria em edição', () => {
    render(<EditCategoryModal category={null} onRename={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('abre com o nome ATUAL pré-preenchido', () => {
    // Vermelho se `defaultValues` deixar de vir de `category.nome`: o campo nasceria vazio
    // e o usuário teria de redigitar o nome inteiro para mudar uma letra.
    render(<EditCategoryModal category={consultoria} onRename={vi.fn()} onClose={vi.fn()} />)
    expect(campoNome()).toHaveValue('Consultoria')
  })

  it('ao trocar de linha, reidrata com o nome da NOVA categoria', () => {
    // Vermelho (MEDIDO) se o `key={category.id}` sair: o form interno não remonta,
    // `defaultValues` fica congelado e o modal mostra "Consultoria" ao editar "Plantão".
    const { rerender } = render(
      <EditCategoryModal category={consultoria} onRename={vi.fn()} onClose={vi.fn()} />,
    )
    rerender(<EditCategoryModal category={plantao} onRename={vi.fn()} onClose={vi.fn()} />)
    expect(campoNome()).toHaveValue('Plantão')
  })

  it('salvar com o campo vazio: erro inline e NENHUMA chamada de rede', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn()
    render(<EditCategoryModal category={consultoria} onRename={onRename} onClose={vi.fn()} />)

    await user.clear(campoNome())
    await user.click(botaoSalvar())

    expect(await screen.findByText('Informe o nome da categoria.')).toBeInTheDocument()
    // Prova por ausência só vale porque o teste seguinte, no MESMO fluxo e com o MESMO
    // espião, mostra `onRename` sendo chamado — o ponto observado é alcançável.
    expect(onRename).not.toHaveBeenCalled()
  })

  it('sucesso: renomeia com o nome sem espaços nas pontas e fecha', async () => {
    const user = userEvent.setup()
    const onRename = vi.fn().mockResolvedValue(consultoria)
    const onClose = vi.fn()
    render(<EditCategoryModal category={consultoria} onRename={onRename} onClose={onClose} />)

    await user.clear(campoNome())
    await user.type(campoNome(), '  Consultoria N2  ')
    await user.click(botaoSalvar())

    // Vermelho se o trim do Zod sair, se a categoria deixar de ser repassada, ou se a
    // ordem dos argumentos inverter.
    await waitFor(() => expect(onRename).toHaveBeenCalledWith(consultoria, 'Consultoria N2'))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('409: modal CONTINUA aberto, erro inline acionável e sem fechar', async () => {
    const user = userEvent.setup()
    const onRename = vi
      .fn()
      .mockRejectedValue(conflito("Já existe uma categoria com o nome 'Plantão'."))
    const onClose = vi.fn()
    render(<EditCategoryModal category={consultoria} onRename={onRename} onClose={onClose} />)

    await user.clear(campoNome())
    await user.type(campoNome(), 'Plantão')
    await user.click(botaoSalvar())

    // Vermelho se o `catch` sumir (a rejeição fecharia o modal e viraria unhandled) ou se
    // a mensagem passar a vir do handleApiError cru.
    expect(
      await screen.findByText(
        "Já existe uma categoria com o nome 'Plantão'. Escolha um nome diferente.",
      ),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(campoNome()).toHaveValue('Plantão')
  })

  it('409 com a mensagem NOVA do BE-2 aparece inline sem alteração de código', async () => {
    const user = userEvent.setup()
    const doBe2 = "Existe uma categoria desativada com o nome 'Plantão'."
    const onRename = vi.fn().mockRejectedValue(conflito(doBe2))
    render(<EditCategoryModal category={consultoria} onRename={onRename} onClose={vi.fn()} />)

    await user.clear(campoNome())
    await user.type(campoNome(), 'Plantão')
    await user.click(botaoSalvar())

    expect(await screen.findByText(`${doBe2} Escolha um nome diferente.`)).toBeInTheDocument()
  })

  it('botão Salvar fica desabilitado enquanto o PUT está em voo', async () => {
    const user = userEvent.setup()
    let liberar: () => void = () => {}
    const onRename = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { liberar = resolve }),
    )
    render(<EditCategoryModal category={consultoria} onRename={onRename} onClose={vi.fn()} />)

    await user.clear(campoNome())
    await user.type(campoNome(), 'Consultoria N2')
    await user.click(botaoSalvar())

    // O que faz ficar vermelho (MEDIDO, não presumido): remover `isLoading` E `disabled`
    // do submit. Só um dos dois NÃO basta — o wrapper local `components/ui/Button.tsx:78`
    // faz `disabled={disabled || isLoading}`, então cada um sozinho já desabilita. E
    // remover `disabled` do "Cancelar" (que não recebe `isLoading`) também reprova aqui.
    // Sem os dois o usuário clicaria de novo e dispararia um segundo PUT.
    await waitFor(() => expect(botaoSalvar()).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()

    liberar()
    await waitFor(() => expect(botaoSalvar()).not.toBeDisabled())
  })

  it('Escape fecha o modal (a11y — trap/fechamento vêm do Modal compartilhado)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<EditCategoryModal category={consultoria} onRename={vi.fn()} onClose={onClose} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
