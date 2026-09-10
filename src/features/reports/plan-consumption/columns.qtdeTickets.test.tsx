/**
 * 135/G1 — a célula da coluna **"Qtde. Tickets"** na tabela RENDERIZADA.
 *
 * 🔴 **Por que este arquivo existe, e por que a vítima é a tabela e não o `accessor` puro.**
 * O campo tem **três** ramos no wire, e dois deles produzem telas **DIFERENTES**:
 *
 * | valor no wire        | significa                          | célula |
 * |----------------------|------------------------------------|--------|
 * | chave **ausente**    | "não sei responder" — backend pré-135 (janela de deploy) | `—` |
 * | `null`               | idem (o serializador não deveria mandar, mas cobre) | `—` |
 * | `0`                  | **"nenhum chamado aberto no período"** — estado NORMAL pós-135 | `0` |
 * | `> 0`                | a contagem                         | o número |
 *
 * ⚠️ Isto é o **oposto** do crédito da 132, onde ausência e `0` produzem a mesma tela de
 * propósito. Aqui o discriminador é o próprio DOM: `0` × `—`. Um `?? 0` no `accessor`
 * afirmaria "nenhum chamado aberto" durante toda a janela de deploy; um `?? '—'` ou um
 * `if (!v)` afirmaria "não sei" sobre um zero **conhecido**.
 *
 * 🔴 Os quatro ramos rodam na **MESMA renderização**, numa tabela de 4 linhas. É isso que
 * impede o arquivo de passar pelo vazio: "as células mostram `—`" ficaria verde com a tabela
 * não montada, e a linha com `12` é a companheira positiva que prova que ela montou.
 *
 * Molde: `columns.wire.test.tsx` (129/FE-PCT), inclusive o discriminador de fixture
 * `Object.hasOwn` — que existe porque o teste com `null` **passa nos dois mundos**
 * (`=== undefined` e `== null` concordam sobre `null`) e foi exatamente ele que deixou o
 * defeito de `getPercentClass` entrar em produção.
 */

import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { planConsumptionColumns } from './columns'
import type { PlanConsumptionItemDto } from '../shared/types/reports'
import { TOOLTIP_QTDE_TICKETS } from '../shared/utils/competenciaTexts'

/** Classes literais escritas à mão — não derivadas de `percentColorClasses`. */
const CLASSE_NEUTRA = 'text-foreground'
const CLASSE_VERMELHA = 'text-error-fg'

/**
 * Índice da coluna nova: **derivado** da fonte real e **conferido contra o literal**.
 * O par existe porque cada metade cobre uma falha diferente: o derivado sobrevive a uma
 * coluna nova no meio (e o teste continua medindo a coluna certa); o literal denuncia a
 * inserção no meio, que é o que deslocaria os índices de `columns.wire.test.tsx:26-28`.
 */
const COL_QTDE_TICKETS = planConsumptionColumns.findIndex((c) => c.key === 'qtdeTickets')

const base = {
  clientId: 1,
  cnpj: '12345678000195',
  razaoSocial: 'Cliente LTDA',
  nomePlano: 'Plano 10h',
  qtdePlanoHoras: 10,
  horasUsadas: 3,
  horasRestantes: 7,
  horasAdicionais: 0,
  horasFaturaveis: 3,
  horasAnalise: 0,
}

/**
 * Linha 1 — como ela chega do backend **anterior à 135**: a chave `qtdeTickets`
 * simplesmente **não vem**. E `percentualPlano` também não: é a linha do cliente **sem
 * plano**, que por G3 entra em "Fora do Plano" e **não pode desaparecer da tabela**.
 */
const semChaveNoWire: PlanConsumptionItemDto = {
  ...base,
  clientId: 1,
  nomeFantasia: 'Cliente Sem Chave',
}

/** Linha 2 — o irmão que passa nos dois mundos: a chave existe, valendo `null`. */
const comChaveNula: PlanConsumptionItemDto = {
  ...base,
  clientId: 2,
  nomeFantasia: 'Cliente Chave Nula',
  qtdeTickets: null,
  percentualPlano: null,
}

/** Linha 3 — `0` é **valor**, não ausência: "nenhum chamado aberto no período". */
const zeroChamados: PlanConsumptionItemDto = {
  ...base,
  clientId: 3,
  nomeFantasia: 'Cliente Zero',
  qtdeTickets: 0,
  percentualPlano: 40,
}

