/**
 * 132/F4 (D11 · D21) — **o plano EFETIVO na exibição**: `base + crédito`.
 *
 * ─── O que este arquivo NÃO faz, e é o ponto mais importante dele ────────────────────────────
 *
 * `horasRestantes`, `percentualPlano` e `horasAdicionais` **são do BACKEND**. O
 * `PlanConsumptionItemDto` já as entrega calculadas sobre o plano efetivo
 * (`ReportQueryRepository.cs:1006-1043` → `CalculadoraPlanoEfetivo`), e o front **não recalcula
 * nenhuma delas** — nem para conferir, nem para o export, nem para o PDF. Recalcular aqui seria
 * a segunda implementação que AP-ARQUITETURA-005 proíbe, e ela divergiria em silêncio no
 * primeiro arredondamento (o backend arredonda restantes/adicionais em 4 casas e o percentual em
 * 2, em pontos específicos do fluxo).
 *
 * O único cálculo do front é a **soma de exibição** `base + crédito`, porque é o que o usuário
 * lê na célula (`15h + 2h`, layout do usuário em `prd.md` §5.1).
 *
 * ─── 🔴 Por que NÃO se usa `qtdePlanoEfetivoHoras` como fonte do número ──────────────────────
 *
 * Aquele campo nasce com default `0m` no construtor posicional do C#
 * (`ReportsDtos.cs:283`). Contra um backend que ainda não o preencha, lê-lo cru imprimiria
 * **`0h` como plano efetivo numa tela de fatura**. Então ele é usado só para **DENUNCIAR**: se
 * vier presente e divergir de `base + crédito` além da tolerância, sai um `console.error` em DEV
 * nomeando o cliente, e a função **prossegue com `base + crédito`** — os dois átomos que o
 * usuário vê na célula.
 *
 * ─── Os três ramos de `creditoHoras`, e por que dois deles renderizam igual ──────────────────
 *
 * | valor                | `creditoConhecido` | `temCredito` | o que a tela faz              |
 * |----------------------|--------------------|--------------|-------------------------------|
 * | chave ausente / null | `false`            | `false`      | **exatamente como hoje**      |
 * | `0`                  | `true`             | `false`      | idem — regressão zero         |
 * | `> 0`                | `true`             | `true`       | `+Xh` + reforço textual + ⓘ   |
 *
 * Os dois primeiros produzem a mesma tela **de propósito**: "não sei" e "não há" são estados
 * distintos, mas a única afirmação verdadeira nos dois casos é a de hoje. O discriminador é
 * `creditoConhecido` (exposto no DOM como `data-credito-conhecido`), nunca o pixel — sem ele um
 * `?? 0` colapsaria os dois ramos e passaria em qualquer teste visual (AP-FRONTEND-028).
 */

import { formatHours } from './formatters'

/**
 * A entrada mínima — estrutural de propósito, para que `PlanConsumptionItemDto` (Consumo de
 * Planos) e o DTO do Relatório do Cliente (132/F9) usem a MESMA função sem que este módulo
 * dependa de nenhum dos dois tipos.
 */
export type EntradaDoPlanoEfetivo = {
  /** Só entra na mensagem de erro de divergência — nunca no cálculo. */
  clientId?: number | null
  /** Plano BASE: `Client.HorasOverride ?? SupportPlan.HorasMes` (D16). Sempre presente. */
  qtdePlanoHoras: number
  creditoHoras?: number | null
  qtdePlanoEfetivoHoras?: number | null
}

export type PlanoEfetivo = {
  /** `item.qtdePlanoHoras`, sem transformação. */
  baseHoras: number
  /** `0` quando ausente, `null`, não-finito ou negativo. */
  creditoHoras: number
  /** `baseHoras + creditoHoras`. É o número que a célula soma. */
  efetivoHoras: number
  /** `creditoHoras > 0` — **nunca** `!!creditoHoras`: `0` é valor, não ausência. */
  temCredito: boolean
  /** `false` = o backend não respondeu sobre crédito. Ver a tabela do topo. */
  creditoConhecido: boolean
}

