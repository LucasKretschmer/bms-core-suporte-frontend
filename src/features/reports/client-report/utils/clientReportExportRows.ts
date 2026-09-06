/**
 * Colunas e linhas do export CSV/Excel do Relatório do Cliente (U5).
 *
 * Extraído de `client-report/index.tsx` na 123/FAT-1 sem mudança de comportamento, por um
 * motivo só: **o export é a superfície mais grave de um campo formatado** (AP-FRONTEND-028 —
 * tela errada o gestor recarrega, planilha errada ele encaminha), e esta tela não tem teste
 * de página. Enquanto o mapeamento vivia dentro do componente, ele era o único dos quatro
 * lugares do campo que nenhum teste alcançava. Agora é função pura, com teste próprio.
 *
 * PRIVACIDADE (regra central do PRD, inalterada):
 *  - a categoria do chamado do HubSpot (ex.: "Problema - Invoicy") NUNCA aparece no arquivo;
 *  - `ClientReportItemDto` não contém esse campo — garantia em tempo de tipo;
 *  - `CLIENT_REPORT_EXPORT_COLUMNS` é a fonte de verdade do export: nunca acrescentar aqui
 *    campo de categoria interna do HubSpot.
 */

import type { ExportColumn } from '../../shared/utils/exportTable'
import type { ClientReportItemDto } from '../../shared/types/reports'
import { formatDate, formatDateTime, formatSeconds } from '../../shared/utils/formatters'
import { HEADER_CONCLUIDO_EM } from '../../shared/utils/competenciaTexts'

export const CLIENT_REPORT_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'Origem', key: 'origem' },
  { header: 'Ticket / Projeto', key: 'ticket' },
  { header: 'Nome do ticket', key: 'assunto' },
  { header: 'Equipe', key: 'equipe' },
  // Serviço / Serviço - Secundário: propriedades HubSpot expostas pelo backend (118.5.2)
  { header: 'Serviço', key: 'servico' },
  { header: 'Serviço - Secundário', key: 'servicoSecundario' },
  { header: 'Solicitante', key: 'solicitante' },
  { header: 'Atendente', key: 'atendente' },
  { header: 'Categorização do atendimento', key: 'categorizacaoAtendimento' },
  // Faturamento: 3 status seguros (nunca expõe a categoria do HubSpot)
  { header: 'Faturamento', key: 'faturamento' },
  { header: 'Abertura do chamado', key: 'aberturaChamado' },
  { header: 'Data do apontamento', key: 'dataApontamento' },
  // 123/FAT-1 — a data de conclusão do CHAMADO é a competência de fatura da linha, e é o
  // que explica uma "Data do apontamento" fora do período exportado. Vem imediatamente
  // depois dela de propósito: é a leitura das duas juntas que explica a linha.
  { header: HEADER_CONCLUIDO_EM, key: 'fechadoEmChamado' },
  { header: 'Tempo', key: 'tempo' },
]

/**
 * Converte `ClientReportItemDto` em linha de export.
 * A ausência do campo de categoria do HubSpot é garantida pelo próprio tipo do DTO.
 */
export function itemToExportRow(
  item: ClientReportItemDto,
): Record<string, string | number | null> {
  const isProjeto = item.origem === 'projeto'
  return {
    // Origem (057): rótulo legível — Ticket / Projeto
    origem: isProjeto ? 'Projeto' : 'Ticket',
    // Ticket-only: #hubspotTicketId; Projeto: nome do projeto (null-safe)
    ticket: isProjeto
      ? (item.projetoNome ?? '—')
      : item.hubspotTicketId
        ? `#${item.hubspotTicketId}`
        : '—',
    // Nome do ticket (ticket) ou stage (projeto)
    assunto: isProjeto ? (item.stage ?? '—') : (item.assunto ?? '—'),
    equipe: item.equipeAtribuida ?? '—',
    servico: item.servico ?? '—',
    servicoSecundario: item.servicoSecundario ?? '—',
    solicitante: item.solicitante?.nome ?? '—',
    atendente: item.atendente || '—',
    // categorizacaoAtendimento = ServiceCategory interna (≠ categoria do HubSpot)
    categorizacaoAtendimento: item.categorizacaoAtendimento ?? '—',
    // faturamento = 3 status abstratos — nunca vaza categoria do HubSpot
    faturamento: item.faturamento,
    // Linhas de projeto não têm abertura de chamado
    aberturaChamado: item.aberturaDosChamado ? formatDate(item.aberturaDosChamado) : '—',
    dataApontamento: formatDateTime(item.dataApontamento),
    /**
     * 123/FAT-1 — guard `== null`, nunca `=== undefined`: a chave tem DUAS formas de
     * ausência no wire (o backend serializa com `WhenWritingNull`, `Program.cs:107-108`,
     * então linha de projeto e chamado sem `closed_date` vêm SEM a chave; outro
     * serializador mandaria `null`). `formatDate(undefined)` escreveria lixo na planilha,
     * que é justamente o artefato que sai do sistema e não volta.
     */
    fechadoEmChamado:
      item.fechadoEmChamado == null ? '—' : formatDate(item.fechadoEmChamado),
    tempo: formatSeconds(item.totalSegundos),
  }
}
