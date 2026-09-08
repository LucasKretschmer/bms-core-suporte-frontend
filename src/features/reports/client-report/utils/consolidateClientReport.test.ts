/**
 * Testes da consolidação client-side do Relatório do Cliente (096).
 * Cobre cada regra decidida pelo usuário: agrupamento por chamado, soma de tempo,
 * atendente = donoChamado (+ fallback), categorização = mais recente, faturamento
 * distinto, intervalo de datas.
 */

import { describe, it, expect } from 'vitest'
import { consolidateClientReport } from './consolidateClientReport'
import type { ClientReportItemDto } from '../../shared/types/reports'

function makeItem(overrides: Partial<ClientReportItemDto>): ClientReportItemDto {
  return {
    timeEntryId: 1,
    origem: 'ticket',
    ticketId: 100,
    hubspotTicketId: '100',
    projetoId: null,
    projetoNome: null,
    stage: null,
    assunto: 'Assunto',
    equipeAtribuida: 'Suporte',
    solicitante: { nome: 'Cliente', email: 'c@x.com' },
    atendente: 'Ana',
    donoChamado: 'Dono Padrão',
    categorizacaoAtendimento: 'Consultoria',
    servico: 'Suporte Técnico',
    servicoSecundario: 'Configuração',
    faturamento: 'Plano de Suporte',
    aberturaDosChamado: '2024-03-01T10:00:00Z',
    dataApontamento: '2024-03-10T09:00:00Z',
    totalSegundos: 600,
    ...overrides,
  }
}

