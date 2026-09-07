import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { derivarCascataDeCssDoApp, lerTokensDeCor } from '../utils/cssCascade'
import {
  medirTextosComHeranca,
  padroesDoBody,
  temaDaCascata,
  type VarreduraDeContraste,
} from '../utils/contrasteDeTexto'
import {
  anelDeFocoDoCss,
  medirAnelDeFoco,
  type VarreduraDoAnel,
} from '../utils/contrasteDoAnelDeFoco'

/**
 * 125/FE-A11Y-2 — cola entre o CSS real do app e os testes de tela.
 *
 * Carrega **uma vez** o tema (tokens `--color-*`, nomes `--text-*`, utilitários de
 * `background-image` e os padrões do `body`) a partir da cascata real de CSS, derivada do
 * `index.html`. Nenhum hex é digitado em teste nenhum: quem decide a cor é o CSS que a app
 * publica.
 *
 * ⚠️ **Este arquivo não contém lógica de medição.** Ele lê o disco e delega — o medidor é
 * `src/utils/contrasteDeTexto.ts`, um só (consolidação de 125/FE-A11Y-4, `Q-2`). Toda
 * função de consulta sobre o resultado (`razaoDoTexto`, `classesDoTexto`, `fundoDoTexto`,
 * `reprovacoesAA`, `reprovacoesDasFrases`, `classesForeground`) mora lá e é reexportada
 * aqui só para não quebrar os call sites que já importam deste caminho.
 */

const lerDoDisco = (caminho: string): string => readFileSync(resolve(process.cwd(), caminho), 'utf8')

const CASCATA_CSS = derivarCascataDeCssDoApp(lerDoDisco)

/** Tokens `--color-*` da cascata, na ordem de precedência. */
export const TOKENS = lerTokensDeCor(CASCATA_CSS, lerDoDisco)

/** Tema (cores, nomes de tamanho de fonte e fundos em imagem) da cascata real. */
export const TEMA = temaDaCascata(CASCATA_CSS, lerDoDisco, TOKENS)

/**
 * O CSS da cascata inteira, concatenado. Exposto (125/FE-A11Y-3) para que um teste possa
 * derivar do CSS REAL o que não é um token `--color-*` — o caso concreto é `--grad-escuro`,
 * o gradiente de fundo da sidebar.
 */
export const CSS_DA_CASCATA = CASCATA_CSS.map(lerDoDisco).join('\n')

/** Cor e fundo padrão do texto, lidos da regra `body` do CSS. */
export const PADROES = padroesDoBody(CSS_DA_CASCATA, TOKENS)

/** Varre a árvore renderizada e devolve as medições + o que não soube medir. */
export function varrer(raiz: Element): VarreduraDeContraste {
  return medirTextosComHeranca(raiz, { tema: TEMA, padroes: PADROES })
}

/**
 * 126/FE-FOCO — o anel de `:focus-visible` **derivado da regra real** do CSS do app.
 *
 * Nenhum teste digita a cor, a espessura ou o deslocamento do anel: se a regra mudar (ou
 * sumir, ou virar `outline: none`), é este valor que muda, e são os invariantes que
 * reprovam. `anelDeFocoDoCss` **lança** no que não modela — inclusive em duas regras
 * `:focus-visible` na cascata, onde o vencedor dependeria de camada e especificidade.
 */
export const ANEL = anelDeFocoDoCss(CSS_DA_CASCATA, TOKENS)

/** Mede o anel de foco de todo focável da árvore, contra o fundo que está atrás dele. */
export function varrerAnel(raiz: HTMLElement): VarreduraDoAnel {
  return medirAnelDeFoco(raiz, { tema: TEMA, padroes: PADROES, anel: ANEL })
}

export {
  PISO_NAO_TEXTUAL,
  camadasSaoContiguas,
  espessuraTotalPx,
  fundosDoAlvo,
  razaoDoAlvo,
  razaoEntreCamadas,
  razaoMinimaSobreQualquerFundo,
  reprovacoesDoAnel,
  type AnelDeFoco,
  type MedidaDoAnel,
  type VarreduraDoAnel,
} from '../utils/contrasteDoAnelDeFoco'

export {
  CLASSE_DO_BODY,
  PISO_AA,
  classesDoTexto,
  classesForeground,
  comAlfa,
  fundoDoTexto,
  razaoDaClasse,
  razaoDoTexto,
  reprovacoesAA,
  reprovacoesDasFrases,
  type MedidaHerdada,
  type VarreduraDeContraste,
} from '../utils/contrasteDeTexto'
