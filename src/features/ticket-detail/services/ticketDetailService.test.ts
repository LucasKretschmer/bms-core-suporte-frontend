import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getTicketById, listTicketTimeEntries } from './ticketDetailService'
import { api } from '../../../services/api'

vi.mock('../../../services/api', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = vi.mocked(api.get)

describe('ticketDetailService', () => {
  beforeEach(() => {
    mockedGet.mockReset()
  })

  it('getTicketById desempacota ApiResponse<T> (data.data) com shape aninhado real', async () => {
    // Envelope REAL de by-id (B8): { data: TicketResponseDto aninhado, message }
    const ticketResponse = {
      id: 't1',
      hubspotTicketId: '123',
      assunto: 'Erro no faturamento',
      categoria: 'Suporte',
      pipelineStage: 'Em andamento',
      owner: { userId: 'u1', nome: 'João Silva', hubspotOwnerId: 999 },
      client: {
        id: 'c1',
        nomeFantasia: 'Acme',
        razaoSocial: 'Acme Comércio Ltda',
        cnpj: '12.345.678/0001-00',
      },
      requester: { nome: 'Maria', email: 'maria@acme.com' },
      hubspotUrl: 'https://app.hubspot.com/tickets/123',
      conteudo: 'Descrição do problema',
      hsCriadoEm: '2026-06-19T10:00:00Z',
    }
    mockedGet.mockResolvedValueOnce({
      data: { data: ticketResponse, message: 'ok' },
    })
    const result = await getTicketById('t1')
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/tickets/by-id/t1')
    // Status do header = pipelineStage (não existe `status`)
    expect(result.pipelineStage).toBe('Em andamento')
    // Campos de meta vêm dos objetos aninhados
    expect(result.owner?.nome).toBe('João Silva')
    expect(result.client?.nomeFantasia).toBe('Acme')
    expect(result.client?.razaoSocial).toBe('Acme Comércio Ltda')
    expect(result.requester?.nome).toBe('Maria')
    expect(result.requester?.email).toBe('maria@acme.com')
  })

  it('listTicketTimeEntries desempacota ApiResponse<T[]> (data.data)', async () => {
    // Envelope REAL de B2/B3: { data: [...], message }
    mockedGet.mockResolvedValueOnce({
      data: { data: [{ id: 'e1' }, { id: 'e2' }], message: 'ok' },
    })
    const result = await listTicketTimeEntries('t1')
    expect(mockedGet).toHaveBeenCalledWith('/api/v1/tickets/t1/time-entries')
    expect(result).toHaveLength(2)
  })

  it('listTicketTimeEntries retorna lista vazia (empty state)', async () => {
    mockedGet.mockResolvedValueOnce({ data: { data: [], message: 'ok' } })
    const result = await listTicketTimeEntries('t1')
    expect(result).toEqual([])
  })
})
