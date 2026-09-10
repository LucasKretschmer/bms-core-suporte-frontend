import type { MultiSelectOption } from '../../../components/ui/MultiSelectCombobox'

/**
 * 135/G5 — **vocabulário do SERVIDOR** para o filtro "Uso do plano" de
 * `GET /metrics/plan-consumption`.
 *
 * O backend deriva os tokens do enum em runtime (`UsoDoPlanoFaixaValores.Tokens`, sobre
 * `Suporte.Domain/Enums/UsoDoPlanoFaixa.cs` — a ordem de declaração é contrato); deste lado
 * eles são escritos **uma vez, aqui**, e travados por **identidade literal** no teste
 * (`AP-API-002`). 🔴 **Nenhum outro arquivo do front digita um token** — quem trocar o
 * vocabulário edita um arquivo só, e `usoDoPlanoTextos.test.ts` reprova **nomeando** o
 * token.
 *
 * A lista do teste é escrita **à mão**, nunca derivada da resposta do backend: expectativa
 * derivada da própria resposta é tautologia (`rules/tests.md`).
 */
export const USO_DO_PLANO_TOKENS = ['todos', 'dentro', 'risco', 'fora'] as const

export type UsoDoPlanoToken = (typeof USO_DO_PLANO_TOKENS)[number]

/**
 * `todos` é token **VÁLIDO** do servidor e significa "sem filtro": quando vem acompanhado,
 * ele **absorve** a união (`135/analise-backend.md` §4.3). Uma **linha**, porém, nunca "é
 * Todos" — o classificador do backend nunca devolve essa faixa
 * (`ClassificadorUsoDoPlano.Classificar`).
 */
export const USO_DO_PLANO_TODOS = 'todos'

/** As faixas que classificam uma linha — tudo menos o sentinela de "sem filtro". */
export type FaixaUsoDoPlano = Exclude<UsoDoPlanoToken, typeof USO_DO_PLANO_TODOS>

/**
 * As 3 faixas, **DERIVADAS** dos tokens (uma lista só, nunca duas — `rules/security.md`
 * § Invariante: duas enumerações à mão sobre o mesmo conjunto divergem; a questão é quando).
 *
 * O tipo de retorno do predicado é **anotado de propósito**: nunca confiar na inferência de
 * type guard (parente de `AP-FRONTEND-023`).
 */
export const FAIXAS_USO_DO_PLANO: readonly FaixaUsoDoPlano[] = USO_DO_PLANO_TOKENS.filter(
  (t): t is FaixaUsoDoPlano => t !== USO_DO_PLANO_TODOS,
)

export const LABEL_FILTRO_USO_DO_PLANO = 'Uso do plano'
export const LABEL_USO_DO_PLANO_TODOS = 'Todos'

/**
 * ⚠️ **AP-FRONTEND-022 — os números 80 e 100 nos rótulos são asserções sobre o sistema, não
 * copy.** Eles são o classificador do backend (`ClassificadorUsoDoPlano.LimiteRisco = 80m`,
 * `LimiteFora = 100m`, com o **100 INCLUSIVE** em "Em Risco"). Vivem **só aqui**, e o teste
 * os trava por literal escrito à mão: mudança de limiar ⇒ varredura destes rótulos, e o
 * teste reprova.
 *
 * **Por que os rótulos dizem os números por extenso** em vez de comparadores: comparador em
 * rótulo de filtro é ambíguo justamente **na borda**, e a borda é o requisito (o `100` exato
 * é "Em Risco"). "80% a 100%" e "mais de 100%" dizem a mesma regra sem deixar o `100`
 * indefinido.
 *
 * ⚠️ **"sem plano", nunca "sem plano contratado":** `columns.competencia.test.ts` proíbe
 * `/plano contratado/i` em `headerInfo` desta tela. O rótulo do filtro não é `headerInfo` e
 * não seria pego, mas usar a mesma redação em toda a tela evita que a frase migre para um
 * `headerInfo` num commit futuro e derrube o invariante longe da causa.
 */
export const LABEL_USO_DO_PLANO_DENTRO = 'Dentro do Plano (menos de 80%)'
export const LABEL_USO_DO_PLANO_RISCO = 'Em Risco (80% a 100%)'
export const LABEL_USO_DO_PLANO_FORA = 'Fora do Plano (mais de 100%, ou sem plano)'

/**
 * 135/G3 — a explicação de por que "Fora do Plano" traz linhas com `—` na coluna
 * "% do Plano": cliente **sem plano** entra nessa faixa (`percentualPlano is null → Fora`,
 * por construção no classificador do backend).
 *
 * Vai no `InfoIcon` **ao lado do filtro** — onde o usuário está olhando —, e **não** dentro
 * do `(?)` recolhido: o nome acessível daquele disclosure é "como o período é contado nesta
 * tela", e G3 não é sobre período (`AP-FRONTEND-022`).
 *
 * ⚠️ Curto por **restrição medida**: o balão do `InfoIcon` é `whitespace-nowrap` e o clamp
 * reposiciona sem quebrar linha ⇒ texto longo sai numa linha só e estoura a viewport
 * (limite prático ~90 caracteres, registrado em `132/§3.3`).
 */
