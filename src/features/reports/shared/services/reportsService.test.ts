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
  getTicketStatuses,
  listPlanConsumption,
  listProjectAppointments,
  listTicketsReport,
  listProductivity,
} from './reportsService'
import type { PaginatedResponse } from '../../../../types/api'
import type {
  TeamDto,
  ClientReportDto,
  PlanConsumptionItemDto,
  ProjectAppointmentReportItemDto,
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

    it('propaga o filtro origem na query (057 — visão combinada)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: {} })

      await getClientReport({
        clientId: 'client-1',
        month: '2024-06',
        origem: 'projeto',
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.origem).toBe('projeto')
    })
  })

  // ── listProjectAppointments (057) ─────────────────────────────────────────────

  describe('listProjectAppointments', () => {
    it('retorna PaginatedResponse direto (sem envelope data)', async () => {
      const item: ProjectAppointmentReportItemDto = {
        timeEntryId: 1,
        projetoId: 45,
        projetoNome: 'Onboarding ACME',
        stage: 'Kickoff',
        clienteNome: 'ACME',
        equipeAtribuida: 'Onboarding BR',
        atendente: 'Ana',
        categorizacaoAtendimento: 'Consultoria',
        faturamento: 'Faturado',
        dataApontamento: '2024-03-15T14:00:00Z',
        totalSegundos: 1800,
      }
      const mockResponse: PaginatedResponse<ProjectAppointmentReportItemDto> = {
        items: [item],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await listProjectAppointments({ page: 1, pageSize: 25 })

      expect(result.items[0].projetoNome).toBe('Onboarding ACME')
      expect(result.items[0].faturamento).toBe('Faturado')
      expect(result.totalCount).toBe(1)
    })

    it('chama o endpoint correto', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listProjectAppointments({ scope: 'mine', page: 1, pageSize: 25 })

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/reports/project-appointments',
        expect.objectContaining({ params: expect.objectContaining({ scope: 'mine' }) }),
      )
    })

    it('envia teamId como array de números e clientId na query', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listProjectAppointments({ teamId: [1, 3], clientId: '45', page: 1, pageSize: 25 })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.teamId).toEqual([1, 3])
      expect(params.clientId).toBe('45')
    })

    it('remove parâmetros null/undefined/string-vazia antes de enviar', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listProjectAppointments({
        search: '',
        clientId: null,
        from: undefined,
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params).not.toHaveProperty('search')
      expect(params).not.toHaveProperty('clientId')
      expect(params).not.toHaveProperty('from')
      expect(params).toHaveProperty('page', 1)
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

    it('envia status como array de strings na query', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listTicketsReport({
        status: ['Aberto', 'Fechado'],
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.status).toEqual(['Aberto', 'Fechado'])
    })

    it('envia teamId como array de números na query', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listTicketsReport({
        teamId: [1, 3],
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.teamId).toEqual([1, 3])
    })
  })

  // ── getTicketStatuses ─────────────────────────────────────────────────────────

  describe('getTicketStatuses', () => {
    it('desempacota data.data do envelope ApiResponse com {value,label}', async () => {
      const options = [
        { value: 'stage-1', label: 'Em atendimento (Relacionamento BR)' },
        { value: 'stage-2', label: 'Fechado' },
      ]
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: options } })

      const result = await getTicketStatuses()

      expect(result).toEqual(options)
      expect(result[0].value).toBe('stage-1')
      expect(result[0].label).toBe('Em atendimento (Relacionamento BR)')
    })

    it('chama o endpoint correto', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })

      await getTicketStatuses()

      expect(api.get).toHaveBeenCalledWith('/api/v1/reports/tickets/statuses')
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

    it('repassa sortBy/sortDirection ao backend (056)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listProductivity({
        sortBy: 'totalsegundos',
        sortDirection: 'desc',
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.sortBy).toBe('totalsegundos')
      expect(params.sortDirection).toBe('desc')
    })
  })
})
