import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { getCategoryMutationErrorMessage } from './categoryErrorMessage'

/** Erro do Axios com status e corpo controlados — sem `any`. */
function axiosErro(status: number, body?: unknown): AxiosError {
  const headers = new AxiosHeaders()
  const config = { headers }
  const response: AxiosResponse = {
    data: body,
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

const envelope = (message: string) => ({ error: { code: 'CONFLICT', message } })

describe('getCategoryMutationErrorMessage', () => {
  it('409 do backend hoje: preserva a mensagem do servidor e acrescenta o que fazer', () => {
    // Fica vermelho se o 409 cair no ramo genérico (perderia o nome citado pelo backend)
    // ou se a dica de ação sumir.
    const msg = getCategoryMutationErrorMessage(
      axiosErro(409, envelope("Já existe uma categoria com o nome 'Consultoria'.")),
    )
    expect(msg).toBe("Já existe uma categoria com o nome 'Consultoria'. Escolha um nome diferente.")
  })

  it('409 com OUTRA mensagem (categoria desativada — BE-2) passa igual: reconhecimento é por STATUS', () => {
    // ⚠️ Este é o teste que impede o acoplamento ao texto. Fica vermelho no instante em
    // que alguém trocar `status === 409` por um `includes('Já existe uma categoria com o
    // nome')`: a mensagem nova do BE-2 cairia no genérico "Ocorreu um erro inesperado.".
    const doBe2 = "Existe uma categoria DESATIVADA com o nome 'Plantão'. Reative-a ou use outro nome."
    const msg = getCategoryMutationErrorMessage(axiosErro(409, envelope(doBe2)))
    expect(msg).toBe(`${doBe2} Escolha um nome diferente.`)
  })

  it('409 sem envelope: usa o fallback de conflito, nunca o genérico de erro inesperado', () => {
    // Vermelho se o fallback for removido — o usuário veria "Ocorreu um erro inesperado."
    // para um conflito que ele consegue resolver sozinho.
    const msg = getCategoryMutationErrorMessage(axiosErro(409, undefined))
    expect(msg).toBe('Já existe uma categoria com este nome. Escolha um nome diferente.')
  })

  it('409 cuja mensagem já traz a dica não a duplica', () => {
    // Vermelho se a concatenação virar incondicional.
    const jaTemDica = 'Nome em uso. Escolha um nome diferente.'
    expect(getCategoryMutationErrorMessage(axiosErro(409, envelope(jaTemDica)))).toBe(jaTemDica)
  })

  it('403 NÃO recebe a dica de conflito — delega ao handleApiError central', () => {
    // Vermelho se a dica for acrescentada a qualquer erro (ou se o teste do status sumir):
    // "Escolha um nome diferente." é conselho falso para falta de permissão.
    const msg = getCategoryMutationErrorMessage(axiosErro(403, undefined))
    expect(msg).toBe('Você não tem permissão para realizar esta ação.')
    expect(msg).not.toContain('Escolha um nome diferente.')
  })

  it('422 com mensagem do servidor passa intacta, sem dica', () => {
    const msg = getCategoryMutationErrorMessage(
      axiosErro(422, { error: { code: 'VALIDATION_ERROR', message: 'Há campos inválidos na requisição.' } }),
    )
    expect(msg).toBe('Há campos inválidos na requisição.')
  })

  it('erro que não é do Axios cai no genérico', () => {
    // Vermelho se o guard `isAxiosError` sumir (leitura de `.response` em objeto qualquer).
    expect(getCategoryMutationErrorMessage(new Error('boom'))).toBe('Ocorreu um erro inesperado.')
  })
})
