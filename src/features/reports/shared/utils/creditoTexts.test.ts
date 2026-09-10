/**
 * 132/F4a — textos do crédito de horas (D15).
 *
 * O que cada asserção existe para deixar VERMELHA:
 *
 *  1. o rótulo público deixar de ser "Crédito de Suporte" → literal escrito à mão cai;
 *  2. **qualquer** texto deste módulo passar a citar a categoria do HubSpot → o detector de
 *     string proibida cai, com controle positivo ao lado provando que ele não morreu;
 *  3. o tooltip crescer além do que o balão `whitespace-nowrap` do `InfoIcon` aguenta → o teto
 *     de tamanho cai (é medida de layout, não de gosto: o balão não quebra linha);
 *  4. um texto novo entrar no módulo sem passar pelos detectores → a varredura é derivada dos
 *     exports do módulo, não de lista à mão.
 */

import { describe, expect, it } from 'vitest'
import * as moduloDeCredito from './creditoTexts'
import {
  HEADER_EXPORT_CREDITO,
  HEADER_EXPORT_PLANO_EFETIVO,
  ROTULO_CREDITO_PUBLICO,
  TOOLTIP_CREDITO_PLANO,
  srCreditoSufixo,
  textoCreditoVisivel,
} from './creditoTexts'

/**
 * A string que **não pode** aparecer em superfície de cliente (D15 / AP-SECURITY-001). É a
 * constante `FaturamentoConstantes.CategoriaInvoicy` do backend, e o motivo interno do crédito
 * automático a contém.
 *
 * ⚠️ Escrita aqui VERBATIM de propósito: é o valor completo, não um prefixo — um prefixo casaria
 * também com nome de campo e de coluna, que são legítimos (`rules/security.md`).
 */
const CATEGORIA_PROIBIDA = 'Problema - Invoicy'

/** Todos os textos exportados pelo módulo, derivados do próprio módulo (anti-vacuidade). */
function textosDoModulo(): { nome: string; texto: string }[] {
  const saida: { nome: string; texto: string }[] = []
  for (const [nome, valor] of Object.entries(moduloDeCredito)) {
    if (typeof valor === 'string') saida.push({ nome, texto: valor })
    // Funções de texto são exercitadas com um argumento representativo: o `2h` do exemplo do
    // usuário. Sem isto, `srCreditoSufixo` escaparia da varredura só por ser função.
    if (typeof valor === 'function') saida.push({ nome, texto: valor('2h') })
  }
  return saida
}

describe('creditoTexts — o rótulo público (D15)', () => {
  it('é exatamente "Crédito de Suporte"', () => {
    expect(ROTULO_CREDITO_PUBLICO).toBe('Crédito de Suporte')
  })

  it('o tooltip e o texto de leitor de tela NOMEIAM o rótulo público', () => {
    expect(TOOLTIP_CREDITO_PLANO).toContain(ROTULO_CREDITO_PUBLICO)
    expect(srCreditoSufixo('2h')).toContain(ROTULO_CREDITO_PUBLICO)
    // Literal à mão: é o que o leitor de tela pronuncia.
    expect(srCreditoSufixo('2h')).toBe('mais 2h de Crédito de Suporte')
  })

  it('o texto visível é o sinal `+` seguido do valor — o `+` carrega a informação', () => {
    // WCAG 1.4.1: tirando a cor, o `+` continua dizendo "isto é um acréscimo".
    expect(textoCreditoVisivel('2h')).toBe('+ 2h')
  })
})

describe('creditoTexts — a categoria do HubSpot NUNCA aparece', () => {
  it('nenhum texto do módulo contém a string proibida', () => {
    const universo = textosDoModulo()

    // Anti-vacuidade: a varredura precisa provar que encontrou textos. Sem isto, um módulo
    // renomeado deixaria o assert abaixo verde por não ter o que varrer.
    expect(universo.length).toBeGreaterThanOrEqual(6)

    const infratores = universo
      .filter((t) => t.texto.includes(CATEGORIA_PROIBIDA))
      .map((t) => t.nome)
    expect(infratores).toEqual([])
  })

  it('controle positivo: o detector ainda pega a redação proibida', () => {
    // Sem isto, uma varredura quebrada (universo vazio, `includes` invertido) deixaria o assert
    // acima vacuamente verde — e a prova de privacidade seria decorativa.
    const fabricado = `Estorno de Credito ${CATEGORIA_PROIBIDA}`
    expect(fabricado.includes(CATEGORIA_PROIBIDA)).toBe(true)
    expect(
      [{ nome: 'fabricado', texto: fabricado }]
        .filter((t) => t.texto.includes(CATEGORIA_PROIBIDA))
        .map((t) => t.nome),
    ).toEqual(['fabricado'])
  })

  it('o conjunto de exports do módulo é nominalmente este (não encolhe nem cresce calado)', () => {
    // Identidade, não cardinalidade: um texto entrando e outro saindo passaria na contagem.
    expect(new Set(Object.keys(moduloDeCredito))).toEqual(
      new Set([
        'ROTULO_CREDITO_PUBLICO',
        'TOOLTIP_CREDITO_PLANO',
        'textoCreditoVisivel',
        'srCreditoSufixo',
        'HEADER_EXPORT_CREDITO',
        'HEADER_EXPORT_PLANO_EFETIVO',
      ]),
    )
  })
})

describe('creditoTexts — restrições de forma', () => {
  it('o tooltip cabe no balão `whitespace-nowrap` do InfoIcon', () => {
    // O balão não quebra linha (`InfoIcon.tsx:141`) e o clamp horizontal reposiciona em vez de
    // quebrar: um tooltip longo sai da viewport. 100 caracteres a ~6,5px em `text-xs` ficam
    // abaixo de 700px, que cabe na largura mínima suportada.
    expect(TOOLTIP_CREDITO_PLANO.length).toBeLessThanOrEqual(100)
    expect(TOOLTIP_CREDITO_PLANO.length).toBeGreaterThan(20)
  })

  it('nenhum texto afirma prazo, periodicidade ou número digitado (AP-FRONTEND-022)', () => {
    const proibidos = [
      /pr[oó]xim[ao] fatura/i,
      /todo m[eê]s/i,
      /em at[eé]/i,
      /\b\d+\s*dias?\b/i,
      /expira em/i,
      /\b30\b/,
    ]

    const universo = textosDoModulo()
    const infratores = universo
      .filter((t) => proibidos.some((p) => p.test(t.texto)))
      .map((t) => t.nome)
    expect(infratores).toEqual([])
  })

  it('controle positivo do detector de prazo', () => {
    const frase = 'O crédito expira em 30 dias e volta na próxima fatura.'
    expect([/expira em/i, /\b\d+\s*dias?\b/i, /pr[oó]xim[ao] fatura/i].some((p) => p.test(frase))).toBe(
      true,
    )
  })

  it('os cabeçalhos de export dizem a unidade, e são DOIS distintos', () => {
    expect(HEADER_EXPORT_CREDITO).toBe('Crédito (h)')
    expect(HEADER_EXPORT_PLANO_EFETIVO).toBe('Plano Efetivo (h)')
    expect(HEADER_EXPORT_CREDITO).not.toBe(HEADER_EXPORT_PLANO_EFETIVO)
  })
})