/** Linha 4 — controle positivo: contagem conhecida, e `%` conhecido e estourado. */
const dozeChamados: PlanConsumptionItemDto = {
  ...base,
  clientId: 4,
  nomeFantasia: 'Cliente Doze',
  qtdeTickets: 12,
  percentualPlano: 120,
}

/** As 4 linhas, na ordem em que a tabela as renderiza. */
const LINHAS: PlanConsumptionItemDto[] = [
  semChaveNoWire,
  comChaveNula,
  zeroChamados,
  dozeChamados,
]

type Renderizado = {
  linhas: HTMLTableRowElement[]
  celula: (indiceDaLinha: number, indiceDaColuna: number) => HTMLTableCellElement
  container: HTMLElement
}

/** Renderiza **as 4 linhas de uma vez** — é o requisito, não conveniência. */
function renderizarTabela(
  props: { sortState?: { sortBy: string | null; sortDirection: 'asc' | 'desc' }; onSort?: (k: string) => void } = {},
): Renderizado {
  const { container } = render(
    <DataTable
      tableId="plan-consumption-qtde-tickets"
      columns={planConsumptionColumns}
      data={LINHAS}
      sortState={props.sortState}
      onSort={props.onSort}
    />,
  )
  const linhas = Array.from(container.querySelectorAll<HTMLTableRowElement>('tbody tr'))
  return {
    linhas,
    container,
    celula: (l, c) =>
      Array.from(linhas[l].querySelectorAll<HTMLTableCellElement>('td'))[c],
  }
}

describe('135/G1 — a coluna existe, é a última, e o índice não deslocou ninguém', () => {
  it('`qtdeTickets` é a 12ª coluna (índice 11) — derivado E literal', () => {
    // O literal `11` é o que denuncia inserção no meio: `columns.wire.test.tsx` endereça
    // `COL_CNPJ = 0` e `COL_PERCENTUAL = 8`, e uma coluna inserida antes do índice 8 faria
    // aquelas 6 asserções medirem `horasAdicionais` com o nome do teste dizendo "% do Plano".
    expect(COL_QTDE_TICKETS).toBe(11)
    expect(planConsumptionColumns).toHaveLength(12)
    expect(planConsumptionColumns[planConsumptionColumns.length - 1].key).toBe('qtdeTickets')
  })

  it('os índices que `columns.wire.test.tsx` usa continuam apontando para as mesmas colunas', () => {
    // Companheira do assert acima, e é ela que prova que a coluna nova NÃO deslocou nada.
    expect(planConsumptionColumns[0].key).toBe('cnpj')
    expect(planConsumptionColumns[8].key).toBe('percentualPlano')
  })
})

describe('135/G1 — os fixtures discriminam AUSENTE × NULO × ZERO', () => {
  it('`semChaveNoWire` NÃO tem a chave; `comChaveNula` tem, valendo null; `zeroChamados` tem 0', () => {
    // 🔴 Sem isto, alguém "conserta" o fixture pondo `qtdeTickets: null` na primeira linha e
    // o par volta a passar nos dois mundos (`=== undefined` e `== null`), em silêncio. É o
    // mesmo discriminador de `columns.wire.test.tsx:67-77`, verbatim.
    expect(Object.hasOwn(semChaveNoWire, 'qtdeTickets')).toBe(false)
    expect(Object.hasOwn(comChaveNula, 'qtdeTickets')).toBe(true)
    expect(comChaveNula.qtdeTickets).toBeNull()
    expect(Object.hasOwn(zeroChamados, 'qtdeTickets')).toBe(true)
    expect(zeroChamados.qtdeTickets).toBe(0)
    // E o mesmo par para `percentualPlano`, que é o sujeito de G3 mais abaixo.
    expect(Object.hasOwn(semChaveNoWire, 'percentualPlano')).toBe(false)
    expect(Object.hasOwn(comChaveNula, 'percentualPlano')).toBe(true)
  })
})

