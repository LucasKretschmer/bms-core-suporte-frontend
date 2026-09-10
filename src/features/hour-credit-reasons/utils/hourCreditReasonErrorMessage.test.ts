import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  CODIGOS_DE_CONFLITO_DE_MOTIVO,
  getHourCreditReasonErrorMessage,
} from './hourCreditReasonErrorMessage'
import {
  MOTIVO_DE_SISTEMA_EXPLICACAO,
  MOTIVO_DUPLICADO_ACAO,
  MOTIVO_EM_USO_ACAO,
} from '../hourCreditReasonTexts'

function erro(status: number, code: string | undefined, message?: string): AxiosError {
  const config = { headers: new AxiosHeaders() }
  const response: AxiosResponse = {
    data: { error: { code, message } },
    status,
    statusText: '',
    headers: {},
    config,
  }
  return new AxiosError(`Request failed with status code ${status}`, undefined, config, {}, response)
}

describe('getHourCreditReasonErrorMessage — três 409 diferentes, três ações diferentes', () => {
  it('a identidade do vocabulário de códigos é esta', () => {
    // Código novo no servidor sem tratamento aqui reprova, nomeando a diferença.
    expect([...CODIGOS_DE_CONFLITO_DE_MOTIVO]).toEqual([
      'MOTIVO_DE_SISTEMA',
      'MOTIVO_DUPLICADO',
      'MOTIVO_EM_USO',
    ])
  })

  it('🔴 os três 409 produzem mensagens DIFERENTES — ramificação por `code`', () => {
    // Ramificar por STATUS colapsaria os três numa ação só (é o limite do template
    // `categoryErrorMessage`, que tem um conflito só). Este assert é o que impede a
    // regressão para "um 409, uma mensagem".
    const sistema = getHourCreditReasonErrorMessage(erro(409, 'MOTIVO_DE_SISTEMA', 'Recusado.'))
    const emUso = getHourCreditReasonErrorMessage(erro(409, 'MOTIVO_EM_USO', 'Recusado.'))
    const duplicado = getHourCreditReasonErrorMessage(erro(409, 'MOTIVO_DUPLICADO', 'Recusado.'))

    expect(new Set([sistema, emUso, duplicado]).size).toBe(3)
    expect(sistema).toContain(MOTIVO_DE_SISTEMA_EXPLICACAO)
    expect(emUso).toContain(MOTIVO_EM_USO_ACAO)
    expect(duplicado).toContain(MOTIVO_DUPLICADO_ACAO)
  })

  it('a mensagem do servidor é PRESERVADA — é ela que diz o que aconteceu', () => {
    const texto = getHourCreditReasonErrorMessage(
      erro(409, 'MOTIVO_EM_USO', 'O motivo 2 tem 7 créditos ativos.'),
    )
    // Trocar a mensagem do servidor por texto fixo apagaria os números — a única
    // informação que permite ao gerente agir.
    expect(texto).toContain('O motivo 2 tem 7 créditos ativos.')
    expect(texto).toContain(MOTIVO_EM_USO_ACAO)
  })

  it('🔴 a ação do MOTIVO_EM_USO não manda "desativar" — a tela não tem como', () => {
    // `AP-FRONTEND-022`: o contrato desta demanda não expõe desativação de motivo
    // (`PUT { nome }`, sem `PATCH`). Instruir uma ação inexistente é texto que mente.
    expect(MOTIVO_EM_USO_ACAO).not.toMatch(/desativ/i)
    expect(MOTIVO_EM_USO_ACAO).toMatch(/créditos/i)
  })

  it('🔴 138/B1 — a ação do MOTIVO_EM_USO é ESTE literal, palavra por palavra', () => {
    // 🔴 Literal ESCRITO À MÃO, de propósito. Os asserts vizinhos afirmam sobre a própria
    // constante (`toContain(MOTIVO_EM_USO_ACAO)`, `:45`/`:56`) e por isso são verdadeiros
    // para QUALQUER valor dela — é a tautologia do padrão 3 de `rules/tests.md`. Foi
    // exatamente por isso que a palavra "estorne" viveu aqui com a suíte inteira verde.
    //
    // O que deixa este assert VERMELHO: qualquer alteração do texto — inclusive a reversão
    // para 'Exclua ou estorne os créditos que usam este motivo antes de excluí-lo.'
    expect(MOTIVO_EM_USO_ACAO).toBe(
      'Exclua os créditos que usam este motivo, na tela de Créditos, antes de excluí-lo.',
    )
  })

  it('🔴 138/B1 — a ação NÃO manda estornar (não libera o motivo e não existe botão)', () => {
    // Negativa NOMINAL do defeito: "estorne"/"estornar" não pode voltar.
    //   (a) não libera — a guarda é `motivoid = @id AND desativadoem IS NULL`
    //       (`MotivoCreditoRepository.cs:67-70`); o estorno só carimba `estornadoem`
    //       (`CreditoAutomaticoService.cs:596-597`), a linha continua viva.
    //   (b) não existe — não há rota, service nem botão de estorno manual; o estorno é
    //       100% automático (medido pelo QA backend da 132).
    expect(MOTIVO_EM_USO_ACAO).not.toMatch(/estorn/i)
    // "reclassifique/troque" LIBERA o motivo, mas a listagem de créditos não tem filtro por
    // `motivoId` ⇒ o usuário não acha os créditos daquele motivo. Verdadeiro e inalcançável.
    expect(MOTIVO_EM_USO_ACAO).not.toMatch(/reclassifi|troqu/i)

    // 🔴 COMPANHEIRA POSITIVA, na MESMA execução: sem ela as três negativas acima seriam
    // satisfeitas pelo vazio (uma constante `''` passa em todas).
    expect(MOTIVO_EM_USO_ACAO).toContain('Exclua')
    expect(MOTIVO_EM_USO_ACAO).toContain('tela de Créditos')
  })

  describe('🔴 138/B1 — convergência do toast: o servidor e o front dizem a MESMA coisa', () => {
    /**
     * Cópia **verbatim, escrita à mão**, de `FaturamentoConflitos.MotivoEmUso()` do backend
     * (`src/Suporte.Application/Services/Faturamento/FaturamentoConflitos.cs`).
     *
     * ⚠️ Limite conhecido e declarado: este é um espelho manual de outro repositório — se o
     * backend mudar o texto e ninguém mexer aqui, este arquivo continua verde. O que fecha a
     * ponta é o par do outro lado: `FaturamentoConflitosTextosTests.cs` trava o literal do
     * servidor **e** afirma que ele contém esta mesma frase de ação. Alteração unilateral de
     * qualquer um dos dois lados fica vermelha em um dos dois repos.
     */
    const MENSAGEM_DO_SERVIDOR =
      'Este motivo está em uso por créditos existentes e não pode ser removido. ' +
      'Exclua os créditos que usam este motivo, na tela de Créditos, antes de excluí-lo.'

    it('a ação do front é subconjunto EXATO da mensagem do servidor', () => {
      // É esta continência que faz o `includes` de `getHourCreditReasonErrorMessage` casar e
      // NÃO concatenar. Se qualquer um dos dois textos derivar (vírgula, acento, "Créditos"
      // minúsculo), este assert fica vermelho ANTES de o toast duplicar em produção.
      expect(MENSAGEM_DO_SERVIDOR).toContain(MOTIVO_EM_USO_ACAO)
    })

    it('🔴 o toast traz UMA instrução, não duas concatenadas', () => {
      const texto = getHourCreditReasonErrorMessage(
        erro(409, 'MOTIVO_EM_USO', MENSAGEM_DO_SERVIDOR),
      )

      // O defeito medido na 138 (§0.5) era exatamente este toast:
      //   "…não pode ser removido. Exclua ou reclassifique (troque o motivo) os créditos
      //    antes de excluí-lo. Exclua ou estorne os créditos que usam este motivo antes de
      //    excluí-lo."
      // Duas instruções para o mesmo erro, uma delas inexecutável. Contar ocorrências (e não
      // só `toContain`) é o que distingue "aparece" de "aparece uma vez".
      expect(texto.match(/Exclua/g)).toHaveLength(1)
      expect(texto.match(/antes de excluí-lo/g)).toHaveLength(1)
      expect(texto).toBe(MENSAGEM_DO_SERVIDOR)

      // E o toast inteiro — servidor + front — não manda estornar nem reclassificar.
      expect(texto).not.toMatch(/estorn/i)
      expect(texto).not.toMatch(/reclassifi|troqu/i)
      // Companheira positiva das duas negativas acima, na mesma execução.
      expect(texto).toContain('tela de Créditos')
    })

    it('a concatenação CONTINUA existindo quando o servidor fala outra coisa', () => {
      // Controle positivo: o teste acima só prova convergência se o mecanismo de
      // concatenação ainda estiver vivo. Se alguém "resolver" a duplicação apagando o
      // `${doServidor} ${acao}`, o teste de cima passaria por motivo errado — e este cai.
      const texto = getHourCreditReasonErrorMessage(
        erro(409, 'MOTIVO_EM_USO', 'O motivo 2 tem 7 créditos ativos.'),
      )
      expect(texto).toBe(`O motivo 2 tem 7 créditos ativos. ${MOTIVO_EM_USO_ACAO}`)
    })
  })

  it('409 desconhecido cai no genérico — sem ação inventada', () => {
    const texto = getHourCreditReasonErrorMessage(erro(409, 'OUTRO', 'Conflito qualquer.'))
    expect(texto).toBe('Conflito qualquer.')
  })

  it('409 sem mensagem no envelope usa só a ação', () => {
    expect(getHourCreditReasonErrorMessage(erro(409, 'MOTIVO_DUPLICADO', undefined))).toBe(
      MOTIVO_DUPLICADO_ACAO,
    )
  })

  it('erro sem envelope cai no handleApiError, sem vazar detalhe técnico', () => {
    expect(getHourCreditReasonErrorMessage(new Error('boom'))).toBe('Ocorreu um erro inesperado.')
  })
})
