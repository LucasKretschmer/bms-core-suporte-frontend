import * as ts from 'typescript'

/**
 * 124/FE-FIX2 (achado `D-8` do QA de frontend) — o INVENTÁRIO de queries do TanStack
 * Query, **derivado da AST do código real**, nunca mantido à mão.
 *
 * ## O defeito que este módulo existe para impedir
 *
 * `features/support-plans/hooks/useSupportPlans.ts` e
 * `features/reports/shared/components/PlanCombobox.tsx` liam o **mesmo endpoint** sob a
 * **mesma `queryKey`** (`['support-plans']`) com **`queryFn` diferentes** e **tipos
 * `SupportPlanDto` diferentes**. Chave igual é **a mesma entrada de cache**: quem busca
 * primeiro decide o objeto que o outro lê. O erro aparece como *campo faltando em
 * runtime* — e **não há erro de tipo**, porque cada lado está corretamente tipado do seu
 * lado. É invisível para o compilador, para o lint e para qualquer teste de unidade.
 *
 * ## Por que a verificação é DERIVADA, e não uma lista de chaves
 *
 * `rules/security.md` § *"Invariante de segurança e a enumeração que lhe dá poder"*:
 * *nenhuma enumeração que dá poder a um invariante é mantida à mão — derive em runtime da
 * fonte real*. Uma lista de chaves conhecidas escrita à mão envelhece no primeiro
 * `useQuery` novo, e **a próxima colisão nasce fora do detector, em silêncio**. Aqui a
 * fonte real é a AST de **todo** arquivo de `src/`, sem exclusão por padrão de nome.
 *
 * ## O recorte é ESTRUTURAL, não o nome do hook
 *
 * Não procuramos chamadas a `useQuery` (isso deixaria de fora `useQueries`,
 * `useSuspenseQuery`, `prefetchQuery`, `fetchQuery` e qualquer wrapper do projeto, cada um
 * uma porta nova para a mesma colisão). Procuramos **todo objeto literal que tem
 * `queryKey` e `queryFn`** — que é, por definição, um objeto de opções de query. O
 * detector não depende de como o objeto chega ao cliente.
 *
 * ## Nada é ignorado em silêncio
 *
 * Chave que o módulo não consegue resolver estaticamente (fábrica de chave, spread) não é
 * descartada: sai em `resolvida: false`, com a **expressão literal** como identidade, para
 * que o teste possa travá-la nominalmente. Ignorar o que não se entende é exatamente como
 * uma varredura fica inerte.
 *
 * ## Limite honesto (escrito, não descoberto depois)
 *
 * A comparação é **estática**: duas chaves com partes dinâmicas (`['x', id]`) contam como
 * a mesma chave canônica `["x",?]` — conservador de propósito, porque em runtime elas
 * colidem quando os argumentos coincidem. O módulo **não** cobre escrita direta no cache
 * (`setQueryData`) — hoje não há nenhuma em `src/` (verificado por grep em 06/09/2026), e
 * cobri-la exige rastrear o tipo escrito, não só a chave.
 *
 * Módulo puro de propósito: quem lê o disco é injetado (`Sistema`), como em
 * `utils/cssCascade.ts`. Assim o mecanismo é testável com um sistema de arquivos
 * fabricado — que é o **controle positivo** do detector.
 *
 * 📍 Mora em `features/support-plans/utils/` porque é aqui que o defeito foi corrigido e
 * este era o escopo da unidade; o lugar natural dele é `src/utils/`, ao lado dos irmãos
 * `alertTokenContrast.ts` e `cssCascade.ts`. Movê-lo é mudança de uma linha de import.
 */

/** Acesso ao disco, injetado. Caminhos POSIX relativos à raiz do projeto. */
export type Sistema = {
  /** Lê um arquivo. Deve LANÇAR se não existir. */
  ler: (caminho: string) => string
  /** `true` se o caminho é um arquivo legível. */
  existe: (caminho: string) => boolean
  /** Todos os arquivos sob o diretório, recursivamente. */
  listar: (diretorio: string) => string[]
}

/** Um objeto de opções de query encontrado no código. */
export type UsoDeQuery = {
  /** Arquivo POSIX relativo à raiz. */
  arquivo: string
  /** Linha 1-based do `queryKey`. */
  linha: number
  /**
   * Chave canônica: `["support-plans"]`, `["client-kpis",?,?,?]` (`?` = parte dinâmica),
   * ou a expressão crua quando `resolvida === false`.
   */
  chave: string
  /** `false` quando a chave não pôde ser resolvida estaticamente. */
  resolvida: boolean
  /**
   * Identidade da `queryFn`: `<arquivo>::<nome>` para função nomeada (resolvida pelo
   * import, então dois `listSupportPlans` de módulos diferentes são fontes diferentes),
   * ou `<arquivo>::inline#<n>` para função anônima que transforma o resultado.
   */
  fonte: string
}