/**
 * Tolerância da conferência contra `qtdePlanoEfetivoHoras`.
 * As parcelas são `numeric(10,4)` no banco, logo `1e-4` é a granularidade real do dado; abaixo
 * disso a diferença é ruído de serialização de `decimal` para JSON, não divergência.
 */
const TOLERANCIA_HORAS = 1e-4

export function derivarPlanoEfetivo(item: EntradaDoPlanoEfetivo): PlanoEfetivo {
  const baseHoras = item.qtdePlanoHoras
  const bruto = item.creditoHoras

  // Ordem dos ramos idêntica em espírito à do `durationCell` da 134: ausência primeiro,
  // sanidade depois, valor por último.
  //
  // 🔴 `== null` cobre chave ausente E `null` explícito. Com `=== undefined` o `null` do wire
  // cairia no ramo do valor e `null + 15` seria `15` — "não sei" viraria "não há", em silêncio.
  if (bruto == null) {
    return {
      baseHoras,
      creditoHoras: 0,
      efetivoHoras: baseHoras,
      temCredito: false,
      creditoConhecido: false,
    }
  }

  // `NaN`/`Infinity` só chegam aqui por wire corrompido. Tratá-los como 0 mantém a célula
  // legível; tratá-los como "conhecido" afirmaria que o backend respondeu um número.
  if (!Number.isFinite(bruto)) {
    return {
      baseHoras,
      creditoHoras: 0,
      efetivoHoras: baseHoras,
      temCredito: false,
      creditoConhecido: false,
    }
  }

  // Crédito negativo é dado impossível (o banco tem CHECK de `horas > 0`): o crédito **nunca**
  // é desconto. Aqui o backend RESPONDEU — logo `creditoConhecido: true` —, e o valor é
  // neutralizado em vez de encolher o plano que foi cobrado.
  const creditoHoras = bruto < 0 ? 0 : bruto
  const efetivoHoras = baseHoras + creditoHoras

  if (item.qtdePlanoEfetivoHoras != null && Number.isFinite(item.qtdePlanoEfetivoHoras)) {
    const divergencia = Math.abs(item.qtdePlanoEfetivoHoras - efetivoHoras)
    if (divergencia > TOLERANCIA_HORAS && import.meta.env.DEV) {
      // Só em DEV e sem dado pessoal: `clientId` é chave interna, não PII
      // (`rules/security.md` § Logs). Em produção a célula continua correta — o que se perde
      // é o aviso ao desenvolvedor, não a exibição.
      console.error(
        `[plano efetivo] divergência do wire no cliente ${item.clientId ?? '?'}: ` +
          `qtdePlanoEfetivoHoras=${item.qtdePlanoEfetivoHoras} × base+crédito=${efetivoHoras}. ` +
          'Exibindo base+crédito (os dois átomos que o usuário lê).',
      )
    }
  }

  return {
    baseHoras,
    creditoHoras,
    efetivoHoras,
    temCredito: creditoHoras > 0,
    creditoConhecido: true,
  }
}

/**
 * 🔴 **D21 — formato compacto, e SÓ na coluna "Qtde. Plano (h)".**
 *
 * O layout que o usuário escreveu à mão é `15h + 2h` (`prd.md` §5.1), e `formatHours(15)`
 * devolve `"15h 0m"` — o render literal seria `15h 0m + 2h 0m`. A decisão ratificada é omitir
 * os minutos **quando são zero**, nesta coluna e em mais nenhuma: o `% do Plano` mantém 1 casa
 * (`16,1%`) e **nenhum formatador global muda**.
 *
 * Mora aqui, e não em `formatters.ts`, exatamente para que a exceção não seja pescada por
 * engano por outra tela: quem importa deste módulo está falando da célula do plano efetivo.
 *
 * ⚠️ **Não reimplementa a aritmética de hora.** Delega a `formatHours` (fonte única do
 * arredondamento, `formatters.ts:32-35`) e só remove o sufixo ` 0m` do texto — se um dia
 * `formatHours` mudar de formato, aqui muda junto, em vez de divergir (AP-ARQUITETURA-005).
 */
export function formatHorasCompacto(horas: number): string {
  const completo = formatHours(horas)
  return completo.endsWith(' 0m') ? completo.slice(0, -' 0m'.length) : completo
}
