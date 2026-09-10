/**
 * 127/FE-AJUDA + 132/F1 — os textos do `(?)` da tela de Consumo de Planos.
 *
 * ## O que este arquivo perdeu, e o que ele passou a guardar
 *
 * A 132/D7 removeu as exceções de faturamento e, com elas, `indicadorDeConferencia` e os
 * quatro estados que este módulo derivava. Todos os casos que provavam a derivação
 * (inclusive o de `anomaliasCount == null` cair em `erro` e não em `zero`) saíram: o
 * sujeito deles não existe mais.
 *
 * Sobrou o que **continua sendo uma afirmação sobre o sistema**: o rótulo do gatilho.
 * `AP-FRONTEND-022` — texto de UI que afirma comportamento é código, não copy —, e o
 * rótulo antigo (`'Ajuda e conferência'`) é o caso de laboratório dessa lição: ele
 * prometia uma **conferência** que a tela deixou de fazer, e prometia isso exatamente no
 * mês em que a regra de competência mudou, que é quando o usuário abre o `(?)`.
 *
 * ## 🔴 O que deixa cada assert vermelho
 *
 *  - o **literal escrito à mão** (não derivado da constante) reprova se alguém reescrever
 *    o rótulo sem passar por aqui — comparar a constante consigo mesma seria tautologia
 *    (`rules/tests.md` § expectativa derivada da própria resposta);
 *  - o **detector de "conferência"** reprova a restauração do texto antigo, e ele tem
 *    **controle positivo** ao lado: uma string fabricada com a palavra proibida **é**
 *    detectada. Sem esse controle, uma regex quebrada deixaria o assert vacuamente verde
 *    (`rules/tests.md` § varredura textual);
 *  - a **inclusão** (`nome ⊇ rótulo`) reprova se alguém trocar o rótulo visível sem
 *    trocar o acessível, quebrando WCAG 2.5.3 (Label in Name) para comando de voz.
 */

import { describe, expect, it } from 'vitest'
import * as textos from './planConsumptionHelpTexts'
import {
  TEXTO_AJUDA_NOME_ACESSIVEL,
  TEXTO_AJUDA_ROTULO,
} from './planConsumptionHelpTexts'

/** O detector de jargão de conferência, um só, usado no alvo E no controle positivo. */
const PROMETE_CONFERENCIA = /confer[êe]nci|conferir/i

describe('planConsumptionHelpTexts — o rótulo do (?)', () => {
  it('os literais são exatamente estes (escritos à mão, não derivados)', () => {
    expect(TEXTO_AJUDA_ROTULO).toBe('Ajuda')
    expect(TEXTO_AJUDA_NOME_ACESSIVEL).toBe('Ajuda: como o período é contado nesta tela')
  })

  it('o nome acessível CONTÉM o rótulo visível (WCAG 2.5.3, Label in Name)', () => {
    expect(TEXTO_AJUDA_NOME_ACESSIVEL).toContain(TEXTO_AJUDA_ROTULO)
  })

  it('🔴 nenhuma constante exportada promete CONFERÊNCIA (132/D7)', () => {
    const exportadas = Object.entries(textos).filter(
      ([, valor]) => typeof valor === 'string',
    ) as [string, string][]

    // Companheira POSITIVA obrigatória: a varredura encontrou constantes de verdade.
    // Sem este piso, o `forEach` abaixo passaria sobre uma lista vazia — o padrão 1 de
    // `rules/tests.md` (asserção negativa satisfeita pelo vazio).
    expect(exportadas.length).toBeGreaterThan(0)

    for (const [nome, valor] of exportadas) {
      expect(valor, `${nome} voltou a prometer conferência: "${valor}"`).not.toMatch(
        PROMETE_CONFERENCIA,
      )
    }
  })

  it('controle positivo: o MESMO detector pega o texto antigo (não morreu)', () => {
    // Os dois literais que existiam antes da 132. Se o detector deixar de casá-los, ele
    // virou inerte e o assert acima passa por engano.
    expect('Ajuda e conferência').toMatch(PROMETE_CONFERENCIA)
    expect('Ajuda e conferência — 3 chamados exigem conferência').toMatch(
      PROMETE_CONFERENCIA,
    )
    expect('nenhum chamado exige conferência').toMatch(PROMETE_CONFERENCIA)
  })

  it('🔴 o módulo não exporta mais nada do indicador (a superfície encolheu de propósito)', () => {
    // Identidade, não cardinalidade (`rules/tests.md`): uma constante que entra e outra
    // que sai passariam numa contagem. Entrada nova aqui é decisão consciente.
    expect(Object.keys(textos).sort()).toEqual([
      'TEXTO_AJUDA_NOME_ACESSIVEL',
      'TEXTO_AJUDA_ROTULO',
    ])
  })
})