/** Duas ou mais fontes distintas escrevendo na mesma entrada de cache. */
export type ColisaoDeChave = {
  chave: string
  fontes: string[]
  ocorrencias: { arquivo: string; linha: number; fonte: string }[]
}

const EXTENSOES_DE_MODULO = ['.ts', '.tsx', '/index.ts', '/index.tsx'] as const
const PROFUNDIDADE_MAXIMA = 4

function ehTsx(arquivo: string): boolean {
  return arquivo.endsWith('.tsx')
}

function dirPosix(caminho: string): string {
  const corte = caminho.lastIndexOf('/')
  return corte === -1 ? '' : caminho.slice(0, corte)
}

function juntarPosix(dir: string, relativo: string): string {
  const partes = dir === '' ? [] : dir.split('/')
  for (const parte of relativo.split('/')) {
    if (parte === '' || parte === '.') continue
    if (parte === '..') {
      if (partes.length === 0) throw new Error(`Import sobe acima da raiz: "${dir}" + "${relativo}"`)
      partes.pop()
      continue
    }
    partes.push(parte)
  }
  return partes.join('/')
}

/** Onde um import relativo aterrissa, ou `null` quando é pacote/inexistente. */
function resolverModulo(
  importador: string,
  especificador: string,
  sistema: Sistema,
): string | null {
  if (!especificador.startsWith('.')) return null
  const base = juntarPosix(dirPosix(importador), especificador)
  if (sistema.existe(base)) return base
  for (const sufixo of EXTENSOES_DE_MODULO) {
    const candidato = `${base}${sufixo}`
    if (sistema.existe(candidato)) return candidato
  }
  return null
}

type Modulo = {
  arquivo: string
  fonte: ts.SourceFile
  /** nome local -> especificador do módulo de origem. */
  importado: Map<string, string>
  /** nome local -> inicializador da const, ou a declaração da função. */
  declarado: Map<string, ts.Expression | ts.FunctionDeclaration>
}

function analisarModulo(arquivo: string, sistema: Sistema): Modulo {
  const fonte = ts.createSourceFile(
    arquivo,
    sistema.ler(arquivo),
    ts.ScriptTarget.Latest,
    true,
    ehTsx(arquivo) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const importado = new Map<string, string>()
  const declarado = new Map<string, ts.Expression | ts.FunctionDeclaration>()

  for (const statement of fonte.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const especificador = statement.moduleSpecifier.text
      const clausula = statement.importClause
      if (clausula === undefined) continue
      if (clausula.name !== undefined) importado.set(clausula.name.text, especificador)
      const bindings = clausula.namedBindings
      if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
        importado.set(bindings.name.text, especificador)
      }
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const elemento of bindings.elements) importado.set(elemento.name.text, especificador)
      }
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaracao of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaracao.name) && declaracao.initializer !== undefined) {
          declarado.set(declaracao.name.text, declaracao.initializer)
        }
      }
      continue
    }
    if (ts.isFunctionDeclaration(statement) && statement.name !== undefined) {
      declarado.set(statement.name.text, statement)
    }
  }

  return { arquivo, fonte, importado, declarado }
}

/** Cache de módulos já parseados — o mesmo serviço é importado por dezenas de arquivos. */
function criarCacheDeModulos(sistema: Sistema): (arquivo: string) => Modulo {
  const cache = new Map<string, Modulo>()
  return (arquivo: string): Modulo => {
    const existente = cache.get(arquivo)
    if (existente !== undefined) return existente
    const modulo = analisarModulo(arquivo, sistema)
    cache.set(arquivo, modulo)
    return modulo
  }
}

function semParenteses(no: ts.Expression): ts.Expression {
  let atual = no
  while (ts.isParenthesizedExpression(atual) || ts.isAsExpression(atual)) {
    atual = atual.expression
  }
  return atual
}