export const TOOLTIP_FILTRO_USO_DO_PLANO =
  'Filtra pela coluna "% do Plano". Cliente sem plano entra em Fora do Plano.'

/**
 * Ordem canônica de **exibição** e de **envio**. "Todos" é sempre a 1ª opção.
 *
 * A identidade com `USO_DO_PLANO_TOKENS` é travada no teste: opção de UI sem token — ou
 * token sem opção — reprova.
 */
export const OPCOES_USO_DO_PLANO: MultiSelectOption<UsoDoPlanoToken>[] = [
  { value: 'todos', label: LABEL_USO_DO_PLANO_TODOS },
  { value: 'dentro', label: LABEL_USO_DO_PLANO_DENTRO },
  { value: 'risco', label: LABEL_USO_DO_PLANO_RISCO },
  { value: 'fora', label: LABEL_USO_DO_PLANO_FORA },
]

/**
 * O que o `MultiSelectCombobox` recebe em `value`.
 *
 * O estado do filtro guarda **só faixas** (`FaixaUsoDoPlano[]`) e `[]` significa "todos" —
 * logo *"Todos + só Em Risco"* fica **inexpressável**, em vez de ser um estado válido que um
 * handler recusa (135/G2). Aqui o `[]` é traduzido para o sentinela **apenas na
 * apresentação**, para que "Todos" apareça marcado.
 *
 * 🔴 Não tolera `undefined` de propósito: o estado inicial é `[]` (array vazio), e um
 * fixture que mande `undefined` **deve** estourar — afrouxar esta função para acomodar mock
 * errado apagaria o sinal (`rules/tests.md`, inversão de causa).
 */
export function valorExibidoUsoDoPlano(faixas: readonly FaixaUsoDoPlano[]): UsoDoPlanoToken[] {
  return faixas.length === 0 ? [USO_DO_PLANO_TODOS] : [...faixas]
}

/**
 * Reordena pela ordem canônica de `USO_DO_PLANO_TOKENS` (D-9), sem duplicar: o universo é
 * `FAIXAS_USO_DO_PLANO`, derivado dos tokens.
 */
function ordemCanonica(faixas: readonly FaixaUsoDoPlano[]): FaixaUsoDoPlano[] {
  return FAIXAS_USO_DO_PLANO.filter((canonica) => faixas.includes(canonica))
}

/**
 * 135/G2 — "Todos limpa e desmarca as demais; nada selecionado = todos".
 *
 * 🔴 **`anterior` é obrigatório, e não é decoração.** O `MultiSelectCombobox` é genérico:
 * devolve só o array alternado e **não diz qual item foi clicado**. Os dois cliques
 * diferentes produzem arrays com o mesmo **conteúdo**:
 *
 * | Clique | `value` recebido | `proximo` | correto |
 * |---|---|---|---|
 * | "Todos" marcado, clica em **Em Risco** | `['todos']` | `['todos','risco']` | `['risco']` |
 * | "Em Risco" marcado, clica em **Todos** | `['risco']` | `['risco','todos']` | `[]` |
 *
 * Distinguir pela **posição** do token seria frágil (dependeria de o componente continuar
 * fazendo append). Com `anterior`, a decisão é sobre **estado**, não sobre ordem de array.
 *
 * O retorno sai em **ordem canônica** (D-9): `useServerTable` põe o objeto `filters` inteiro
 * na `queryKey`, e o TanStack hasheia arrays por conteúdo **e ordem** ⇒ `['risco','fora']` e
 * `['fora','risco']` seriam duas entradas de cache para o mesmo resultado, decididas pela
 * ordem de clique.
 *
 * ⚠️ **As 3 faixas juntas NÃO são normalizadas para `[]`.** O backend prova que o resultado
 * é o mesmo (`analise-backend.md` §4.3), mas normalizar faria os checkboxes **pularem** para
 * "Todos" sozinhos depois do 3º clique. Menos surpresa vence a economia de um parâmetro.
 */
export function normalizarSelecaoUsoDoPlano(
  proximo: readonly UsoDoPlanoToken[],
  anterior: readonly FaixaUsoDoPlano[],
): FaixaUsoDoPlano[] {
  const todosNoProximo = proximo.includes(USO_DO_PLANO_TODOS)
  // "Todos" estava EXIBIDO marcado ⇔ nenhuma faixa selecionada (ver `valorExibidoUsoDoPlano`).
  const todosJaMarcado = anterior.length === 0

  // Clicou em "Todos" (ele não estava marcado) ⇒ limpa tudo. Sem o `!todosJaMarcado`,
  // marcar uma faixa com "Todos" ativo devolveria `[]` — e o filtro NUNCA filtraria nada.
  if (todosNoProximo && !todosJaMarcado) return []

  return ordemCanonica(
    proximo.filter((valor): valor is FaixaUsoDoPlano => valor !== USO_DO_PLANO_TODOS),
  )
}
