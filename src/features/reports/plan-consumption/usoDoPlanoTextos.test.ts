/**
 * 135/U1 — o vocabulário do filtro "Uso do plano" e as duas funções puras que o governam.
 *
 * O que cada bloco existe para deixar VERMELHO (`rules/tests.md` § Prova de detecção):
 *
 *  1. **T-01** — o vocabulário do servidor mudar de grafia, ganhar ou perder um token. Os
 *     quatro nomes são escritos **à mão** aqui; é a outra ponta do `AP-API-002`, casando com
 *     `UsoDoPlanoFaixaValores.Tokens` (derivado do enum no backend). 🔴 Nunca derivar o
 *     esperado da resposta do backend — expectativa derivada da própria resposta é
 *     tautologia.
 *  2. **T-02** — os limiares 80/100 saírem errados dos rótulos, ou "sem plano" desaparecer
 *     do rótulo de "Fora do Plano" (é o que torna 135/G3 legível).
 *  3. **T-03** — qualquer ramo de `normalizarSelecaoUsoDoPlano` invertido/removido (135/G2).
 *  4. **T-04** — "Todos" deixar de aparecer marcado, ou passar a aparecer marcado junto de
 *     uma faixa (o estado que G2 proíbe).
 *  5. **T-05** — a serialização do array voltar ao default do axios v1 (`usoPlano[]=…`). O
 *     objeto de params em memória não prova nada sobre o que chega ao ASP.NET (memória
 *     `contrato-wire-backend-frontend`): aqui a query sai da **instância real** do projeto.
 */

import { describe, expect, it } from 'vitest'

import { api } from '../../../services/api'
import {
  FAIXAS_USO_DO_PLANO,
  LABEL_FILTRO_USO_DO_PLANO,
  LABEL_USO_DO_PLANO_DENTRO,
  LABEL_USO_DO_PLANO_FORA,
  LABEL_USO_DO_PLANO_RISCO,
  LABEL_USO_DO_PLANO_TODOS,
  OPCOES_USO_DO_PLANO,
  TOOLTIP_FILTRO_USO_DO_PLANO,
  USO_DO_PLANO_TODOS,
  USO_DO_PLANO_TOKENS,
  normalizarSelecaoUsoDoPlano,
  valorExibidoUsoDoPlano,
  type FaixaUsoDoPlano,
  type UsoDoPlanoToken,
} from './usoDoPlanoTextos'

// ── T-01 · identidade literal do vocabulário (AP-API-002) ────────────────────

describe('T-01 · o vocabulário do servidor é nominalmente este', () => {
  it('🔴 os 4 tokens, na ordem de declaração do enum do backend', () => {
    // Literal escrito à MÃO — a outra ponta de `UsoDoPlanoFaixaValores.Tokens`
    // (`Suporte.Domain/Enums/UsoDoPlanoFaixa.cs`, ordem de declaração é contrato).
    // Vermelho quando um token muda de grafia, entra, sai ou troca de posição.
    expect(USO_DO_PLANO_TOKENS).toEqual(['todos', 'dentro', 'risco', 'fora'])
  })

  it('a IDENTIDADE do conjunto, não a cardinalidade', () => {
    // Cardinalidade passaria com um token entrando e outro saindo (`rules/tests.md`).
    expect(new Set(USO_DO_PLANO_TOKENS)).toEqual(new Set(['todos', 'dentro', 'risco', 'fora']))
  })

  it('as 3 faixas são derivadas dos tokens, sem o sentinela', () => {
    // Lado esquerdo DERIVADO do módulo, lado direito LITERAL. Vermelho se a derivação
    // deixar o sentinela entrar (ele não classifica linha nenhuma) ou perder uma faixa.
    expect(FAIXAS_USO_DO_PLANO).toEqual(['dentro', 'risco', 'fora'])
    expect(FAIXAS_USO_DO_PLANO).not.toContain(USO_DO_PLANO_TODOS)
  })

  it('🔴 `todos` É token válido do servidor, e faixas ∪ {todos} cobre o vocabulário', () => {
    // Se `todos` deixar de ser vocabulário do servidor (ou a derivação das faixas passar a
    // ser uma segunda lista à mão), uma das duas asserções cai.
    expect(USO_DO_PLANO_TOKENS).toContain(USO_DO_PLANO_TODOS)
    expect([USO_DO_PLANO_TODOS, ...FAIXAS_USO_DO_PLANO]).toEqual([...USO_DO_PLANO_TOKENS])
  })

  it('toda opção de UI tem token, e todo token tem opção de UI — na mesma ordem', () => {
    // Vermelho quando alguém acrescenta um token sem opção (invisível na tela) ou uma opção
    // sem token (o wire receberia valor fora do vocabulário ⇒ 400 `INVALID_USO_PLANO`).
    expect(OPCOES_USO_DO_PLANO.map((o) => o.value)).toEqual([...USO_DO_PLANO_TOKENS])
  })
})

