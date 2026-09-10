/**
 * 132/F9 (§9.5 · D15 · D16 · D20) — o **crédito de horas no Relatório do Cliente**, derivado
 * uma vez e consumido pelas DUAS superfícies desta tela: o cabeçalho
 * (`components/ClientReportHeader.tsx`) e o **PDF** que vai ao cliente
 * (`shared/utils/exportPdf.tsx`).
 *
 * ─── Por que existe um adaptador, e por que ele não recalcula nada ──────────────────────────
 *
 * A regra dos três ramos de `creditoHoras` (ausente/`null` → "não sei" · `0` → "não há" ·
 * `> 0` → "há") é escrita **uma vez**, em `shared/utils/planoEfetivo.ts`
 * (AP-ARQUITETURA-005). Este arquivo **não** a reimplementa: ele traduz o
 * `ClientReportDto` para a entrada estrutural daquela função e formata o texto. O que
 * justifica o arquivo é a tradução ser **não óbvia e comum às duas superfícies** — duas
 * cópias dela divergiriam entre a tela e o PDF, e o PDF é o artefato que sai do sistema.
 *
 * ─── 🔴 As DUAS armadilhas de unidade deste DTO ─────────────────────────────────────────────
 *
 *  1. **`creditoHoras` e `horasPlanoEfetivas` são HORAS; todo o resto do DTO é SEGUNDOS**
 *     (`ReportsDtos.cs:84-96` declara as duas unidades no mesmo objeto, de propósito).
 *     `formatSeconds(2)` de duas horas de crédito imprimiria **"0h 0m"** — o número mais
 *     enganoso possível numa tela de fatura, porque é plausível. Aqui só entra `formatHours`.
 *
 *  2. **`horasPlanoSegundos` NÃO é o tamanho do plano.** É a soma das horas **usadas** que
 *     consomem o plano (`ReportQueryRepository.cs:236`, `PlanoSeg`), e é ela que alimenta o
 *     cartão rotulado "Plano de Suporte" (`competenciaTexts.ts:132-139` diz isso por escrito).
 *     O plano **base** deste DTO é `client.horasEfetivas`
 *     (`= horasOverride ?? supportPlan.horasMes`, D16 — `ReportService.cs:102`), em HORAS.
 *     Usar `horasPlanoSegundos` como base faria a conferência de consistência abaixo acusar
 *     divergência em todo cliente do sistema.
 *
 * ─── O que `horasPlanoEfetivas` faz aqui (e o que ele não faz) ──────────────────────────────
 *
 * Ele **não é fonte de número exibido**. É passado a `derivarPlanoEfetivo` só para a
 * conferência contra `base + crédito`: o campo nasce com default `0m` no construtor
 * posicional do C#, e lê-lo cru contra um backend que ainda não o preencha imprimiria `0h`
 * como plano do mês. A conferência só fala (em DEV) quando o wire se contradiz.
 */

import type { ClientReportDto } from '../../shared/types/reports'
import { formatHours } from '../../shared/utils/formatters'
import {
  derivarPlanoEfetivo,
  type EntradaDoPlanoEfetivo,
} from '../../shared/utils/planoEfetivo'

export type CreditoDoRelatorio = {
  /** `creditoHoras > 0`. É o **único** gatilho de exibição — nunca `!!creditoHoras`. */
  temCredito: boolean
  /**
   * `false` = o backend não respondeu sobre crédito (chave ausente ou `null`). Distingue
   * "não sei" de "não há", que renderizam **igual** de propósito; sem ele um `?? 0`
   * passaria em qualquer teste visual (AP-FRONTEND-028).
   */
  creditoConhecido: boolean
  /** Horas de crédito, já saneadas (`0` para ausente, `null`, não-finito ou negativo). */
  creditoHoras: number
  /** `formatHours(creditoHoras)` — "2h 0m". Nunca `formatSeconds`; ver a armadilha 1. */
  creditoTexto: string
}

/**
 * A tradução `ClientReportDto` → entrada estrutural de `derivarPlanoEfetivo`.
 *
 * Exportada para que o teste possa afirmar **qual** campo alimenta cada posição — é a
 * armadilha 2 do cabeçalho, e ela não tem sintoma visível: a conferência de consistência é
 * silenciosa em produção.
 */
export function entradaDoPlanoEfetivoDoRelatorio(
  report: ClientReportDto,
): EntradaDoPlanoEfetivo {
  return {
    clientId: report.client.id,
    // Plano BASE em horas (D16). `?? 0` espelha o `?? 0m` do backend
    // (`ReportService.cs:153`): cliente sem plano e sem override tem base zero, e é assim
    // que as duas pontas concordam.
    qtdePlanoHoras: report.client.horasEfetivas ?? 0,
    creditoHoras: report.creditoHoras,
    qtdePlanoEfetivoHoras: report.horasPlanoEfetivas,
  }
}

export function derivarCreditoDoRelatorio(report: ClientReportDto): CreditoDoRelatorio {
  const { creditoHoras, temCredito, creditoConhecido } = derivarPlanoEfetivo(
    entradaDoPlanoEfetivoDoRelatorio(report),
  )

  return {
    temCredito,
    creditoConhecido,
    creditoHoras,
    creditoTexto: formatHours(creditoHoras),
  }
}
