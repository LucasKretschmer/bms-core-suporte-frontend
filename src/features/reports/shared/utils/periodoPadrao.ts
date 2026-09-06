/**
 * 123/FE-PER (decisão D-2) — **período padrão do detalhe do parceiro: o mês atual.**
 *
 * ─── O defeito que este módulo existe para impedir ─────────────────────────────────────
 * Com o filtro de período VAZIO, a mesma tela mostrava DUAS janelas de tempo ao mesmo tempo:
 *
 *  · KPIs   → `GET /api/v1/metrics/plan-consumption`: `from`/`to` ausentes caem em
 *    `FusoSaoPaulo.Resolver` (`Suporte.Application/Common/FusoSaoPaulo.cs:149-162`), que
 *    devolve **do dia 1 ao último dia do mês corrente em America/Sao_Paulo**.
 *  · Tabela → `GET /api/v1/reports/tickets`: limite ausente significa **sem restrição
 *    nenhuma** — está escrito na fonte, e é deliberado:
 *    `ReportService.ResolveJanelaOpcional` (`Services/Reports/ReportService.cs:740-767`)
 *    documenta *"aqui limite ausente significa sem filtro — nunca 'mês corrente': estes
 *    endpoints são de range aberto e defaultá-los para o mês corrente esconderia dados que
 *    hoje aparecem"*.
 *
 * Cartões falando do mês atual, tabela falando do histórico inteiro, lado a lado, sem aviso.
 *
 * ─── Por que o default mora AQUI (no painel) e não no backend ──────────────────────────
 *  1. `/reports/tickets` serve **quatro** telas (o próprio XML-doc acima as lista). Mudar o
 *     default lá recortaria telas que não pediram nada — e a fonte diz, por escrito, que isso
 *     esconderia dado que hoje aparece.
 *  2. Com o valor resolvido no painel ele **viaja no wire**, então o default do backend nunca
 *     é alcançado: existe **uma** janela, decidida em **um** lugar. Dois defaults diferentes
 *     nas duas metades da tela é exatamente o defeito de origem.
 *  3. Só quem tem o valor consegue **dizer na tela** qual período está mostrando. Default
 *     invisível foi o que fez o usuário concluir que a tela estava errada.
 *
 * ─── De onde vêm as duas datas (123/FE-FIX3, ressalva `F-3`) ───────────────────────────
 * Este módulo **não calcula** o mês atual: ele delega a `defaultCurrentMonthFullPeriod`, de
 * `./defaultPeriod.ts`, que já era o dono do conceito "mês corrente inteiro" e serve o
 * Relatório do Cliente (068). A primeira versão da 123/FE-PER recalculava as mesmas duas
 * datas aqui, com a mesma `date-fns` e o mesmo `format(…, 'yyyy-MM-dd')` — duas fontes de
 * verdade para o mesmo fato, na mesma pasta (`rules/security.md`: "duas fontes de verdade
 * sobre o mesmo conjunto, mantidas à mão, divergem; a única questão é quando").
 * A equivalência foi medida antes de consolidar, sobre 12.054 instantes (todo dia civil de
 * 2020 a 2030 × 00:00, 12:00 e 23:59:59.999): **zero divergências**, inclusive nas viradas
 * de mês, em fevereiro bissexto e no último instante do ano.
 *
 * O que ESTE módulo acrescenta e o `defaultPeriod.ts` não tem é `resolverPeriodoPadrao`:
 * fechar **cada ponta separadamente** quando só uma está em branco.
 *
 * ─── Equivalência com o default do backend (é intencional, não coincidência) ────────────
 * `defaultCurrentMonthFullPeriod` reproduz `FusoSaoPaulo.Resolver`: dia 1 e
 * último dia do mês, **como dia civil**. As duas rotas convertem o dia civil da mesma forma
 * (`ParaUtc(from, inicioDoDia: true)` / `ParaUtc(to, inicioDoDia: false)`), com `to`
 * INCLUSIVO — logo o resultado dos KPIs é idêntico ao de antes quando o filtro está vazio, e
 * é a tabela que passa a acompanhar.
 *
 * ⚠️ Limite conhecido e aceito: o mês é o do relógio do NAVEGADOR; o do backend é o de
 * America/Sao_Paulo. Para quem usa o sistema no Brasil é o mesmo mês. Fora dele, na virada do
 * mês, pode haver um dia de diferença — e agora ela é **visível**, porque a tela imprime as
 * duas datas (era invisível quando o default vinha calado do backend).
 */

import { defaultCurrentMonthFullPeriod } from './defaultPeriod'

/** Período como as telas o carregam: `YYYY-MM-DD` ou `null` (campo em branco). */
export type PeriodoFiltro = {
  from: string | null
  to: string | null
}

/** Período já resolvido — as duas pontas preenchidas, prontas para ir ao wire. */
export type PeriodoResolvido = {
  from: string
  to: string
}

/**
 * Fecha as pontas em branco no mês atual — **dono único** da regra de default do período.
 *
 * Cada ponta é resolvida separadamente, igual ao `FusoSaoPaulo.Resolver`: preencher só o
 * início não abre o fim, e vice-versa. Datas informadas passam intactas.
 *
 * Todo consumidor do período (KPIs, tabela e export do detalhe do parceiro) chama ESTA
 * função — duas cópias da regra divergiriam na primeira mudança, que é a forma como as duas
 * janelas nasceram.
 */
export function resolverPeriodoPadrao(
  { from, to }: PeriodoFiltro,
  agora: Date = new Date(),
): PeriodoResolvido {
  // Uma chamada só: as duas pontas do default saem do MESMO instante de referência.
  // Duas chamadas separadas poderiam cair em meses diferentes na virada da meia-noite.
  const mesAtual = defaultCurrentMonthFullPeriod(agora)
  return {
    from: from ?? mesAtual.from,
    to: to ?? mesAtual.to,
  }
}