/** Um elemento de array de chave vira literal (`"x"`), `...` (spread) ou `?` (dinâmico). */
function tokenDeElemento(elemento: ts.Expression): string {
  if (ts.isSpreadElement(elemento)) return '...'
  const nu = semParenteses(elemento)
  if (ts.isStringLiteral(nu) || ts.isNoSubstitutionTemplateLiteral(nu)) {
    return JSON.stringify(nu.text)
  }
  if (ts.isNumericLiteral(nu)) return nu.text
  if (nu.kind === ts.SyntaxKind.TrueKeyword) return 'true'
  if (nu.kind === ts.SyntaxKind.FalseKeyword) return 'false'
  return '?'
}

function canonizarArray(array: ts.ArrayLiteralExpression): string {
  return `[${array.elements.map(tokenDeElemento).join(',')}]`
}

/** O array literal que uma função/arrow devolve, quando devolve um só. */
function arrayDeRetorno(no: ts.Node): ts.ArrayLiteralExpression | null {
  if (!ts.isArrowFunction(no) && !ts.isFunctionDeclaration(no) && !ts.isFunctionExpression(no)) {
    return null
  }
  const corpo = no.body
  if (corpo === undefined) return null
  if (!ts.isBlock(corpo)) {
    const expressao = semParenteses(corpo)
    return ts.isArrayLiteralExpression(expressao) ? expressao : null
  }
  const retornos = corpo.statements.filter(ts.isReturnStatement)
  if (retornos.length !== 1 || retornos[0].expression === undefined) return null
  const expressao = semParenteses(retornos[0].expression)
  return ts.isArrayLiteralExpression(expressao) ? expressao : null
}

type Contexto = {
  modulo: Modulo
  carregar: (arquivo: string) => Modulo
  sistema: Sistema
  profundidade: number
}

/** A declaração local (ou importada) de um nome, seguindo o import quando preciso. */
function resolverNome(
  nome: string,
  ctx: Contexto,
): { no: ts.Expression | ts.FunctionDeclaration; ctx: Contexto } | null {
  const local = ctx.modulo.declarado.get(nome)
  if (local !== undefined) return { no: local, ctx }

  const especificador = ctx.modulo.importado.get(nome)
  if (especificador === undefined || ctx.profundidade >= PROFUNDIDADE_MAXIMA) return null
  const alvo = resolverModulo(ctx.modulo.arquivo, especificador, ctx.sistema)
  if (alvo === null) return null
  const moduloAlvo = ctx.carregar(alvo)
  const declarado = moduloAlvo.declarado.get(nome)
  if (declarado === undefined) return null
  return { no: declarado, ctx: { ...ctx, modulo: moduloAlvo, profundidade: ctx.profundidade + 1 } }
}

/**
 * A propriedade `nome` de um objeto literal, quando ele é um.
 *
 * ⚠️ Trata **atalho** (`{ queryFn }`) além de `{ queryFn: x }`. Sem isso o detector teria
 * um buraco silencioso: `useAppointments.ts:131` e `useProjectAppointments.ts:69` escrevem
 * exatamente assim, e o objeto de opções inteiro escapava da varredura — que é o modo de
 * falha que este módulo existe para não ter.
 */
function propriedadeDeObjeto(no: ts.Node, nome: string): ts.Expression | null {
  if (!ts.isObjectLiteralExpression(no)) return null
  for (const propriedade of no.properties) {
    if (
      ts.isPropertyAssignment(propriedade) &&
      (ts.isIdentifier(propriedade.name) || ts.isStringLiteral(propriedade.name)) &&
      propriedade.name.text === nome
    ) {
      return propriedade.initializer
    }
    if (ts.isShorthandPropertyAssignment(propriedade) && propriedade.name.text === nome) {
      return propriedade.name
    }
  }
  return null
}

/** `true` se o objeto tem `...algo` — a `queryFn` pode estar escondida ali dentro. */
function temEspalhamento(no: ts.ObjectLiteralExpression): boolean {
  return no.properties.some((propriedade) => ts.isSpreadAssignment(propriedade))
}

/**
 * A chave canônica de uma expressão de `queryKey`, ou `null` quando não é resolvível
 * estaticamente. Resolve array literal, constante (local ou importada), fábrica de chave
 * (`chaveDeX(id)`) e propriedade de objeto de chaves (`chaves.time(id)`).
 */