// ── T-02 · os rótulos, e os limiares dentro deles ────────────────────────────

describe('T-02 · os rótulos são literais escritos à mão (AP-FRONTEND-022)', () => {
  it('🔴 os quatro rótulos, verbatim', () => {
    // Os números 80 e 100 são ASSERÇÃO SOBRE O SISTEMA (`ClassificadorUsoDoPlano`:
    // `LimiteRisco = 80m`, `LimiteFora = 100m`, com o 100 INCLUSIVE em Risco), não copy.
    // Vermelho quando o limiar é digitado errado — ex.: "Em Risco (mais de 80%)", que
    // deixaria o 100 indefinido e contradiria `<= LimiteFora`.
    expect(LABEL_USO_DO_PLANO_TODOS).toBe('Todos')
    expect(LABEL_USO_DO_PLANO_DENTRO).toBe('Dentro do Plano (menos de 80%)')
    expect(LABEL_USO_DO_PLANO_RISCO).toBe('Em Risco (80% a 100%)')
    expect(LABEL_USO_DO_PLANO_FORA).toBe('Fora do Plano (mais de 100%, ou sem plano)')
    expect(LABEL_FILTRO_USO_DO_PLANO).toBe('Uso do plano')
  })

  it('🔴 135/G3 — "Fora do Plano" DIZ que cliente sem plano entra nele', () => {
    // É o que torna legível a linha com `—` em "% do Plano" sob esse filtro. Sem a menção,
    // o usuário lê a tela como defeito (PRD §3/G3.2).
    expect(LABEL_USO_DO_PLANO_FORA).toContain('sem plano')
    expect(TOOLTIP_FILTRO_USO_DO_PLANO).toContain('sem plano')
    expect(TOOLTIP_FILTRO_USO_DO_PLANO).toBe(
      'Filtra pela coluna "% do Plano". Cliente sem plano entra em Fora do Plano.',
    )
  })

  it('nenhum rótulo diz "plano contratado" (a coluna é do plano EFETIVO — 132/D11)', () => {
    // O detector de `columns.competencia.test.ts` só vigia `headerInfo`; esta asserção
    // impede a frase de nascer aqui e migrar para lá depois, longe da causa.
    const textos = [
      LABEL_USO_DO_PLANO_TODOS,
      LABEL_USO_DO_PLANO_DENTRO,
      LABEL_USO_DO_PLANO_RISCO,
      LABEL_USO_DO_PLANO_FORA,
      TOOLTIP_FILTRO_USO_DO_PLANO,
    ]
    expect(textos.filter((t) => /plano contratado/i.test(t))).toEqual([])
    // Controle positivo: o detector ainda morde a redação proibida.
    expect(/plano contratado/i.test('clientes sem plano contratado')).toBe(true)
  })

  it('o tooltip do filtro cabe no balão do `InfoIcon` (`whitespace-nowrap`, ~90 chars)', () => {
    // Restrição MEDIDA, não estilo: o clamp do `InfoIcon` reposiciona sem quebrar linha ⇒
    // texto longo sai numa linha só e estoura a viewport (132/§3.3).
    expect(TOOLTIP_FILTRO_USO_DO_PLANO.length).toBeLessThanOrEqual(90)
  })
})