describe('consolidateClientReport', () => {
  it('agrupa por ticketId e retorna 1 linha por chamado', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100 }),
      makeItem({ timeEntryId: 2, ticketId: 100 }),
      makeItem({ timeEntryId: 3, ticketId: 200 }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].chaveChamado).toBe('ticket:100')
    expect(rows[1].chaveChamado).toBe('ticket:200')
    expect(rows[0].apontamentosCount).toBe(2)
  })

  it('agrupa por projetoId para origem = projeto', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, origem: 'projeto', ticketId: null, projetoId: 5, donoChamado: null }),
      makeItem({ timeEntryId: 2, origem: 'projeto', ticketId: null, projetoId: 5, donoChamado: null }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].chaveChamado).toBe('projeto:5')
  })

  it('soma o tempo (totalSegundos) do chamado', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100, totalSegundos: 600 }),
      makeItem({ timeEntryId: 2, ticketId: 100, totalSegundos: 1200 }),
    ])
    expect(rows[0].totalSegundos).toBe(1800)
  })

  it('usa donoChamado como atendente (não o atendente do apontamento)', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100, atendente: 'Ana', donoChamado: 'Carlos Dono' }),
      makeItem({ timeEntryId: 2, ticketId: 100, atendente: 'Bruno', donoChamado: 'Carlos Dono' }),
    ])
    expect(rows[0].atendente).toBe('Carlos Dono')
  })

  it('cai no fallback (atendentes distintos por vírgula) quando donoChamado é null', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100, atendente: 'Ana', donoChamado: null }),
      makeItem({ timeEntryId: 2, ticketId: 100, atendente: 'Bruno', donoChamado: null }),
      makeItem({ timeEntryId: 3, ticketId: 100, atendente: 'Ana', donoChamado: null }),
    ])
    expect(rows[0].atendente).toBe('Ana, Bruno')
  })

  it('cai no fallback quando donoChamado está ausente (backend sem o campo)', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100, atendente: 'Ana', donoChamado: undefined }),
      makeItem({ timeEntryId: 2, ticketId: 100, atendente: 'Bruno', donoChamado: undefined }),
    ])
    expect(rows[0].atendente).toBe('Ana, Bruno')
  })

  it('categorização = a do apontamento mais recente (maior dataApontamento)', () => {
    const rows = consolidateClientReport([
      makeItem({
        timeEntryId: 1,
        ticketId: 100,
        dataApontamento: '2024-03-01T09:00:00Z',
        categorizacaoAtendimento: 'Antiga',
      }),
      makeItem({
        timeEntryId: 2,
        ticketId: 100,
        dataApontamento: '2024-03-20T09:00:00Z',
        categorizacaoAtendimento: 'Recente',
      }),
      makeItem({
        timeEntryId: 3,
        ticketId: 100,
        dataApontamento: '2024-03-10T09:00:00Z',
        categorizacaoAtendimento: 'Meio',
      }),
    ])
    expect(rows[0].categorizacaoAtendimento).toBe('Recente')
  })

  it('servico/servicoSecundario = os do apontamento mais recente (maior dataApontamento)', () => {
    const rows = consolidateClientReport([
      makeItem({
        timeEntryId: 1,
        ticketId: 100,
        dataApontamento: '2024-03-01T09:00:00Z',
        servico: 'Serviço Antigo',
        servicoSecundario: 'Secundário Antigo',
      }),
      makeItem({
        timeEntryId: 2,
        ticketId: 100,
        dataApontamento: '2024-03-20T09:00:00Z',
        servico: 'Serviço Recente',
        servicoSecundario: 'Secundário Recente',
      }),
      makeItem({
        timeEntryId: 3,
        ticketId: 100,
        dataApontamento: '2024-03-10T09:00:00Z',
        servico: 'Serviço Meio',
        servicoSecundario: 'Secundário Meio',
      }),
    ])
    expect(rows[0].servico).toBe('Serviço Recente')
    expect(rows[0].servicoSecundario).toBe('Secundário Recente')
  })

  it('faturamento = valores distintos por vírgula', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100, faturamento: 'Plano de Suporte' }),
      makeItem({ timeEntryId: 2, ticketId: 100, faturamento: 'Faturado' }),
      makeItem({ timeEntryId: 3, ticketId: 100, faturamento: 'Plano de Suporte' }),
    ])
    expect(rows[0].faturamento).toBe('Plano de Suporte, Faturado')
  })

  it('faturamento = valor único quando todos iguais', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100, faturamento: 'Faturado' }),
      makeItem({ timeEntryId: 2, ticketId: 100, faturamento: 'Faturado' }),
    ])
    expect(rows[0].faturamento).toBe('Faturado')
  })

  it('data do apontamento = intervalo (menor início, maior fim)', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100, dataApontamento: '2024-03-10T09:00:00Z' }),
      makeItem({ timeEntryId: 2, ticketId: 100, dataApontamento: '2024-03-02T09:00:00Z' }),
      makeItem({ timeEntryId: 3, ticketId: 100, dataApontamento: '2024-03-25T09:00:00Z' }),
    ])
    expect(rows[0].dataApontamentoInicio).toBe('2024-03-02T09:00:00Z')
    expect(rows[0].dataApontamentoFim).toBe('2024-03-25T09:00:00Z')
  })

  it('mantém invariantes do chamado (origem, ticket, nome, equipe, solicitante, abertura)', () => {
    const rows = consolidateClientReport([
      makeItem({
        timeEntryId: 1,
        ticketId: 100,
        hubspotTicketId: '100',
        assunto: 'Login quebrado',
        equipeAtribuida: 'Suporte N1',
        aberturaDosChamado: '2024-03-01T10:00:00Z',
      }),
    ])
    const row = rows[0]
    expect(row.origem).toBe('ticket')
    expect(row.hubspotTicketId).toBe('100')
    expect(row.assunto).toBe('Login quebrado')
    expect(row.equipeAtribuida).toBe('Suporte N1')
    expect(row.solicitante?.nome).toBe('Cliente')
    expect(row.aberturaDosChamado).toBe('2024-03-01T10:00:00Z')
  })

  it('retorna lista vazia para entrada vazia', () => {
    expect(consolidateClientReport([])).toEqual([])
  })
})

// ── 123/FAT-1 — `fechadoEmChamado` na linha consolidada ──────────────────────

/**
 * O que deixa cada asserção VERMELHA:
 *  · o campo não ser carregado do grupo → `undefined` chega ao PDF consolidado e a coluna
 *    "Concluído" imprime "—" para chamado que TEM data de conclusão (afirmação falsa num
 *    documento que vai ao cliente);
 *  · trocar `?? null` por deixar `undefined` → o tipo declara `string | null`, e o consumidor
 *    passaria a precisar de dois ramos onde o contrato promete um.
 */