function canonizarChave(expressao: ts.Expression, ctx: Contexto): string | null {
  if (ctx.profundidade > PROFUNDIDADE_MAXIMA) return null
  const nu = semParenteses(expressao)

  if (ts.isArrayLiteralExpression(nu)) return canonizarArray(nu)

  if (ts.isIdentifier(nu)) {
    const resolvido = resolverNome(nu.text, ctx)
    if (resolvido === null) return null
    if (ts.isFunctionDeclaration(resolvido.no)) {
      const array = arrayDeRetorno(resolvido.no)
      return array === null ? null : canonizarArray(array)
    }
    return canonizarChave(resolvido.no, { ...resolvido.ctx, profundidade: ctx.profundidade + 1 })
  }

  if (ts.isCallExpression(nu)) {
    const alvo = alvoDeChamada(nu.expression, ctx)
    if (alvo === null) return null
    const array = arrayDeRetorno(alvo)
    return array === null ? null : canonizarArray(array)
  }

  if (ts.isPropertyAccessExpression(nu)) {
    const dono = semParenteses(nu.expression)
    if (!ts.isIdentifier(dono)) return null
    const resolvido = resolverNome(dono.text, ctx)
    if (resolvido === null) return null
    const propriedade = propriedadeDeObjeto(resolvido.no, nu.name.text)
    if (propriedade === null) return null
    return canonizarChave(propriedade, { ...resolvido.ctx, profundidade: ctx.profundidade + 1 })
  }

  return null
}

/** A declaração (função/arrow) chamada por uma expressão de chamada, quando localizável. */
function alvoDeChamada(chamado: ts.Expression, ctx: Contexto): ts.Node | null {
  const nu = semParenteses(chamado)
  if (ts.isIdentifier(nu)) {
    const resolvido = resolverNome(nu.text, ctx)
    return resolvido === null ? null : resolvido.no
  }
  if (ts.isPropertyAccessExpression(nu)) {
    const dono = semParenteses(nu.expression)
    if (!ts.isIdentifier(dono)) return null
    const resolvido = resolverNome(dono.text, ctx)
    if (resolvido === null) return null
    const propriedade = propriedadeDeObjeto(resolvido.no, nu.name.text)
    return propriedade
  }
  return null
}

/** `<arquivo>::<nome>` de um identificador, seguindo o import até o módulo de origem. */
function identidadeDeNome(nome: string, ctx: Contexto): string {
  if (ctx.modulo.declarado.has(nome)) return `${ctx.modulo.arquivo}::${nome}`
  const especificador = ctx.modulo.importado.get(nome)
  if (especificador === undefined) return `${ctx.modulo.arquivo}::${nome}`
  const alvo = resolverModulo(ctx.modulo.arquivo, especificador, ctx.sistema)
  return `${alvo ?? especificador}::${nome}`
}

/** A chamada única que uma arrow/função delega, sem transformar o resultado. */
function chamadaDelegadaPor(no: ts.Node): ts.CallExpression | null {
  if (!ts.isArrowFunction(no) && !ts.isFunctionExpression(no)) return null
  const corpo = no.body
  let expressao: ts.Expression | null = null
  if (!ts.isBlock(corpo)) {
    expressao = semParenteses(corpo)
  } else {
    const statements = corpo.statements
    if (statements.length === 1 && ts.isReturnStatement(statements[0])) {
      const retornado = statements[0].expression
      expressao = retornado === undefined ? null : semParenteses(retornado)
    }
  }
  if (expressao === null) return null
  if (ts.isAwaitExpression(expressao)) expressao = semParenteses(expressao.expression)
  return ts.isCallExpression(expressao) ? expressao : null
}

/**
 * Identidade da `queryFn`. Delegação pura (`() => listX()`) tem a MESMA identidade da
 * referência direta (`listX`) — é a mesma fonte. Função que transforma o resultado ganha
 * identidade própria (`inline#n`), porque é justamente ela que produz um segundo tipo sob
 * a mesma chave: foi assim que `['teams']` passou a carregar duas formas diferentes.
 */
function identidadeDaFonte(
  expressao: ts.Expression,
  ctx: Contexto,
  ordinalInline: number,
): string {
  const nu = semParenteses(expressao)

  if (ts.isIdentifier(nu)) return identidadeDeNome(nu.text, ctx)

  if (ts.isPropertyAccessExpression(nu)) {
    const dono = semParenteses(nu.expression)
    if (ts.isIdentifier(dono)) {
      const especificador = ctx.modulo.importado.get(dono.text)
      if (especificador !== undefined) {
        const alvo = resolverModulo(ctx.modulo.arquivo, especificador, ctx.sistema)
        return `${alvo ?? especificador}::${nu.name.text}`
      }
      return `${ctx.modulo.arquivo}::${dono.text}.${nu.name.text}`
    }
    return `${ctx.modulo.arquivo}::inline#${ordinalInline}`
  }

  const delegada = chamadaDelegadaPor(nu)
  if (delegada !== null) {
    const chamado = semParenteses(delegada.expression)
    if (ts.isIdentifier(chamado)) return identidadeDeNome(chamado.text, ctx)
    if (ts.isPropertyAccessExpression(chamado)) {
      return identidadeDaFonte(chamado, ctx, ordinalInline)
    }
  }

  return `${ctx.modulo.arquivo}::inline#${ordinalInline}`
}

