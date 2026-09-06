import type { CalendarOptionDto, SupportPlanDto } from '../types/supportPlan'

/**
 * 124/F1 — formatação dos campos de plano para exibição.
 *
 * ⚠️ **Todo guard usa `== null`, nunca `=== undefined`** (AP-FRONTEND-028): estes campos
 * atravessam a rede, e `null` e ausência são o mesmo fato para quem consome. Um guard por
 * `=== undefined` renderizaria `"null min"` na coluna de meta de SLA.
 *
 * ⚠️ Os textos abaixo **afirmam comportamento do sistema** (AP-FRONTEND-022) e por isso
 * carregam a âncora do contrato ao lado:
 * - `slaPrimeiroAtendimentoMinutos: null` ⇒ *"herda `calendarios.slapadraominutos`"*
 *   (`arquitetura.md` §3, `SupportPlanDto`);
 * - `calendarioId: null` ⇒ *"calendário padrão"* (idem);
 * - `slaIsento: true` ⇒ *"plano sem SLA de 1º atendimento"*, e o ticket **sai do
 *   denominador** (`arquitetura.md` §4 ponto 7, linha "Meta").
 */

/** Traço em vez de vazio — célula em branco é indistinguível de erro de render. */
export const SEM_VALOR = '—'

export function formatHorasMes(horasMes: number | null | undefined): string {
  if (horasMes == null) return SEM_VALOR
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(horasMes)} h`
}

/**
 * Preço da hora extra na moeda do plano. Moeda inválida (código fora do ISO 4217) faz o
 * `Intl` lançar — nesse caso caímos para "valor + código", que continua legível.
 */
export function formatPrecoHoraExtra(valor: number | null | undefined, moeda: string): string {
  if (valor == null) return SEM_VALOR
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda }).format(valor)
  } catch {
    return `${new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(valor)} ${moeda}`
  }
}

/**
 * Meta de SLA de 1º atendimento — **três estados**, não dois
 * (`arquitetura.md` §4 ponto 7: por isso `slaIsento` é coluna separada de um `int?`):
 * isento · herda o padrão do calendário · valor próprio em minutos.
 */
export function formatSlaMeta(plan: Pick<SupportPlanDto, 'slaIsento' | 'slaPrimeiroAtendimentoMinutos'>): string {
  if (plan.slaIsento) return 'Isento'
  if (plan.slaPrimeiroAtendimentoMinutos == null) return 'Padrão do calendário'
  const minutos = plan.slaPrimeiroAtendimentoMinutos
  return `${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
}

/**
 * Nome do calendário do plano. `calendarioId == null` ⇒ "Calendário padrão".
 *
 * Id que não está na lista **não vira branco**: o cadastro de calendários é da unidade
 * BE-F2F3/FE-F2F3 e pode ainda não responder. Mostrar `#id` diz a verdade ("há um
 * calendário vinculado, não sei o nome") em vez de mentir "é o padrão".
 */
export function formatCalendario(
  calendarioId: number | null | undefined,
  calendarios: readonly CalendarOptionDto[],
): string {
  if (calendarioId == null) return 'Calendário padrão'
  const encontrado = calendarios.find((c) => c.id === calendarioId)
  return encontrado?.nome ?? `#${calendarioId}`
}

/** Identificador estável do HubSpot; vazio é um estado real e precisa aparecer como tal. */
export function formatHubspotValor(valor: string | null | undefined): string {
  const texto = valor?.trim()
  return texto != null && texto.length > 0 ? texto : SEM_VALOR
}

/**
 * `true` quando renomear o plano quebraria o vínculo dos clientes (R-1): sem
 * identificador do HubSpot **e** com clientes vinculados. É o mesmo predicado da guarda
 * do backend — usado na tabela para marcar a linha antes de o usuário clicar em editar.
 */
export function temVinculoFragil(
  plan: Pick<SupportPlanDto, 'hubspotValor' | 'clientesVinculados'>,
): boolean {
  const semIdentificador = (plan.hubspotValor?.trim().length ?? 0) === 0
  return semIdentificador && plan.clientesVinculados > 0
}