// ── T-03 · `normalizarSelecaoUsoDoPlano` — a tabela de verdade de 135/G2 ─────

type CasoDeNormalizacao = {
  nome: string
  anterior: FaixaUsoDoPlano[]
  proximo: UsoDoPlanoToken[]
  esperado: FaixaUsoDoPlano[]
}

/**
 * As 6 linhas da tabela de verdade de `135/analise-frontend.md` §3.3. `anterior` é o estado
 * (só faixas, `[]` = "todos"); `proximo` é o que o `MultiSelectCombobox` devolve — ele
 * alterna o array e **não** diz qual item foi clicado.
 */
const CASOS_DE_NORMALIZACAO: CasoDeNormalizacao[] = [
  {
    nome: 'marcar uma faixa com "Todos" ativo desmarca "Todos"',
    anterior: [],
    proximo: ['todos', 'risco'],
    esperado: ['risco'],
  },
  {
    nome: 'clicar em "Todos" limpa e desmarca as demais',
    anterior: ['risco'],
    proximo: ['risco', 'todos'],
    esperado: [],
  },
  {
    nome: 'desmarcar "Todos" não muda nada (o não-marcado não tem sentido)',
    anterior: [],
    proximo: [],
    esperado: [],
  },
  {
    nome: 'desmarcar a última faixa volta a "todos"',
    anterior: ['risco'],
    proximo: [],
    esperado: [],
  },
  {
    nome: 'acumula faixas, em ordem canônica',
    anterior: ['risco'],
    proximo: ['risco', 'fora'],
    esperado: ['risco', 'fora'],
  },
  {
    nome: 'ordem CANÔNICA, não ordem de clique',
    anterior: ['fora'],
    proximo: ['fora', 'risco'],
    esperado: ['risco', 'fora'],
  },
]

describe('T-03 · normalizarSelecaoUsoDoPlano (135/G2)', () => {
  it('o conjunto de casos é nominalmente este', () => {
    // `it.each` encolhe em silêncio — menos parâmetros nunca é erro para o runner
    // (`rules/tests.md`). Identidade dos NOMES, não cardinalidade.
    expect(new Set(CASOS_DE_NORMALIZACAO.map((c) => c.nome))).toEqual(
      new Set([
        'marcar uma faixa com "Todos" ativo desmarca "Todos"',
        'clicar em "Todos" limpa e desmarca as demais',
        'desmarcar "Todos" não muda nada (o não-marcado não tem sentido)',
        'desmarcar a última faixa volta a "todos"',
        'acumula faixas, em ordem canônica',
        'ordem CANÔNICA, não ordem de clique',
      ]),
    )
  })

  it.each(CASOS_DE_NORMALIZACAO)('$nome', ({ anterior, proximo, esperado }) => {
    // Vermelho: remover o guard `!todosJaMarcado` derruba a 1ª linha (marcar faixa com
    // "Todos" ativo devolveria `[]` e o filtro NUNCA filtraria nada); devolver `['todos']`
    // em vez de `[]` derruba a 2ª; tirar `ordemCanonica` derruba a 6ª.
    expect(normalizarSelecaoUsoDoPlano(proximo, anterior)).toEqual(esperado)
  })

  it('🔴 o sentinela NUNCA sobrevive no estado', () => {
    // Se `todos` entrasse no estado, o wire mandaria `usoPlano=todos` junto de faixas e a
    // UI passaria a ter o estado misto que G2 proíbe.
    for (const caso of CASOS_DE_NORMALIZACAO) {
      expect(normalizarSelecaoUsoDoPlano(caso.proximo, caso.anterior)).not.toContain(
        USO_DO_PLANO_TODOS,
      )
    }
    // Controle positivo: com as 3 faixas marcadas o retorno NÃO é vazio (não normalizamos
    // "as 3" para `[]` — os checkboxes não pulam para "Todos" sozinhos).
    expect(normalizarSelecaoUsoDoPlano(['dentro', 'risco', 'fora'], ['dentro', 'risco'])).toEqual([
      'dentro',
      'risco',
      'fora',
    ])
  })
})

