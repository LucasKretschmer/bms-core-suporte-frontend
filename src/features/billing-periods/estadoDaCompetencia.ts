/**
 * 132/F7 — o vocabulário de **estado da competência**, que é do SERVIDOR.
 *
 * 🔴 `AP-API-002` — a enumeração nasce aqui **em uma única lista nominal**, derivada do
 * contrato real do backend, e nunca é redigitada como união literal em outro arquivo:
 *
 * - `Suporte.Domain/Enums/EstadoCompetenciaValor.cs` — o enum de 7 valores
 *   (`Historica`, `Corrente`, `Futura`, `Aberta`, `Fechada`, `Reaberta`, `Refechada`);
 * - `analise-backend.md` §7.4 — a forma no wire: `"historica"|"corrente"|"futura"|
 *   "aberta"|"fechada"|"reaberta"|"refechada"` (minúsculas).
 *
 * 🔴 **P-6 (`decisoes-ratificadas.md` §5) — RATIFICADO pelo Manager:** são **SETE**
 * estados, não seis. A `arquitetura.md` §5.1 tem seis LINHAS porque funde
 * `Corrente / Futura` numa só; fundir `Futura` quebraria o contrato de wire e a regra
 * de exibição. Esta lista é o conjunto ratificado, na ordem do enum.
 */

/** O conjunto, na ordem do enum do backend. Identidade travada em teste. */
export const ESTADOS_DA_COMPETENCIA = [
  'historica',
  'corrente',
  'futura',
  'aberta',
  'fechada',
  'reaberta',
  'refechada',
] as const

export type EstadoDaCompetencia = (typeof ESTADOS_DA_COMPETENCIA)[number]

/**
 * O que o painel usa. `'desconhecido'` **não é estado do servidor**: é o resultado
 * fail-closed de não saber — backend antigo que não manda o campo, valor novo que esta
 * versão do painel não conhece, ou lixo.
 */
export type EstadoNormalizado = EstadoDaCompetencia | 'desconhecido'

const CONJUNTO: ReadonlySet<string> = new Set<string>(ESTADOS_DA_COMPETENCIA)

/**
 * Normaliza o `estado` do wire — **fail-closed**.
 *
 * - `null`/ausente ⇒ `'desconhecido'`. 🔴 `AP-FRONTEND-028`: o guard é `== null`, nunca
 *   `=== undefined` — quem serializa do outro lado decide entre omitir a chave e mandar
 *   `null`, e para quem consome os dois são o mesmo fato. Testado com `null` explícito.
 * - valor conhecido (comparação **case-insensitive**, com `trim`) ⇒ o valor minúsculo.
 *   A tolerância de caixa cobre um `JsonStringEnumConverter` que serialize `"Historica"`
 *   — é o MESMO token, não uma inferência sobre um valor diferente.
 * - qualquer outra coisa ⇒ `'desconhecido'`.
 *
 * Fail-closed aqui significa `'desconhecido'`, **nunca** um estado real: tratar
 * desconhecido como `'fechada'` afirmaria que os números são os faturados; como
 * `'aberta'` ofereceria um botão de fechar sobre um mês cujo estado não se conhece.
 * `'desconhecido'` não oferece ação nenhuma e diz que não sabe.
 */
export function normalizarEstado(bruto: unknown): EstadoNormalizado {
  if (bruto == null) return 'desconhecido'
  if (typeof bruto !== 'string') return 'desconhecido'
  const candidato = bruto.trim().toLowerCase()
  if (CONJUNTO.has(candidato)) return candidato as EstadoDaCompetencia
  if (import.meta.env.DEV && candidato.length > 0) {
    // Sem dado de usuário — só o token do enum que o painel não conhece.
    console.error(`[billing-periods] estado de competência não reconhecido: "${candidato}"`)
  }
  return 'desconhecido'
}

/**
 * Rótulo exibido. Cada frase é verdadeira **para aquele estado**, nunca para uma família
 * (`AP-API-002`, 2ª metade): não existe rótulo "ao vivo" genérico aqui, porque ele teria de
 * continuar verdadeiro para todo membro futuro da família.
 */
export const ROTULO_DO_ESTADO: Record<EstadoNormalizado, string> = {
  historica: 'Histórica',
  corrente: 'Corrente',
  futura: 'Futura',
  aberta: 'Aberta',
  fechada: 'Fechada',
  reaberta: 'Reaberta',
  refechada: 'Refechada',
  desconhecido: 'Estado não reconhecido',
}

/**
 * De onde vêm os números que a tela de Consumo de Planos exibe para a competência (D12).
 * `'snapshot'` só nos dois estados em que existe snapshot vigente; `'desconhecido'` não
 * afirma nada.
 */
export type FonteDosNumeros = 'snapshot' | 'aovivo' | 'desconhecida'

export function fonteDosNumerosDoEstado(estado: EstadoNormalizado): FonteDosNumeros {
  switch (estado) {
    case 'fechada':
    case 'refechada':
      return 'snapshot'
    case 'historica':
    case 'corrente':
    case 'futura':
    case 'aberta':
    case 'reaberta':
      return 'aovivo'
    case 'desconhecido':
      return 'desconhecida'
  }
}

/** Ações da tela de Competências. */
export type AcaoDaCompetencia = 'fechar' | 'reabrir' | 'comparar'

/**
 * Por que a ação NÃO está disponível naquele estado — `null` quando está disponível.
 *
 * O motivo existe porque **ação indisponível continua alcançável e anunciada**
 * (`rules/frontend.md` § Acessibilidade de teclado; mesmo desenho do `ariaDisabled` do
 * `Switch`): desabilitar sem dizer por quê é o defeito clássico.
 *
 * Cada motivo cita a regra que o sustenta, e a regra é do servidor — o front só antecipa
 * a recusa para não gastar uma requisição que já se sabe que vai falhar.
 */
export function motivoIndisponivel(
  acao: AcaoDaCompetencia,
  estado: EstadoNormalizado,
): string | null {
  if (estado === 'desconhecido') {
    return 'Esta versão do painel não reconhece o estado desta competência. Recarregue a página; nenhuma ação é oferecida sobre um estado desconhecido.'
  }

  switch (acao) {
    case 'fechar':
      if (estado === 'aberta' || estado === 'reaberta') return null
      if (estado === 'corrente' || estado === 'futura') {
        // 422 COMPETENCIA_NAO_ENCERRADA (arquitetura §11.4).
        return 'Só é possível fechar uma competência já encerrada — esta ainda não terminou.'
      }
      if (estado === 'historica') {
        // C-6: sem backfill; competência anterior ao congelamento não fecha retroativamente.
        return 'Competência anterior ao início do congelamento: ela não tem snapshot e não pode ser fechada retroativamente.'
      }
      return 'Esta competência já está fechada.'
    case 'reabrir':
      if (estado === 'fechada' || estado === 'refechada') return null
      if (estado === 'historica') {
        return 'Competência anterior ao início do congelamento: nunca foi fechada, portanto não há o que reabrir.'
      }
      // 409 COMPETENCIA_JA_ABERTA (arquitetura §11.4).
      return 'Só uma competência fechada pode ser reaberta — esta já está em aberto.'
    case 'comparar':
      if (estado === 'fechada' || estado === 'refechada') return null
      if (estado === 'historica') {
        return 'Competência anterior ao início do congelamento: não existe snapshot dela para comparar.'
      }
      return 'A comparação exige um snapshot: ela só existe depois que a competência é fechada.'
  }
}
