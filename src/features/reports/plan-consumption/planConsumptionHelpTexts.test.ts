/**
 * 127/FE-AJUDA — a derivação do indicador do `(?)`, em isolamento.
 *
 * Irmão (nunca substituto) de `components/PlanConsumptionHelp.test.tsx`: aqui os valores
 * são LITERAIS escritos à mão; lá se prova que a tela renderiza o que esta função devolve.
 * Nenhum `expected` é derivado da própria saída (rules/tests.md, padrão 3).
 */

import { describe, expect, it } from 'vitest'
import {
  TEXTO_AJUDA_ROTULO,
  indicadorDeConferencia,
  textoConferenciaPendente,
  type EstadoDaConferencia,
} from './planConsumptionHelpTexts'

describe('indicadorDeConferencia — os 4 estados', () => {
  it('carregando: glifo "…" e a frase de "ainda não se sabe"', () => {
    expect(
      indicadorDeConferencia({ isLoading: true, isError: false, anomaliasCount: undefined }),
    ).toEqual({
      estado: 'carregando',
      selo: '…',
      nomeAcessivel: 'Ajuda e conferência — verificando se há chamados a conferir',
    })
  })

  it('erro: glifo "!" e a falha NOMEADA — nunca a frase do zero', () => {
    const indicador = indicadorDeConferencia({
      isLoading: false,
      isError: true,
      anomaliasCount: undefined,
    })
    expect(indicador).toEqual({
      estado: 'erro',
      selo: '!',
      nomeAcessivel:
        'Ajuda e conferência — não foi possível verificar se há chamados a conferir',
    })
    expect(indicador.nomeAcessivel).not.toContain('nenhum')
  })

  it('zero: sem selo, e o zero dito por escrito', () => {
    expect(
      indicadorDeConferencia({ isLoading: false, isError: false, anomaliasCount: 0 }),
    ).toEqual({
      estado: 'zero',
      selo: null,
      nomeAcessivel: 'Ajuda e conferência — nenhum chamado exige conferência',
    })
  })

  it('N > 0: o selo é o NÚMERO e o nome diz quantos', () => {
    expect(
      indicadorDeConferencia({ isLoading: false, isError: false, anomaliasCount: 7 }),
    ).toEqual({
      estado: 'pendente',
      selo: '7',
      nomeAcessivel: 'Ajuda e conferência — 7 chamados exigem conferência',
    })
  })
})

describe('indicadorDeConferencia — ausência NUNCA vira zero (AP-FRONTEND-021/028)', () => {
  it.each([
    ['null (o que o `int?` do C# serializa)', null],
    ['undefined (campo que o backend nem conhece)', undefined],
  ])('sucesso com anomaliasCount %s ⇒ ERRO, não zero', (_rotulo, count) => {
    const indicador = indicadorDeConferencia({
      isLoading: false,
      isError: false,
      anomaliasCount: count,
    })
    expect(indicador.estado).toBe<EstadoDaConferencia>('erro')
    expect(indicador.nomeAcessivel).toContain('não foi possível verificar')
  })

  it('erro tem precedência sobre um número que tenha sobrado do fetch anterior', () => {
    // `isError` com `data` antiga em mãos: afirmar "3 exigem conferência" seria afirmar um
    // número que a requisição atual não sustenta.
    expect(
      indicadorDeConferencia({ isLoading: false, isError: true, anomaliasCount: 3 }).estado,
    ).toBe<EstadoDaConferencia>('erro')
  })

  it('carregando tem precedência sobre tudo (ainda não há veredito)', () => {
    expect(
      indicadorDeConferencia({ isLoading: true, isError: true, anomaliasCount: 9 }).estado,
    ).toBe<EstadoDaConferencia>('carregando')
  })

  it('contagem negativa (dado impossível) é repouso, não "-2 exigem conferência"', () => {
    const indicador = indicadorDeConferencia({
      isLoading: false,
      isError: false,
      anomaliasCount: -2,
    })
    expect(indicador.estado).toBe<EstadoDaConferencia>('zero')
    expect(indicador.nomeAcessivel).not.toContain('-2')
  })
})

describe('textoConferenciaPendente — plural', () => {
  it('1 chamado (singular)', () => {
    expect(textoConferenciaPendente(1)).toBe('1 chamado exige conferência')
  })

  it('3 chamados (plural) — cardinalidade diferente da do singular', () => {
    expect(textoConferenciaPendente(3)).toBe('3 chamados exigem conferência')
  })
})

describe('nome acessível × rótulo visível (WCAG 2.5.3)', () => {
  it.each<[string, Parameters<typeof indicadorDeConferencia>[0]]>([
    ['carregando', { isLoading: true, isError: false, anomaliasCount: undefined }],
    ['erro', { isLoading: false, isError: true, anomaliasCount: undefined }],
    ['zero', { isLoading: false, isError: false, anomaliasCount: 0 }],
    ['pendente', { isLoading: false, isError: false, anomaliasCount: 5 }],
  ])('o nome acessível do estado %s CONTÉM o rótulo visível', (_estado, args) => {
    expect(indicadorDeConferencia(args).nomeAcessivel.startsWith(TEXTO_AJUDA_ROTULO)).toBe(true)
  })
})
