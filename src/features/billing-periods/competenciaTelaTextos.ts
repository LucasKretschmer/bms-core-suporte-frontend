/**
 * 132/F7 — os textos da tela de Competências, **com a âncora da regra ao lado de cada um**
 * (`AP-FRONTEND-022`: texto de UI que afirma comportamento do sistema é código, não copy).
 *
 * 🔴 A afirmação que NENHUM texto desta tela pode fazer: que o sistema corrigiu, ajustou
 * ou vai corrigir algum crédito sozinho. **Ele não corrige** (C-8): refechar **revalida e
 * REPORTA** — o crédito divergente sai marcado e quem decide é a gerente. Isso não é
 * disciplina de redação: é o detector `afirmaCorrecaoAutomatica` abaixo, com teste.
 */

// ── Cabeçalho da tela ──────────────────────────────────────────────────────────────────

export const TITULO_DA_TELA = 'Competências'

/** D12 · D17 — o que a tela é. */
export const DESCRICAO_DA_TELA =
  'Cada competência é um mês de faturamento. Ao fechar, os números do mês são congelados num snapshot — é ele que as telas passam a exibir para o mês fechado.'

// ── Estados ────────────────────────────────────────────────────────────────────────────

/**
 * C-6 — competência anterior ao início do congelamento. Não houve backfill: ela não tem
 * snapshot, aparece ao vivo e não pode ser fechada retroativamente.
 */
export const AVISO_HISTORICA =
  'Competência anterior ao início do congelamento: não existe snapshot dela. Os números aparecem ao vivo, recalculados pela regra de hoje, que pode não ser a que gerou a fatura da época.'

/**
 * Fail-closed do vocabulário de estado (`AP-API-002`). Diz que não sabe — não inventa
 * estado nem oferece ação.
 */
export const AVISO_ESTADO_DESCONHECIDO =
  'Esta versão do painel não reconhece o estado desta competência. Recarregue a página; enquanto isso, nenhuma ação é oferecida sobre ela.'

// ── Fechamento ─────────────────────────────────────────────────────────────────────────

export const TITULO_FECHAR = 'Fechar competência'

/** §6.2/§6.3 — o fechamento é uma transação única por competência, e é auditado (D17). */
export const CONFIRMACAO_FECHAR =
  'Fechar congela os números de todos os clientes desta competência num snapshot. A partir daí as telas do mês passam a exibir o que foi faturado, e não o cálculo do momento.'

/** §6.5 — refechar cria uma versão nova; as linhas antigas ficam como prova. */
export const CONFIRMACAO_REFECHAR =
  'Refechar grava uma nova versão do snapshot desta competência. As versões anteriores continuam guardadas. Os créditos gerados por ela são revalidados e apenas reportados — nenhum valor é alterado por esta ação.'

// ── Reabertura (C-8) ───────────────────────────────────────────────────────────────────

export const TITULO_REABRIR = 'Reabrir competência'

/**
 * 🔴 C-8, a frase central da tela. Reabrir **nunca** altera crédito; refechar revalida e
 * **reporta**. A frase não promete correção nenhuma porque não há correção nenhuma.
 */
export const IMPACTO_REABERTURA =
  'Reabrir não altera nenhum crédito já concedido: os valores permanecem exatamente como estão. Ao refechar, os créditos gerados por esta competência são recalculados e comparados — os divergentes aparecem marcados na tela de Créditos, para você decidir o que fazer com cada um.'

/** Enquanto reaberta, o gate D13 fica fechado: nenhum crédito novo nasce dela. */
export const IMPACTO_REABERTURA_CREDITOS_NOVOS =
  'Enquanto estiver reaberta, esta competência não gera crédito automático novo.'

/** O rótulo do checkbox — é ele que alimenta `confirmarImpactoEmCreditos`. */
export const CONFIRMAR_IMPACTO_LABEL =
  'Li o impacto acima e confirmo a reabertura desta competência.'

export const MOTIVO_LABEL = 'Motivo da reabertura'
export const MOTIVO_PLACEHOLDER = 'Descreva por que esta competência está sendo reaberta'

/**
 * Frase exibida quando o painel **não** sabe quantos créditos dependem da competência —
 * que é o caso enquanto o contrato não trouxer a contagem. Ela não afirma "nenhum": afirma
 * que não sabe (`AP-FRONTEND-028`, o guard de ausência aplicado a texto).
 */
export const CREDITOS_DEPENDENTES_DESCONHECIDO =
  'Esta tela não sabe quantos créditos dependem desta competência. Se houver algum, o servidor informa a quantidade ao recusar a reabertura sem confirmação.'

/** Com contagem conhecida — o número vem do servidor, nunca digitado. */
export function creditosDependentesTexto(quantidade: number): string {
  return quantidade === 1
    ? '1 crédito vivo foi gerado por esta competência.'
    : `${quantidade} créditos vivos foram gerados por esta competência.`
}

// ── Comparação de auditoria (D12 · §8.2) ───────────────────────────────────────────────

export const TITULO_COMPARACAO = 'Snapshot × cálculo atual'

export const DESCRICAO_COMPARACAO =
  'À esquerda, o que foi faturado (snapshot da versão vigente). À direita, o que a regra de hoje calcula sobre os apontamentos de hoje. Uma divergência aqui é informação para você decidir — nada é alterado por esta tela.'

export const COMPARACAO_SEM_DIVERGENCIA = 'Sem divergência entre o snapshot e o cálculo atual.'

export const COMPARACAO_VAZIA =
  'Nenhum cliente para comparar nesta competência com os filtros atuais.'

/** Rótulo dos campos comparados — camelCase do servidor → português. */
export const ROTULO_DO_CAMPO: Record<string, string> = {
  planoBaseHoras: 'Plano base',
  creditoHoras: 'Crédito',
  planoEfetivoHoras: 'Plano efetivo',
  horasUsadas: 'Horas usadas',
  horasRestantes: 'Horas restantes',
  horasAdicionais: 'Horas adicionais',
  percentualPlano: '% do plano',
  horasFaturaveis: 'Horas faturáveis',
  horasAnalise: 'Horas em análise',
}

// ── O detector ─────────────────────────────────────────────────────────────────────────

const VERBO_DE_CORRECAO = /(corrig|ajust|atualiz|estorn|recalcul)\w*\s+(?:automaticamente|sozinh[oa]s?)/i
const NEGACAO = /\b(n[ãa]o|nunca|nenhum\w*|jamais|sem)\b/i

/**
 * Uma frase **afirma** correção automática quando fala em corrigir/ajustar/estornar
 * automaticamente **sem negação na mesma sentença**.
 *
 * Por que a negação entra na regra: os textos corretos desta tela precisam justamente
 * dizer *"nenhum valor é alterado"* e *"o sistema não corrige nada sozinho"*. Um detector
 * que proibisse o radical `corrig` reprovaria exatamente o texto que cumpre C-8 — o
 * caminho "natural" seria então reescrever o texto para agradar ao teste, e a trava
 * passaria a governar a redação em vez do defeito (`rules/tests.md` § Prova de detecção:
 * detector mais PRECISO, nunca mais frouxo, com controle positivo ao lado).
 */
export function afirmaCorrecaoAutomatica(texto: string): boolean {
  return texto
    .split(/(?<=[.!?])\s+/)
    .some((sentenca) => VERBO_DE_CORRECAO.test(sentenca) && !NEGACAO.test(sentenca))
}