// ── T-04 · `valorExibidoUsoDoPlano` — o par, na mesma execução ───────────────

describe('T-04 · valorExibidoUsoDoPlano', () => {
  it('🔴 `[]` exibe "Todos" marcado, e uma faixa exibe a própria faixa', () => {
    // O par é obrigatório: só o 1º passaria se a função injetasse o sentinela SEMPRE
    // ("Todos" marcado junto de uma faixa — o estado que G2 proíbe); só o 2º passaria se a
    // função virasse identidade ("Todos" nunca apareceria marcado).
    expect(valorExibidoUsoDoPlano([])).toEqual(['todos'])
    expect(valorExibidoUsoDoPlano(['risco'])).toEqual(['risco'])
    expect(valorExibidoUsoDoPlano(['risco', 'fora'])).toEqual(['risco', 'fora'])
  })

  it('não devolve o array de estado por referência (o combobox não muta o estado)', () => {
    const estado: FaixaUsoDoPlano[] = ['dentro']
    expect(valorExibidoUsoDoPlano(estado)).not.toBe(estado)
  })
})

// ── T-05 · o WIRE, pela instância real do projeto ────────────────────────────

describe('T-05 · serialização de `usoPlano` na query string', () => {
  /**
   * Query string produzida pelo pipeline REAL do Axios: `getUri` aplica o
   * `paramsSerializer: { indexes: null }` de `services/api.ts:40` — o mesmo que a request
   * usaria. Técnica de `services/api.test.ts:69-76`.
   */
  function query(params: Record<string, unknown>): string {
    const uri = api.getUri({ url: '/x', params })
    const i = uri.indexOf('?')
    return i === -1 ? '' : uri.slice(i + 1)
  }

  it('🔴 sai como repeat SEM colchetes: usoPlano=dentro&usoPlano=risco', () => {
    // Vermelho se a instância voltar ao default do axios v1 (`usoPlano[]=…`): o backend
    // aceita as duas grafias (`MetricsController.cs:446-447`), mas é esta que o cliente do
    // repo emite e a que a suíte trava.
    expect(query({ usoPlano: ['dentro', 'risco'] })).toBe('usoPlano=dentro&usoPlano=risco')
  })

  it('nem colchetes nem índices, em nenhuma forma', () => {
    const q = query({ usoPlano: ['dentro', 'risco'] })
    expect(q).not.toContain('usoPlano[]')
    expect(q).not.toContain('usoPlano[0]')
  })

  it('🔴 os tokens do MÓDULO chegam ao wire com a grafia esperada (AP-API-002)', () => {
    // Entrada DERIVADA do módulo, expectativa LITERAL escrita à mão: trocar um token
    // (ex.: `risco` → `emrisco`) deixa este caso vermelho junto com o T-01 — é a prova de
    // que o vocabulário está travado do tipo até a query string.
    expect(query({ usoPlano: [...USO_DO_PLANO_TOKENS] })).toBe(
      'usoPlano=todos&usoPlano=dentro&usoPlano=risco&usoPlano=fora',
    )
  })

  it('companheira positiva: params single-value continuam inalterados', () => {
    // Sem ela, "não contém colchetes" passaria com a query VAZIA (asserção negativa é
    // satisfeita pelo vazio — `rules/tests.md`).
    expect(query({ search: 'abc', usoPlano: ['fora'] })).toBe('search=abc&usoPlano=fora')
  })
})