function usosComCache(
  arquivo: string,
  sistema: Sistema,
  carregar: (arq: string) => Modulo,
): UsoDeQuery[] {
  const modulo = carregar(arquivo)
  const ctx: Contexto = { modulo, carregar, sistema, profundidade: 0 }
  const usos: UsoDeQuery[] = []
  let ordinalInline = 0

  const visitar = (no: ts.Node): void => {
    if (ts.isObjectLiteralExpression(no)) {
      const chaveExpr = propriedadeDeObjeto(no, 'queryKey')
      const fnExpr = propriedadeDeObjeto(no, 'queryFn')
      // `queryKey` + espalhamento conta mesmo sem `queryFn` visível: a função pode estar
      // dentro do `...`, e um objeto de opções que o detector não vê é um buraco.
      if (chaveExpr !== null && (fnExpr !== null || temEspalhamento(no))) {
        const canonica = canonizarChave(chaveExpr, ctx)
        const fonte =
          fnExpr === null
            ? `${arquivo}::espalhamento#${ordinalInline}`
            : identidadeDaFonte(fnExpr, ctx, ordinalInline)
        if (fonte.endsWith(`#${ordinalInline}`)) ordinalInline += 1
        usos.push({
          arquivo,
          linha: modulo.fonte.getLineAndCharacterOfPosition(chaveExpr.getStart()).line + 1,
          chave: canonica ?? chaveExpr.getText(),
          resolvida: canonica !== null,
          fonte,
        })
      }
    }
    ts.forEachChild(no, visitar)
  }

  visitar(modulo.fonte)
  return usos
}

/** Todos os objetos de opções de query de um arquivo. */
export function usosDeQueryDoArquivo(arquivo: string, sistema: Sistema): UsoDeQuery[] {
  return usosComCache(arquivo, sistema, criarCacheDeModulos(sistema))
}

/** Os arquivos TypeScript de um diretório — **sem exclusão por padrão de nome**. */
export function arquivosDeCodigo(diretorio: string, sistema: Sistema): string[] {
  return sistema
    .listar(diretorio)
    .filter((arquivo) => arquivo.endsWith('.ts') || arquivo.endsWith('.tsx'))
    .filter((arquivo) => !arquivo.endsWith('.d.ts'))
    .sort()
}

/** O inventário completo de queries de um diretório, derivado da AST. */
export function inventarioDeQueries(diretorio: string, sistema: Sistema): UsoDeQuery[] {
  const carregar = criarCacheDeModulos(sistema)
  return arquivosDeCodigo(diretorio, sistema).flatMap((arquivo) =>
    usosComCache(arquivo, sistema, carregar),
  )
}

/**
 * Chaves com **mais de uma fonte distinta** — a mesma entrada de cache alimentada por duas
 * `queryFn`, que é o defeito `D-8`. Chaves não resolvidas ficam de fora **por não serem
 * comparáveis**, e por isso o teste as trava nominalmente à parte.
 */
export function colisoesDeChave(usos: readonly UsoDeQuery[]): ColisaoDeChave[] {
  const porChave = new Map<string, UsoDeQuery[]>()
  for (const uso of usos) {
    if (!uso.resolvida) continue
    const lista = porChave.get(uso.chave)
    if (lista === undefined) porChave.set(uso.chave, [uso])
    else lista.push(uso)
  }

  const colisoes: ColisaoDeChave[] = []
  for (const [chave, lista] of porChave) {
    const fontes = [...new Set(lista.map((uso) => uso.fonte))].sort()
    if (fontes.length < 2) continue
    colisoes.push({
      chave,
      fontes,
      ocorrencias: lista.map((uso) => ({
        arquivo: uso.arquivo,
        linha: uso.linha,
        fonte: uso.fonte,
      })),
    })
  }
  return colisoes.sort((a, b) => a.chave.localeCompare(b.chave))
}

/** Identidade estável de uma colisão, para travar nominalmente o que é pré-existente. */
export function descreverColisao(colisao: ColisaoDeChave): string {
  return `${colisao.chave} <- ${colisao.fontes.join(' | ')}`
}
