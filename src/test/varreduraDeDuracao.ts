/**
 * 134/§9.4 (U12) — varredura DERIVADA das declarações de coluna de duração em `src/`.
 *
 * Não é `.test.ts`: é utilitário do inventário global. Existe separado de `duracaoExport.ts`
 * porque importa o compilador do TypeScript e `node:fs` — e `duracaoExport.ts` é importado
 * por ~20 testes de superfície que rodam sob jsdom e não devem pagar esse custo.
 *
 * **Por que AST e não substring** (`rules/security.md` § invariante): `"type: 'duration'" in
 * fonte` não distingue código de comentário, docstring, string literal e nome de teste — e o
 * falso positivo aparece justamente quando alguém **documenta** a regra, que é o que os
 * cabeçalhos desta demanda fazem o tempo todo.
 *
 * **O que conta como declaração de duração** — dois discriminadores, ambos derivados da
 * forma real que a produção usa:
 *  1. `ExportColumn` com `type: 'duration'` (aceita `as const`) — o caminho do `exportTable`;
 *  2. `ColumnDef` com `durationSeconds` — o caminho do drill, projetado para `ExportColumn`
 *     por `buildDrillExportColumns` (`MetricDrillModal.tsx`).
 * Em ambos, a CHAVE registrada é o `key: '<literal>'` do MESMO objeto. Objeto que declara
 * duração sem `key` literal **não é ignorado em silêncio**: sai em `semChaveLiteral`, para
 * decisão nominal de quem escreve a asserção.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import ts from 'typescript'

export type ResultadoDaVarredura = {
  /** Caminho relativo a `src/` (sempre com `/`) → chaves de duração, em ordem de declaração. */
  porArquivo: Record<string, string[]>
  /** Arquivos com declaração de duração cujo objeto NÃO tem `key` literal. */
  semChaveLiteral: string[]
  /** Quantos arquivos de produção foram lidos — controle de liveness da varredura. */
  arquivosVarridos: number
}

/**
 * Arquivos `*.test.ts(x)` ficam de fora, com motivo escrito: eles **fabricam** declarações de
 * coluna (fixtures e controles positivos deste próprio inventário), então contá-los faria a
 * varredura medir os testes, não o produto. A exclusão é segura porque o que se afirma sobre
 * o resultado é a **identidade** do mapa: nenhuma superfície de produção pode se esconder
 * atrás dela — a menos que alguém batize um arquivo de produção de `*.test.tsx`.
 */
function ehArquivoDeTeste(caminhoRelativo: string): boolean {
  return /\.test\.tsx?$/.test(caminhoRelativo)
}

function listarFontes(raiz: string, atual = raiz, acc: string[] = []): string[] {
  for (const nome of readdirSync(atual)) {
    const completo = join(atual, nome)
    if (statSync(completo).isDirectory()) {
      listarFontes(raiz, completo, acc)
      continue
    }
    if (!/\.tsx?$/.test(nome)) continue
    const rel = relative(raiz, completo).split(sep).join('/')
    if (ehArquivoDeTeste(rel)) continue
    acc.push(rel)
  }
  return acc
}

/** Desembrulha `'duration' as const` / `('duration')` até o literal. */
function literalDeTexto(no: ts.Expression | undefined): string | null {
  let atual = no
  while (atual && (ts.isAsExpression(atual) || ts.isParenthesizedExpression(atual))) {
    atual = atual.expression
  }
  return atual && ts.isStringLiteral(atual) ? atual.text : null
}

function nomeDaPropriedade(p: ts.ObjectLiteralElementLike): string | null {
  if (!ts.isPropertyAssignment(p) && !ts.isMethodDeclaration(p) && !ts.isShorthandPropertyAssignment(p)) {
    return null
  }
  const nome = p.name
  if (!nome) return null
  if (ts.isIdentifier(nome) || ts.isStringLiteral(nome)) return nome.text
  return null
}

function declaraDuracao(obj: ts.ObjectLiteralExpression): boolean {
  return obj.properties.some((p) => {
    const nome = nomeDaPropriedade(p)
    if (nome === 'durationSeconds') return true
    if (nome !== 'type') return false
    return ts.isPropertyAssignment(p) && literalDeTexto(p.initializer) === 'duration'
  })
}

function chaveLiteralDoObjeto(obj: ts.ObjectLiteralExpression): string | null {
  for (const p of obj.properties) {
    if (nomeDaPropriedade(p) !== 'key') continue
    if (!ts.isPropertyAssignment(p)) continue
    const valor = literalDeTexto(p.initializer)
    if (valor) return valor
  }
  return null
}

/**
 * Varre `raizSrc` e devolve o mapa `arquivo → chaves de duração`.
 * Parametrizado pela raiz de propósito: é isso que permite provar o poder de detecção do
 * detector com fontes FABRICADAS, sem mutar a árvore de produção (`rules/tests.md`).
 */
export function mapearChavesDeDuracaoNaFonte(raizSrc: string): ResultadoDaVarredura {
  const porArquivo: Record<string, string[]> = {}
  const semChaveLiteral: string[] = []
  const fontes = listarFontes(raizSrc)

  for (const rel of fontes) {
    const fonte = readFileSync(join(raizSrc, rel), 'utf8')
    const arvore = ts.createSourceFile(rel, fonte, ts.ScriptTarget.Latest, true)

    const visitar = (no: ts.Node): void => {
      if (ts.isObjectLiteralExpression(no) && declaraDuracao(no)) {
        const chave = chaveLiteralDoObjeto(no)
        if (chave) {
          ;(porArquivo[rel] ??= []).push(chave)
        } else if (!semChaveLiteral.includes(rel)) {
          semChaveLiteral.push(rel)
        }
      }
      ts.forEachChild(no, visitar)
    }
    ts.forEachChild(arvore, visitar)
  }

  return { porArquivo, semChaveLiteral: semChaveLiteral.sort(), arquivosVarridos: fontes.length }
}
