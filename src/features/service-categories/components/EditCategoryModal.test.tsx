import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it, vi } from 'vitest'
import {
  classesDoTexto,
  fundoDoTexto,
  razaoDoTexto,
  reprovacoesAA,
  varrer,
} from '../../../test/medidor-de-contraste'
import { EditCategoryModal } from './EditCategoryModal'
import type { ServiceCategoryDto } from '../types/serviceCategory'

/** Categoria COM a flag ligada (133). */
const consultoria: ServiceCategoryDto = {
  id: 7,
  nome: 'Consultoria',
  isActive: true,
  forcesBillableOutsidePlan: true,
}
/** Categoria SEM a flag — companheira obrigatória de toda asserção sobre a trava. */
const plantao: ServiceCategoryDto = {
  id: 9,
  nome: 'Plantão',
  isActive: false,
  forcesBillableOutsidePlan: false,
}
/** Categoria vinda de um backend anterior à 133: a chave nem existe na resposta. */
const legado: ServiceCategoryDto = { id: 11, nome: 'Legado', isActive: true }

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
const switchForca = () =>
  screen.getByRole('switch', { name: 'Cobrar sempre fora do plano de suporte' })

describe('EditCategoryModal', () => {
  it('não renderiza nada quando não há categoria em edição', () => {
    render(<EditCategoryModal category={null} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('abre com o nome ATUAL pré-preenchido', () => {
    // Vermelho se `defaultValues` deixar de vir de `category.nome`: o campo nasceria vazio
    // e o usuário teria de redigitar o nome inteiro para mudar uma letra.
    render(<EditCategoryModal category={consultoria} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(campoNome()).toHaveValue('Consultoria')
  })

  it('ao trocar de linha, reidrata com o nome da NOVA categoria', () => {
    // Vermelho (MEDIDO) se o `key={category.id}` sair: o form interno não remonta,
    // `defaultValues` fica congelado e o modal mostra "Consultoria" ao editar "Plantão".
    const { rerender } = render(
      <EditCategoryModal category={consultoria} onSave={vi.fn()} onClose={vi.fn()} />,
    )
    rerender(<EditCategoryModal category={plantao} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(campoNome()).toHaveValue('Plantão')
  })

  it('salvar com o campo vazio: erro inline e NENHUMA chamada de rede', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<EditCategoryModal category={consultoria} onSave={onSave} onClose={vi.fn()} />)

    await user.clear(campoNome())
    await user.click(botaoSalvar())

    expect(await screen.findByText('Informe o nome da categoria.')).toBeInTheDocument()
    // Prova por ausência só vale porque o teste seguinte, no MESMO fluxo e com o MESMO
    // espião, mostra `onSave` sendo chamado — o ponto observado é alcançável.
    expect(onSave).not.toHaveBeenCalled()
  })

  it('sucesso: renomeia com o nome sem espaços nas pontas e fecha', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(consultoria)
    const onClose = vi.fn()
    render(<EditCategoryModal category={consultoria} onSave={onSave} onClose={onClose} />)

    await user.clear(campoNome())
    await user.type(campoNome(), '  Consultoria N2  ')
    await user.click(botaoSalvar())

    // Vermelho se o trim do Zod sair, se a categoria deixar de ser repassada, ou se a
    // ordem dos argumentos inverter. 133: o 2º argumento é o form INTEIRO — literal
    // escrito à mão, não derivado da resposta.
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(consultoria, {
        nome: 'Consultoria N2',
        forcesBillableOutsidePlan: true,
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('409: modal CONTINUA aberto, erro inline acionável e sem fechar', async () => {
    const user = userEvent.setup()
    const onSave = vi
      .fn()
      .mockRejectedValue(conflito("Já existe uma categoria com o nome 'Plantão'."))
    const onClose = vi.fn()
    render(<EditCategoryModal category={consultoria} onSave={onSave} onClose={onClose} />)

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
    const onSave = vi.fn().mockRejectedValue(conflito(doBe2))
    render(<EditCategoryModal category={consultoria} onSave={onSave} onClose={vi.fn()} />)

    await user.clear(campoNome())
    await user.type(campoNome(), 'Plantão')
    await user.click(botaoSalvar())

    expect(await screen.findByText(`${doBe2} Escolha um nome diferente.`)).toBeInTheDocument()
  })

  it('botão Salvar fica desabilitado enquanto o PUT está em voo', async () => {
    const user = userEvent.setup()
    let liberar: () => void = () => {}
    const onSave = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { liberar = resolve }),
    )
    render(<EditCategoryModal category={consultoria} onSave={onSave} onClose={vi.fn()} />)

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
    render(<EditCategoryModal category={consultoria} onSave={vi.fn()} onClose={onClose} />)

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})

/**
 * 133 — o switch da flag no modal de edição.
 *
 * O caso que dá nome ao bloco é o `5b`: **editar só o nome não pode desligar a flag**.
 * É o lado cliente do R3 da arquitetura — o servidor tem a rede do `bool?`
 * ("null = não alterar"), mas o painel manda o valor explícito, então um `defaultValues`
 * que ignorasse o campo enviaria `false` e desligaria a flag sem ninguém pedir.
 */
describe('EditCategoryModal — flag de cobrança fora do plano (133)', () => {
  it('categoria COM a flag abre com o switch LIGADO', () => {
    render(<EditCategoryModal category={consultoria} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(switchForca()).toHaveAttribute('aria-checked', 'true')
  })

  it('categoria SEM a flag abre com o switch DESLIGADO — companheira positiva', () => {
    // Sem este par, um switch fixo em `true` (ou um `defaultValues` que ignorasse o campo
    // e casualmente batesse) passaria no caso acima.
    render(<EditCategoryModal category={plantao} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(switchForca()).toHaveAttribute('aria-checked', 'false')
  })

  it('categoria de backend ANTERIOR à 133 (chave ausente) abre desligada, sem quebrar', () => {
    render(<EditCategoryModal category={legado} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(switchForca()).toHaveAttribute('aria-checked', 'false')
  })

  it('o texto de apoio explica o EFEITO da flag, visível e permanente', () => {
    // Não é copy: é regra de negócio dita ao usuário (`AP-FRONTEND-022`). Vermelho se o
    // texto virar tooltip/`title` ou sumir.
    render(<EditCategoryModal category={plantao} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(
      screen.getByText(/serão sempre marcados como cobrados fora do plano/),
    ).toBeInTheDocument()
  })

  it('o texto de apoio está PROGRAMATICAMENTE associado ao switch (aria-describedby)', () => {
    // Não basta o texto existir na tela: sem `aria-describedby` o usuário de leitor de
    // tela ouve "Cobrar sempre fora do plano de suporte, switch, desligado" e nunca o
    // efeito. A asserção compara o id REAL do parágrafo com o do atributo — um
    // `aria-describedby` apontando para o nada (id digitado de novo, com typo) passaria
    // numa asserção de mera presença do atributo.
    render(<EditCategoryModal category={plantao} onSave={vi.fn()} onClose={vi.fn()} />)

    const apoio = screen.getByText(/serão sempre marcados como cobrados fora do plano/)
    expect(apoio.id).not.toBe('')
    expect(switchForca()).toHaveAttribute('aria-describedby', apoio.id)
  })

  it('editar SÓ O NOME não desliga a flag — o form reenvia o valor atual', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(consultoria)
    render(<EditCategoryModal category={consultoria} onSave={onSave} onClose={vi.fn()} />)

    await user.clear(campoNome())
    await user.type(campoNome(), 'Consultoria N2')
    await user.click(botaoSalvar())

    // Vermelho se `defaultValues` deixar de carregar a flag: sairia `false` e o PUT (que
    // manda o campo SEMPRE explícito) desligaria a flag da categoria.
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(consultoria, {
        nome: 'Consultoria N2',
        forcesBillableOutsidePlan: true,
      }),
    )
  })

  it('desligar o switch e salvar envia `false` — o switch escreve mesmo no form', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(consultoria)
    render(<EditCategoryModal category={consultoria} onSave={onSave} onClose={vi.fn()} />)

    await user.click(switchForca())
    expect(switchForca()).toHaveAttribute('aria-checked', 'false')
    await user.click(botaoSalvar())

    // Discriminador do caso anterior: prova que o valor enviado segue o switch, e não um
    // literal grudado. Um switch decorativo (que não chama `setValue`) reprova aqui.
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(consultoria, {
        nome: 'Consultoria',
        forcesBillableOutsidePlan: false,
      }),
    )
  })

  it('ligar o switch numa categoria sem a flag envia `true`', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(plantao)
    render(<EditCategoryModal category={plantao} onSave={onSave} onClose={vi.fn()} />)

    await user.click(switchForca())
    await user.click(botaoSalvar())

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(plantao, {
        nome: 'Plantão',
        forcesBillableOutsidePlan: true,
      }),
    )
  })

  it('ao trocar de linha, o switch reidrata com a flag da NOVA categoria', () => {
    // Mesmo mecanismo do nome (`key={category.id}`): vermelho se a remontagem sair, e o
    // modal mostraria a flag da categoria anterior — que é o valor que ele reenviaria.
    const { rerender } = render(
      <EditCategoryModal category={consultoria} onSave={vi.fn()} onClose={vi.fn()} />,
    )
    expect(switchForca()).toHaveAttribute('aria-checked', 'true')

    rerender(<EditCategoryModal category={plantao} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(switchForca()).toHaveAttribute('aria-checked', 'false')
  })

  it('contraste: o apoio e o rótulo do switch passam AA sobre o painel do modal', () => {
    // Medido no DOM renderizado (a classe interna do componente compartilhado vence a de
    // fora). `razaoDoTexto` LANÇA quando a frase não foi medida — é o que impede o teste de
    // ficar verde por vacuidade se o texto sumir. O trecho é o PREFIXO: o medidor trunca em
    // 60 caracteres.
    render(<EditCategoryModal category={plantao} onSave={vi.fn()} onClose={vi.fn()} />)
    const { medidas, pulados } = varrer(document.body)

    expect(pulados).toEqual([])
    const APOIO = 'Apontamentos com esta categoria serão sempre marcados'
    expect(classesDoTexto(medidas, APOIO)).toEqual(['text-foreground/70'])
    expect(fundoDoTexto(medidas, APOIO)).toEqual(['#ffffff'])
    expect(razaoDoTexto(medidas, APOIO).toFixed(2)).toBe('5.47')
    expect(razaoDoTexto(medidas, 'Cobrar sempre fora do plano de suporte').toFixed(2)).toBe('13.82')
    expect(reprovacoesAA(medidas)).toEqual([])
  })

  it('o título do modal diz "Editar categoria" — ele não renomeia mais só o nome', () => {
    render(<EditCategoryModal category={consultoria} onSave={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByRole('dialog', { name: 'Editar categoria' })).toBeInTheDocument()
  })
})
