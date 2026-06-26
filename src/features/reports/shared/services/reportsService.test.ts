import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock da instância centralizada do Axios
vi.mock('../../../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '../../../../services/api'
import {
  listTeams,
  getClientReport,
  listPlanConsumption,
  listTicketsReport,
  listProductivity,
} from './reportsService'
import type { PaginatedResponse } from '../../../../types/api'
import type {
  TeamDto,
  ClientReportDto,
  PlanConsumptionItemDto,
  TicketReportItemDto,
  AgentMetricDto,
  ClientDetailDto,
} from '../types/reports'

describe('reportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── listTeams ───────────────────────────────────────────────────────────────

  describe('listTeams', () => {
    it('desempacota data.data do envelope ApiResponse', async () => {
      const teams: TeamDto[] = [
        { id: 1, nome: 'Suporte Nível 1', gerencia: 'suporte' },
        { id: 2, nome: 'Suporte Nível 2', gerencia: null },
      ]

      vi.mocked(api.get).mockResolvedValueOnce({
        data: { data: teams, message: 'OK' },
      })

      const result = await listTeams()

      expect(result).toEqual(teams)
      expect(result).toHaveLength(2)
      expect(result[0].nome).toBe('Suporte Nível 1')
    })

    it('chama o endpoint correto', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      await listTeams()

      expect(api.get).toHaveBeenCalledWith('/api/v1/teams')
    })

    it('retorna array vazio quando não há equipes', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { data: [] },
      })

      const result = await listTeams()

      expect(result).toEqual([])
    })
  })

  // ── getClientReport ─────────────────────────────────────────────────────────

  describe('getClientReport', () => {
    it('retorna ClientReportDto diretamente (sem desempacotamento extra)', async () => {
      const clientDetail: ClientDetailDto = {
        id: 1,
        hubspotCompanyId: 999,
        cnpj: '12.345.678/0001-00',
        razaoSocial: 'Empresa ABC Ltda',
        nomeFantasia: 'ABC',
        supportPlan: null,
        horasOverride: null,
        horasEfetivas: 40,
      }

      const mockReport: ClientReportDto = {
        client: clientDetail,
        plano: null,
        competencia: '2024-03',
        totalApontamentos: 5,
        totalSegundos: 18000,
        horasPlanoSegundos: 14400,
        horasFaturadoSegundos: 3600,
        horasNaoFaturadoSegundos: 0,
        items: [],
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockReport })

      const result = await getClientReport({
        clientId: 'client-1',
        month: '2024-03',
        page: 1,
        pageSize: 25,
      })

      expect(result).toEqual(mockReport)
      expect(result.competencia).toBe('2024-03')
      expect(result.totalApontamentos).toBe(5)
    })

    it('chama o endpoint correto com os parâmetros', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: {} })

      await getClientReport({
        clientId: 'client-abc',
        month: '2024-06',
        page: 1,
        pageSize: 25,
      })

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/reports/client',
        expect.objectContaining({
          params: expect.objectContaining({ clientId: 'client-abc', month: '2024-06' }),
        }),
      )
    })
  })

  // ── listPlanConsumption ─────────────────────────────────────────────────────

  describe('listPlanConsumption', () => {
    it('passa os parâmetros corretamente ao endpoint', async () => {
      const mockResponse: PaginatedResponse<PlanConsumptionItemDto> = {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 25,
        totalPages: 0,
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      await listPlanConsumption({
        search: 'ABC',
        planId: 'plan-1',
        page: 2,
        pageSize: 50,
      })

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/metrics/plan-consumption',
        expect.objectContaining({
          params: expect.objectContaining({ search: 'ABC', planId: 'plan-1', page: 2, pageSize: 50 }),
        }),
      )
    })

    it('retorna PaginatedResponse com items', async () => {
      const item: PlanConsumptionItemDto = {
        clientId: 1,
        cnpj: '12.345.678/0001-00',
        nomeFantasia: 'Empresa X',
        razaoSocial: 'Empresa X S.A.',
        nomePlano: 'Plano Gold',
        qtdePlanoHoras: 40,
        horasUsadas: 32,
        horasRestantes: 8,
        horasAdicionais: 0,
        percentualPlano: 80,
        horasFaturaveis: 32,
        horasAnalise: 2,
      }

      const mockResponse: PaginatedResponse<PlanConsumptionItemDto> = {
        items: [item],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await listPlanConsumption({ page: 1, pageSize: 25 })

      expect(result.items).toHaveLength(1)
      expect(result.items[0].nomePlano).toBe('Plano Gold')
      expect(result.totalCount).toBe(1)
    })

    it('remove parâmetros null/undefined/string-vazia antes de enviar', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listPlanConsumption({
        search: '',       // deve ser removido
        planId: null,     // deve ser removido
        from: undefined,  // deve ser removido
        page: 1,
        pageSize: 25,
      })

      const callArgs = vi.mocked(api.get).mock.calls[0]
      const params = (callArgs[1] as { params: Record<string, unknown> }).params

      expect(params).not.toHaveProperty('search')
      expect(params).not.toHaveProperty('planId')
      expect(params).not.toHaveProperty('from')
      expect(params).toHaveProperty('page', 1)
      expect(params).toHaveProperty('pageSize', 25)
    })
  })

  // ── listTicketsReport ───────────────────────────────────────────────────────

  describe('listTicketsReport', () => {
    it('retorna PaginatedResponse de tickets', async () => {
      const ticket: TicketReportItemDto = {
        ticketId: 1,
        hubspotTicketId: '10001',
        assunto: 'Erro no sistema',
        clienteNome: 'Cliente Y',
        equipe: 'Suporte N1',
        ownerNome: 'João',
        status: 'Aberto',
        totalSeconds: 3600,
        apontamentosCount: 2,
        hubspotUrl: 'https://app.hubspot.com/ticket/10001',
      }

      const mockResponse: PaginatedResponse<TicketReportItemDto> = {
        items: [ticket],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await listTicketsReport({ page: 1, pageSize: 25 })

      expect(result.items[0].assunto).toBe('Erro no sistema')
      expect(result.items[0].totalSeconds).toBe(3600)
    })

    it('chama o endpoint correto', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listTicketsReport({ scope: 'mine', page: 1, pageSize: 25 })

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/reports/tickets',
        expect.objectContaining({
          params: expect.objectContaining({ scope: 'mine' }),
        }),
      )
    })
  })

  // ── listProductivity ────────────────────────────────────────────────────────

  describe('listProductivity', () => {
    it('retorna PaginatedResponse de AgentMetricDto', async () => {
      const agent: AgentMetricDto = {
        userId: 1,
        nome: 'Maria',
        equipe: 'Suporte N2',
        nAtendimentos: 15,
        totalSegundos: 54000,
        ahtSegundos: 3600,
        mediaPausas: 2,
      }

      const mockResponse: PaginatedResponse<AgentMetricDto> = {
        items: [agent],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await listProductivity({ page: 1, pageSize: 25 })

      expect(result.items[0].nome).toBe('Maria')
      expect(result.items[0].ahtSegundos).toBe(3600)
    })
  })
})