describe('135/G1 — a célula, com os 4 ramos na MESMA renderização', () => {
  it('🔴 ausente ⇒ "—" · null ⇒ "—" · 0 ⇒ "0" · 12 ⇒ "12"', () => {
    const { linhas, celula } = renderizarTabela()

    // Controle positivo do próprio detector: a tabela montou as 4 linhas. Sem isto, um
    // `querySelectorAll` vazio faria toda asserção de "—" passar pelo vazio.
    expect(linhas).toHaveLength(4)

    const textos = LINHAS.map((_, i) => celula(i, COL_QTDE_TICKETS).textContent)
    // Literal escrito à mão, na ordem das linhas — nunca derivado do fixture.
    expect(textos).toEqual(['—', '—', '0', '12'])
  })

  it('🔴 o `0` NÃO colapsa com ausência: a célula diz "0", nunca "—" nem vazio', () => {
    // Este é o assert que um `?? '—'` ou um `if (!v)` no `accessor` deixa VERMELHO. `0` é o
    // valor NORMAL de um cliente sem chamado aberto no período a partir da 135 — dizer "—"
    // ali afirmaria "não sei" sobre um número conhecido.
    const { celula } = renderizarTabela()
    const cell = celula(2, COL_QTDE_TICKETS)
    expect(cell.textContent).toBe('0')
    expect(cell.textContent).not.toBe('—')
    expect(cell.textContent).not.toBe('')
  })

  it('🔴 a chave AUSENTE vira "—", nunca "undefined", nunca "0", nunca célula vazia', () => {
    // `?? 0` (o defeito que a planilha propaga por e-mail) deixa este assert vermelho, e
    // renderizar `row.qtdeTickets` cru imprimiria a string "undefined" na tela.
    const { celula } = renderizarTabela()
    const cell = celula(0, COL_QTDE_TICKETS)
    expect(cell.textContent).toBe('—')
    expect(cell.textContent).not.toContain('undefined')
    expect(cell.textContent).not.toBe('0')
  })

  it('🔴 a chave presente valendo `null` vira "—" — é o caso que só `== null` pega', () => {
    // Trocar o guard para `=== undefined` deixa SÓ este vermelho: o irmão ausente continua
    // verde. É por isso que os dois rodam na mesma renderização.
    const { celula } = renderizarTabela()
    expect(celula(1, COL_QTDE_TICKETS).textContent).toBe('—')
  })

  it('a contagem conhecida sai como número CRU, sem separador e sem casa decimal', () => {
    // `formatDecimal` imprimiria `12,0` e `formatHours` imprimiria `12h 0m`. Nenhum
    // formatador entra nesta célula (não existe `formatInteger` no repo — medido).
    const { celula } = renderizarTabela()
    const texto = celula(3, COL_QTDE_TICKETS).textContent
    expect(texto).toBe('12')
    expect(texto).not.toContain(',')
    expect(texto).not.toContain('h')
  })
})

describe('135/G3 no front — a linha SEM plano não desaparece da tabela', () => {
  it('🔴 linha com `percentualPlano` ausente e linha com 120 renderizam JUNTAS', () => {
    const { linhas, celula } = renderizarTabela()

    // A tela renderiza o que o wire manda: nenhum `.filter()` em memória sobre `data.items`.
    // Se alguém filtrar, a linha sem `%` some — e o usuário que escolheu "Fora do Plano"
    // (que por G3 INCLUI cliente sem plano) vê menos clientes do que o servidor mandou.
    expect(linhas).toHaveLength(4)
    const nomes = linhas.map((l) => l.querySelectorAll('td')[1].textContent)
    expect(nomes).toEqual([
      'Cliente Sem Chave',
      'Cliente Chave Nula',
      'Cliente Zero',
      'Cliente Doze',
    ])

    // A linha sem `%` mostra "—" em classe NEUTRA — nunca o vermelho de "estourou o plano"
    // sobre um valor desconhecido (o defeito de produção da 129/FE-PCT).
    const semPercentual = celula(0, 8).querySelector('span')!
    expect(celula(0, 8).textContent).toBe('—')
    expect(semPercentual.className).toContain(CLASSE_NEUTRA)
    expect(semPercentual.className).not.toContain(CLASSE_VERMELHA)

    // 🔴 Companheira positiva NA MESMA renderização: o vermelho não foi desligado.
    const estourado = celula(3, 8).querySelector('span')!
    expect(celula(3, 8).textContent).toBe('120,0%')
    expect(estourado.className).toContain(CLASSE_VERMELHA)
  })
})

