import { describe, expect, it } from 'vitest'
import * as textos from './competenciaTelaTextos'
import { afirmaCorrecaoAutomatica, creditosDependentesTexto } from './competenciaTelaTextos'

/** Todas as constantes de texto exportadas pelo módulo — derivadas, nunca listadas à mão. */
function constantesDeTexto(): Array<[string, string]> {
  return Object.entries(textos).filter(
    (entrada): entrada is [string, string] => typeof entrada[1] === 'string',
  )
}

describe('afirmaCorrecaoAutomatica — o detector', () => {
  it('CONTROLE POSITIVO: pega a frase que a tela nunca pode dizer', () => {
    // A reversão exata do defeito que C-8 existe para impedir. Se o detector morrer
    // (regex quebrada, split errado), este caso fica vermelho — e é ele que impede a
    // varredura abaixo de passar por vacuidade.
    expect(
      afirmaCorrecaoAutomatica('Os créditos divergentes são corrigidos automaticamente.'),
    ).toBe(true)
    expect(afirmaCorrecaoAutomatica('O sistema ajusta automaticamente o valor do crédito.')).toBe(
      true,
    )
    expect(afirmaCorrecaoAutomatica('O crédito é estornado automaticamente ao refechar.')).toBe(
      true,
    )
  })

  it('não confunde a NEGAÇÃO com a afirmação — é o texto correto, e ele precisa passar', () => {
    // Um detector que proibisse o radical `corrig` reprovaria justamente a frase que cumpre
    // C-8, e o "conserto" natural seria reescrever o texto para agradar ao teste.
    expect(afirmaCorrecaoAutomatica('Nenhum valor é corrigido automaticamente.')).toBe(false)
    expect(afirmaCorrecaoAutomatica('O sistema não ajusta nada automaticamente.')).toBe(false)
  })

  it('a frase seguinte não "salva" a anterior — o recorte é por sentença', () => {
    // Sem o split por sentença, um "não" em qualquer lugar do parágrafo desligaria o
    // detector para o parágrafo inteiro.
    expect(
      afirmaCorrecaoAutomatica(
        'Os créditos são corrigidos automaticamente. O plano não muda.',
      ),
    ).toBe(true)
  })
})

describe('os textos da tela (C-8 — o sistema não corrige nada sozinho)', () => {
  it('a varredura não é inerte: encontra as constantes do módulo', () => {
    // Companheira positiva da asserção negativa abaixo — sem ela, um `export` renomeado
    // faria "nenhum texto afirma correção automática" passar medindo zero textos.
    const constantes = constantesDeTexto()
    expect(constantes.length).toBeGreaterThan(10)
    expect(constantes.map(([nome]) => nome)).toContain('IMPACTO_REABERTURA')
  })

  it('NENHUMA constante afirma que o sistema corrige, ajusta ou estorna sozinho', () => {
    const infratoras = constantesDeTexto()
      .filter(([, valor]) => afirmaCorrecaoAutomatica(valor))
      .map(([nome]) => nome)

    expect(infratoras).toEqual([])
  })

  it('o aviso de reabertura DIZ o que acontece — literais escritos à mão', () => {
    // A metade positiva: não basta "não mente", tem de explicar C-8.
    expect(textos.IMPACTO_REABERTURA).toContain('não altera nenhum crédito já concedido')
    expect(textos.IMPACTO_REABERTURA).toContain('marcados na tela de Créditos')
    expect(textos.IMPACTO_REABERTURA_CREDITOS_NOVOS).toContain('não gera crédito automático novo')
  })

  it('o aviso de competência histórica cita a ausência de snapshot (C-6)', () => {
    expect(textos.AVISO_HISTORICA).toContain('não existe snapshot')
    expect(textos.AVISO_HISTORICA).toContain('ao vivo')
  })

  it('quando o número de créditos é desconhecido, o texto NÃO diz "nenhum"', () => {
    // `AP-FRONTEND-028` aplicado a texto: "0 créditos" afirmaria ausência sobre um valor
    // que ninguém informou.
    expect(textos.CREDITOS_DEPENDENTES_DESCONHECIDO).toContain('não sabe quantos')
    expect(textos.CREDITOS_DEPENDENTES_DESCONHECIDO).not.toMatch(/\bnenhum\b/i)
  })
})

describe('creditosDependentesTexto', () => {
  it('concorda em número — 1 no singular, 2+ no plural', () => {
    expect(creditosDependentesTexto(1)).toBe('1 crédito vivo foi gerado por esta competência.')
    expect(creditosDependentesTexto(3)).toBe('3 créditos vivos foram gerados por esta competência.')
    // O zero é um número que o servidor pode informar de verdade — e aí sim é "nenhum".
    expect(creditosDependentesTexto(0)).toContain('0 créditos')
  })
})
