/**
 * 132/F4 (D11 · D15) — textos do **crédito de horas** nas superfícies de fatura.
 *
 * Módulo próprio pelo mesmo motivo de `competenciaTexts.ts`: **texto de UI que afirma
 * comportamento do sistema é código, não copy** (AP-FRONTEND-022). "horas somadas ao plano só
 * nesta competência" e "não acumulam" são asserções verificáveis sobre a regra — centralizadas,
 * são testáveis e mudam junto com ela.
 *
 * ─── 🔴 D15 — POR QUE O RÓTULO PÚBLICO É UMA CONSTANTE LOCAL ────────────────────────────────
 *
 * O motivo interno do crédito automático cita a categoria do HubSpot `"Problema - Invoicy"`
 * (132/D9), e essa string **não pode aparecer em nenhuma superfície que chegue ao cliente**
 * (AP-SECURITY-001; a decisão do usuário está em `prd.md` §3.7 / D15). O backend já projeta a
 * constante pública no wire (`CreditoRotulos.Publico` →
 * `ReportQueryRepository.cs:990-996`, campo `PlanConsumptionCreditoDto.Rotulo`), mas a tela
 * **não depende disso**: ela renderiza `ROTULO_CREDITO_PUBLICO`, daqui.
 *
 * É garantia **estrutural**, não disciplina: se o backend regredir e mandar
 * `"Estorno de Credito Problema - Invoicy"` em `rotulo`, a tela continua exibindo
 * "Crédito de Suporte". O teste de wire envenenado (`PlanoComCredito.test.tsx`) prova as duas
 * metades — a negativa (a string proibida não está no DOM) e a positiva (o rótulo público está).
 *
 * ─── Ancoragem de cada afirmação (lida no código em 2026-09-09, não presumida) ───────────────
 *
 *  1. "só nesta competência" — `creditoshoras.competencia` é `date NOT NULL` e é a **única**
 *     competência de vigência (D8 revisada; `modelo-dados.md`, tabela `creditoshoras`). O
 *     backend soma exatamente os créditos com `competencia == C`, `estornadoem IS NULL` e
 *     `desativadoem IS NULL` (`ReportQueryRepository.cs:969-999` +
 *     `CreditosVigentesDaCompetencia`).
 *  2. "não acumulam" — PRD §3.8 ("Não usou, perdeu") e o `perdido = crédito.horas − consumido`
 *     da calculadora de consumo. **Nunca** escrever "expira em X dias" nem "vale por um mês":
 *     seria prazo digitado, que é o defeito de AP-FRONTEND-022.
 *
 * ⚠️ **Nenhum número, prazo ou periodicidade é digitado aqui.** O `2h` que o usuário lê vem do
 * dado, formatado pelo call site.
 */

/**
 * O único rótulo de crédito que a tela do cliente exibe (D15).
 *
 * ⛔ Não trocar por interpolação do wire, nem acrescentar o motivo interno "entre parênteses".
 * O motivo completo existe **só** na tela de gerência de créditos (`features/hour-credits`).
 */
export const ROTULO_CREDITO_PUBLICO = 'Crédito de Suporte'

/**
 * Tooltip do ⓘ ao lado do `+2h` na coluna "Qtde. Plano (h)".
 *
 * ⚠️ Curto de propósito: o balão do `InfoIcon` é `whitespace-nowrap`
 * (`components/ui/InfoIcon.tsx:141`) e não quebra linha — um texto longo sai numa única linha e
 * estoura a viewport na horizontal (o clamp de `:66-69` reposiciona, não quebra). `InfoIcon` é
 * primitivo compartilhado por 16 arquivos e tem trava de contraste própria: **o texto se adapta
 * ao primitivo, não o contrário.**
 */
export const TOOLTIP_CREDITO_PLANO = `${ROTULO_CREDITO_PUBLICO}: horas somadas ao plano só nesta competência — não acumulam.`

/**
 * O `+ 2h` que aparece na célula. `aria-hidden` no DOM: quem lê por leitor de tela recebe
 * `srCreditoSufixo`, que diz a mesma coisa por extenso (o canal visual e o acessível dizem o
 * mesmo, cada um na sua língua — ler os dois duplicaria o valor em voz alta).
 */
export function textoCreditoVisivel(horasFormatadas: string): string {
  return `+ ${horasFormatadas}`
}

/**
 * O texto `sr-only` que nomeia o crédito por extenso — é ele que faz o `+` **não** depender de
 * cor (WCAG 1.4.1) nem de glifo para significar algo.
 */
export function srCreditoSufixo(horasFormatadas: string): string {
  return `mais ${horasFormatadas} de ${ROTULO_CREDITO_PUBLICO}`
}

// ── Export (CSV/Excel) — o 4º lugar de AP-FRONTEND-028 ──────────────────────────────────────
//
// Os cabeçalhos vivem aqui, e não inline no array de colunas do export, porque planilha é o
// artefato que o gestor ENCAMINHA: uma coluna renomeada em um lugar e não no outro produz duas
// planilhas incomparáveis do mesmo relatório. Ver `plan-consumption/index.tsx`.

/** Coluna de export: o crédito da competência, isolado do plano base. */
export const HEADER_EXPORT_CREDITO = 'Crédito (h)'

/**
 * Coluna de export: `base + crédito`.
 *
 * ⚠️ Existe como coluna PRÓPRIA em vez de somar dentro de "Qtde. Plano (h)": somar em silêncio
 * faria a planilha de um mês com crédito divergir da de um mês sem crédito **sem nenhum sinal
 * no arquivo**. Com as três colunas lado a lado, a planilha explica a si mesma.
 */
export const HEADER_EXPORT_PLANO_EFETIVO = 'Plano Efetivo (h)'
