import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  getPlanErrorCode,
  getPlanMutationError,
  getPlanMutationErrorMessage,
  shouldWarnUnsafeRename,
  textoAvisoRenameInseguro,
} from './planErrorMessage'

/** Erro com o envelope real do backend (`{ error: { code, message } }`, camelCase). */
function erroApi(status: number, code: string | null, message: string | null): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const error: Record<string, unknown> = {}
  if (code != null) error.code = code
  if (message != null) error.message = message
  const response: AxiosResponse = {
    data: { error },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

describe('getPlanErrorCode', () => {
  it('extrai o código do envelope', () => {
    expect(getPlanErrorCode(erroApi(422, 'PLAN_RENAME_UNSAFE', 'x'))).toBe('PLAN_RENAME_UNSAFE')
  })

  it('devolve null para erro sem envelope e para não-Axios', () => {
    expect(getPlanErrorCode(erroApi(500, null, null))).toBeNull()
    expect(getPlanErrorCode(new Error('boom'))).toBeNull()
  })
})

describe('getPlanMutationError — 422 PLAN_RENAME_UNSAFE (R-1)', () => {
  it('NÃO cai no toast genérico e devolve a mensagem do servidor + a ação', () => {
    // O que faz este assert ficar vermelho: remover o `case RENAME_UNSAFE` (a mensagem
    // viraria a do `handleApiError`) OU deixar de anexar a ação.
    const info = getPlanMutationError(
      erroApi(422, 'PLAN_RENAME_UNSAFE', 'O plano "Support Pro" tem 14 clientes vinculados.'),
    )

    expect(info.message).toContain('14 clientes vinculados')
    expect(info.message).toContain(
      'Preencha o identificador do HubSpot deste plano antes de renomeá-lo.',
    )
    expect(info.message).not.toBe('Ocorreu um erro inesperado.')
  })

  it('aponta para o campo do identificador do HubSpot, não para o nome', () => {
    // Mandar o usuário de volta ao NOME seria pedir que ele desfizesse a intenção; o que
    // resolve o 422 é preencher o identificador.
    expect(getPlanMutationError(erroApi(422, 'PLAN_RENAME_UNSAFE', 'x')).field).toBe('hubspotValor')
  })

  it('não duplica a ação quando o servidor já a inclui', () => {
    const doServidor =
      'Renomear é inseguro. Preencha o identificador do HubSpot deste plano antes de renomeá-lo.'
    const info = getPlanMutationError(erroApi(422, 'PLAN_RENAME_UNSAFE', doServidor))
    expect(info.message).toBe(doServidor)
  })

  it('usa fallback próprio quando o 422 vem SEM mensagem — nunca texto vazio', () => {
    const info = getPlanMutationError(erroApi(422, 'PLAN_RENAME_UNSAFE', null))
    expect(info.message).toContain('desvincularia os clientes')
    expect(info.message).toContain('Preencha o identificador do HubSpot')
  })

  it('reconhece pelo CÓDIGO, não pelo texto — mensagem reescrita continua tratada', () => {
    // Casar por texto quebraria em silêncio no dia em que o backend ajustasse a redação.
    const info = getPlanMutationError(
      erroApi(422, 'PLAN_RENAME_UNSAFE', 'Texto completamente diferente do previsto.'),
    )
    expect(info.field).toBe('hubspotValor')
    expect(info.message).toContain('Preencha o identificador do HubSpot')
  })

  it('422 SEM código conhecido não vira mensagem de rename — não inventa diagnóstico', () => {
    const info = getPlanMutationError(erroApi(422, 'VALIDATION_ERROR', 'Dados inválidos.'))
    expect(info.field).toBeNull()
    expect(info.message).toBe('Dados inválidos.')
  })
})

describe('getPlanMutationError — demais códigos de plano', () => {
  it('PLAN_SLA_CONFLICT aponta para a meta e diz o que fazer', () => {
    const info = getPlanMutationError(erroApi(422, 'PLAN_SLA_CONFLICT', null))
    expect(info.field).toBe('slaPrimeiroAtendimentoMinutos')
    expect(info.message).toContain('Limpe a meta ou desmarque a isenção.')
  })

  it('PLAN_HUBSPOT_VALUE_DUPLICATE (409) aponta para o identificador', () => {
    const info = getPlanMutationError(erroApi(409, 'PLAN_HUBSPOT_VALUE_DUPLICATE', null))
    expect(info.field).toBe('hubspotValor')
    expect(info.message).toContain('Use um identificador diferente.')
  })

  it('erro desconhecido cai no handleApiError, preservando a mensagem do envelope', () => {
    expect(getPlanMutationErrorMessage(erroApi(500, null, 'Falha interna.'))).toBe('Falha interna.')
    expect(getPlanMutationErrorMessage(new Error('boom'))).toBe('Ocorreu um erro inesperado.')
  })
})

describe('shouldWarnUnsafeRename — aviso preventivo (mesma condição da guarda do backend)', () => {
  const base = {
    nomeOriginal: 'Support Pro',
    nomeAtual: 'Support Professional',
    hubspotValorAtual: '',
    clientesVinculados: 3,
  }

  it('avisa quando o nome muda, não há identificador e há clientes vinculados', () => {
    expect(shouldWarnUnsafeRename(base)).toBe(true)
  })

  it('não avisa quando o nome não mudou (só espaços em volta)', () => {
    expect(shouldWarnUnsafeRename({ ...base, nomeAtual: '  Support Pro  ' })).toBe(false)
  })

  it('não avisa quando o identificador do HubSpot está preenchido', () => {
    expect(shouldWarnUnsafeRename({ ...base, hubspotValorAtual: 'plano_pro' })).toBe(false)
  })

  it('não avisa quando não há cliente vinculado', () => {
    expect(shouldWarnUnsafeRename({ ...base, clientesVinculados: 0 })).toBe(false)
  })
})

describe('textoAvisoRenameInseguro', () => {
  it('usa o número de clientes recebido, no singular e no plural', () => {
    expect(textoAvisoRenameInseguro(1)).toContain('1 cliente vinculado')
    expect(textoAvisoRenameInseguro(14)).toContain('14 clientes vinculados')
  })

  it('explica a consequência e a ação', () => {
    const texto = textoAvisoRenameInseguro(14)
    expect(texto).toContain('associados pelo NOME')
    expect(texto).toContain('Preencha o identificador do HubSpot')
  })
})