describe('consolidateClientReport — data de conclusão do chamado (123/FAT-1)', () => {
  it('carrega `fechadoEmChamado` na linha consolidada', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, fechadoEmChamado: '2024-04-02T13:00:00Z' }),
      makeItem({ timeEntryId: 2, fechadoEmChamado: '2024-04-02T13:00:00Z' }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].fechadoEmChamado).toBe('2024-04-02T13:00:00Z')
    // Companheira positiva: a agregação de fato aconteceu (2 apontamentos de 600 s).
    expect(rows[0].totalSegundos).toBe(1200)
  })

  it('campo ausente vira `null` (nunca `undefined`) — contrato de um ramo só', () => {
    const rows = consolidateClientReport([makeItem({ timeEntryId: 1 })])
    expect(rows[0].fechadoEmChamado).toBeNull()
  })

  it('linha de projeto consolidada fica com `null`', () => {
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 9, origem: 'projeto', ticketId: null, projetoId: 5 }),
    ])
    expect(rows[0].origem).toBe('projeto')
    expect(rows[0].fechadoEmChamado).toBeNull()
  })

  it('dois chamados com conclusões DIFERENTES não trocam de valor entre si', () => {
    // Cardinalidade/valores assimétricos de propósito: com as duas datas iguais, um bug que
    // aplicasse a data do primeiro grupo a todos passaria batido.
    const rows = consolidateClientReport([
      makeItem({ timeEntryId: 1, ticketId: 100, fechadoEmChamado: '2024-04-02T13:00:00Z' }),
      makeItem({ timeEntryId: 2, ticketId: 200, fechadoEmChamado: '2024-05-09T13:00:00Z' }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].fechadoEmChamado).toBe('2024-04-02T13:00:00Z')
    expect(rows[1].fechadoEmChamado).toBe('2024-05-09T13:00:00Z')
  })
})

/**
 * 129 — o wire REAL do `ClientReportItemDto`: todo campo `string?`/`int?` do backend chega
 * com a **chave ausente**, não com `null` (`DefaultIgnoreCondition = WhenWritingNull`).
 * A consolidação é a fronteira onde "ausente" tem de virar o `null` que
 * `ConsolidatedClientReportRow` declara — senão `undefined` vaza para as colunas e para o
 * PDF, onde vira "undefined" impresso.
 */
describe('consolidateClientReport — chaves AUSENTES no wire (129)', () => {
  /** Linha de PROJETO como o backend a serializa: sem ticketId/assunto/solicitante/etc. */
  const itemProjetoSemChaves = {
    timeEntryId: 90,
    origem: 'projeto',
    atendente: 'Ana',
    faturamento: 'Plano de Suporte',
    dataApontamento: '2024-03-10T09:00:00Z',
    totalSegundos: 300,
    projetoId: 7,
  } as ClientReportItemDto

  it('o fixture realmente não tem as chaves (discriminador do teste)', () => {
    for (const chave of [
      'ticketId',
      'hubspotTicketId',
      'assunto',
      'stage',
      'equipeAtribuida',
      'solicitante',
      'categorizacaoAtendimento',
      'servico',
      'servicoSecundario',
      'aberturaDosChamado',
      'projetoNome',
    ]) {
      expect(Object.hasOwn(itemProjetoSemChaves, chave)).toBe(false)
    }
  })

  it('a linha consolidada normaliza TODA chave ausente para `null`, nunca `undefined`', () => {
    const [linha] = consolidateClientReport([itemProjetoSemChaves])
    expect(linha.ticketId).toBeNull()
    expect(linha.hubspotTicketId).toBeNull()
    expect(linha.assunto).toBeNull()
    expect(linha.stage).toBeNull()
    expect(linha.equipeAtribuida).toBeNull()
    expect(linha.solicitante).toBeNull()
    expect(linha.categorizacaoAtendimento).toBeNull()
    expect(linha.servico).toBeNull()
    expect(linha.servicoSecundario).toBeNull()
    expect(linha.aberturaDosChamado).toBeNull()
    expect(linha.projetoNome).toBeNull()
    expect(linha.fechadoEmChamado).toBeNull()
    // Nenhum `undefined` escapou para a linha que alimenta colunas, export e PDF.
    expect(Object.values(linha).some((v) => v === undefined)).toBe(false)
  })

  it('controle positivo: com as chaves presentes, os valores continuam passando', () => {
    const [linha] = consolidateClientReport([makeItem({})])
    expect(linha.ticketId).toBe(100)
    expect(linha.assunto).toBe('Assunto')
    expect(linha.solicitante).not.toBeNull()
  })
})