describe('135/G1 — o cabeçalho: ⓘ fora do botão de ordenação, e o token da whitelist', () => {
  it('o ⓘ da coluna existe com o texto ancorado e é IRMÃO do botão de ordenar', () => {
    const onSort = vi.fn()
    const { container } = renderizarTabela({ onSort })

    // O tooltip vem do módulo de textos (que tem o próprio teste com literal escrito à mão):
    // aqui se prova o LIGAMENTO coluna↔texto↔DOM. Se a coluna passar a usar string inline,
    // `columns.competencia.test.ts` cai; se perder o ⓘ, este cai.
    const info = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${TOOLTIP_QTDE_TICKETS}"]`,
    )
    expect(info).not.toBeNull()

    // 🔴 `headerInfo`, NUNCA `headerNode`: o ⓘ é `<button>` e o cabeçalho ordenável também.
    // Aninhá-los é HTML inválido — e o assert abaixo é a prova no DOM, não na intenção.
    const botaoDeOrdenar = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Ordenar por Qtde. Tickets"]',
    )
    expect(botaoDeOrdenar).not.toBeNull()
    expect(botaoDeOrdenar!.contains(info!)).toBe(false)
    expect(info!.querySelector('button')).toBeNull()
  })

  it('🔴 clicar no cabeçalho pede ordenação por `qtdetickets` — o token da whitelist', () => {
    // É a ponta de EFEITO do vocabulário de ordenação: `columns.test.ts` trava o literal na
    // estrutura, e aqui se prova que é ele que sai do clique. `sortBy` fora da whitelist NÃO
    // dá 400 — o backend cai no default (`horasusadas desc`) em silêncio —, então uma chave
    // errada produziria uma seta que reordena a tela e não reordena nada no servidor.
    const onSort = vi.fn()
    const { container } = renderizarTabela({ onSort })
    const botao = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Ordenar por Qtde. Tickets"]',
    )!
    botao.click()
    expect(onSort).toHaveBeenCalledWith('qtdetickets')

    // Companheira positiva: o mesmo mecanismo com OUTRA coluna manda OUTRO token. Sem ela,
    // um `onSort` que ignorasse o argumento e mandasse sempre `'qtdetickets'` passaria.
    container
      .querySelector<HTMLButtonElement>('button[aria-label="Ordenar por Horas Usadas"]')!
      .click()
    expect(onSort).toHaveBeenLastCalledWith('horasusadas')
  })

  it('o ⓘ é alcançável por teclado e mostra o tooltip no foco, sem ordenar', async () => {
    const onSort = vi.fn()
    const { container } = renderizarTabela({ onSort })
    const info = container.querySelector<HTMLButtonElement>(
      `button[aria-label="${TOOLTIP_QTDE_TICKETS}"]`,
    )!

    // O primitivo (`InfoIcon`) já tem os testes dele; o que se prova aqui é que a coluna o
    // recebeu de forma alcançável e que o clique no ⓘ **não** dispara a ordenação — o
    // `stopPropagation` de `InfoIcon.tsx` sob a estrutura real deste cabeçalho.
    info.focus()
    expect(document.activeElement).toBe(info)
    await userEvent.click(info)
    expect(onSort).not.toHaveBeenCalled()
  })

  it('o `<th>` da coluna anuncia `aria-sort="none"` — e isso é VERDADE por causa da whitelist', () => {
    // `aria-sort` vem de graça da `DataTable` quando `sortable && sortKey`. Ele só é honesto
    // porque `qtdetickets` está na whitelist do backend: sem a entrada lá, o leitor de tela
    // anunciaria uma ordenação que não acontece.
    const { container } = renderizarTabela()
    const ths = Array.from(container.querySelectorAll('thead th'))
    expect(ths).toHaveLength(12)
    expect(ths[COL_QTDE_TICKETS].getAttribute('aria-sort')).toBe('none')
    expect(ths[COL_QTDE_TICKETS].textContent).toContain('Qtde. Tickets')
  })

  it('quando a ordenação ativa é `qtdetickets`, o `<th>` anuncia a direção', () => {
    const { container } = renderizarTabela({
      sortState: { sortBy: 'qtdetickets', sortDirection: 'desc' },
      onSort: vi.fn(),
    })
    const ths = Array.from(container.querySelectorAll('thead th'))
    expect(ths[COL_QTDE_TICKETS].getAttribute('aria-sort')).toBe('descending')
    // Companheira negativa na mesma renderização: as outras continuam "none". Sem ela,
    // um `aria-sort` fixo em "descending" passaria.
    expect(ths[0].getAttribute('aria-sort')).toBe('none')
  })
})
