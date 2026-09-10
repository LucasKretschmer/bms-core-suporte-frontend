import { AcaoDeTabela, type BloqueioDaAcao } from '../../components/table/AcaoDeTabela'
import type { ColumnDef } from '../../components/ui/DataTable/types'
import { MOTIVO_DE_SISTEMA_EXPLICACAO } from './hourCreditReasonTexts'
import {
  ehMotivoDeSistema,
  rotuloSituacaoDoMotivo,
  type HourCreditReasonDto,
} from './types/hourCreditReason'

type BuildColumnsArgs = {
  onEdit: (motivo: HourCreditReasonDto) => void
  onDelete: (motivo: HourCreditReasonDto) => void
}

/**
 * `id` do parágrafo que explica o bloqueio, derivado do id da linha. Uma função só, usada
 * pelo `<p>` e pelo `aria-describedby` dos dois botões — id digitado duas vezes é como o
 * `aria-describedby` fica órfão em silêncio (o atributo existe, aponta para o nada, e
 * nenhum teste de presença de texto percebe).
 */
export function idDaExplicacaoDeSistema(motivoId: number): string {
  return `motivo-sistema-explicacao-${motivoId}`
}

/**
 * Colunas da tabela de Motivos de Crédito (132/F6).
 *
 * 🔴 O motivo **de sistema** (o semeado, `'Estorno de Credito Problema - Invoicy'`) tem as
 * duas ações bloqueadas — o servidor recusa `PUT` e `DELETE` com `409 MOTIVO_DE_SISTEMA`
 * (`analise-backend.md` §7.3) — e o bloqueio vem **com a explicação visível ao lado**,
 * nunca um `disabled` mudo (ver `AcaoDeTabela`).
 *
 * O guard é `ehMotivoDeSistema`, **fail-closed**: `isSistema` ausente ou `null` bloqueia
 * igual. Contra um backend que ainda não manda a flag, o custo de bloquear um motivo comum
 * é um clique; o de liberar o semeado é o crédito automático do mês.
 */
export function buildHourCreditReasonColumns({
  onEdit,
  onDelete,
}: BuildColumnsArgs): ColumnDef<HourCreditReasonDto>[] {
  return [
    {
      key: 'nome',
      header: 'Motivo',
      align: 'left',
      // D15: o texto COMPLETO do motivo aparece aqui — esta é tela `GerentePlus`.
      // Fora daqui e da tela de Créditos, o rótulo do crédito é "Crédito de Suporte".
      accessor: (row) => <span className="text-foreground">{row.nome}</span>,
    },
    {
      key: 'situacao',
      header: 'Situação',
      align: 'center',
      width: '120px',
      accessor: (row) => (
        <span className="text-foreground/80">{rotuloSituacaoDoMotivo(row)}</span>
      ),
    },
    {
      key: 'acao',
      header: 'Ação',
      align: 'center',
      width: '260px',
      accessor: (row) => {
        const deSistema = ehMotivoDeSistema(row)
        const motivoId = idDaExplicacaoDeSistema(row.id)
        const bloqueio: BloqueioDaAcao | null = deSistema
          ? { motivo: MOTIVO_DE_SISTEMA_EXPLICACAO, motivoId }
          : null

        return (
          <div className="flex flex-col items-center gap-1">
            <span className="inline-flex items-center justify-center gap-2">
              <AcaoDeTabela
                aria-label={`Editar motivo ${row.nome}`}
                onClick={() => onEdit(row)}
                bloqueio={bloqueio}
              >
                editar
              </AcaoDeTabela>
              <AcaoDeTabela
                aria-label={`Excluir motivo ${row.nome}`}
                onClick={() => onDelete(row)}
                tom="danger"
                bloqueio={bloqueio}
              >
                excluir
              </AcaoDeTabela>
            </span>
            {deSistema && (
              <p id={motivoId} className="text-xs text-foreground/70 text-left">
                {MOTIVO_DE_SISTEMA_EXPLICACAO}
              </p>
            )}
          </div>
        )
      },
    },
  ]
}
