import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock da instância centralizada do Axios
vi.mock('../../../../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '../../../../services/api'
import {
  getBillingExceptionsSummary,
  listBillingExceptions,
  listTeams,
  getClientReport,
  getTicketStatuses,
  getTicketCategories,
  listPlanConsumption,
  listProjectAppointments,
  listServiceCategoryOptions,
  listTicketsReport,
  listProductivity,
} from './reportsService'
import type { PaginatedResponse } from '../../../../types/api'
import type {
  BillingExceptionItemDto,
  BillingExceptionsSummaryDto,
  TeamDto,
  ClientReportDto,
  PlanConsumptionItemDto,
  ProjectAppointmentReportItemDto,
  ServiceCategoryOptionDto,
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
        totalSecondsAllTime: 3600,
        apontamentosCountAllTime: 2,
        statusNome: 'Aberto',
        statusCategoria: 'aberto',
        categoriasTimer: ['Consultoria'],
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

    it('envia categoria como array de strings na query (107)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listTicketsReport({
        categoria: ['Problema - Invoicy', 'Dúvida'],
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.categoria).toEqual(['Problema - Invoicy', 'Dúvida'])
    })

    it('envia serviceCategoryId como array de números na query (MELH-02/119)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listTicketsReport({
        serviceCategoryId: [1, 2],
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.serviceCategoryId).toEqual([1, 2])
    })
  })

  // ── listServiceCategoryOptions (MELH-02/119) ──────────────────────────────────

  describe('listServiceCategoryOptions', () => {
    it('desempacota data.data do envelope ApiResponse (AP-ARQUITETURA-001 — não é PaginatedResponse cru)', async () => {
      const options: ServiceCategoryOptionDto[] = [
        { id: 1, nome: 'Acesso Remoto', isActive: true },
        { id: 2, nome: 'Consultoria', isActive: true },
        { id: 3, nome: 'Plantão', isActive: true },
      ]
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: options } })

      const result = await listServiceCategoryOptions()

      expect(result).toEqual(options)
      expect(result).toHaveLength(3)
    })

    it('chama o endpoint correto com includeInactive=false', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })

      await listServiceCategoryOptions()

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/service-categories',
        expect.objectContaining({ params: { includeInactive: false } }),
      )
    })

    it('retorna array vazio quando não há categorias', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })

      const result = await listServiceCategoryOptions()

      expect(result).toEqual([])
    })
  })

  // ── getTicketCategories (107) ─────────────────────────────────────────────────

  describe('getTicketCategories', () => {
    it('desempacota data.data do envelope ApiResponse com {value,label}', async () => {
      const options = [
        { value: 'Problema - Invoicy', label: 'Problema - Invoicy' },
        { value: 'Dúvida', label: 'Dúvida' },
      ]
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: options } })

      const result = await getTicketCategories()

      expect(result).toEqual(options)
      expect(result[0].value).toBe('Problema - Invoicy')
    })

    it('chama o endpoint correto', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: [] } })

      await getTicketCategories()

      expect(api.get).toHaveBeenCalledWith('/api/v1/reports/tickets/categories')
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

    it('continua desempacotando data.data mesmo com "categoria" presente no item (MELH-01/119)', async () => {
      const options = [
        { value: 'stage-1', label: 'Aberto', categoria: 'aberto' },
        { value: 'stage-2', label: 'Fechado', categoria: 'fechado' },
      ]
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: options } })

      const result = await getTicketStatuses()

      expect(result).toEqual(options)
      expect(result[0].categoria).toBe('aberto')
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

  // ── listBillingExceptions (121/A2 — contrato §5.2/§8) ────────────────────────
  //
  // ⚠️ O endpoint é a unidade FAT-4 e ainda NÃO existe no backend. Estes testes
  // travam o CONTRATO congelado de §8 no lado do cliente (rota, envelope, params);
  // eles não provam a integração ponta-a-ponta — ver o relatório da unidade.

  describe('listBillingExceptions', () => {
    const excecao: BillingExceptionItemDto = {
      ticketId: 501,
      hubspotTicketId: '77001',
      assunto: 'Faturamento travado',
      clientId: 9,
      clienteNome: 'Acme',
      equipe: 'Suporte N2',
      ownerNome: 'Ana',
      status: 'Fechado (Suporte BR)',
      statusNome: 'Fechado',
      statusCategoria: 'fechado',
      ultimaAtividadeEm: '2026-07-10T14:00:00Z',
      segundosPlano: 3600,
      segundosFaturado: 1800,
      segundosAnalise: 0,
      segundosTotais: 5400,
      hubspotUrl: 'https://app.hubspot.com/ticket/77001',
    }

    it('chama a rota de §8 e envia TODOS os params do contrato', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listBillingExceptions({
        from: '2026-07-01',
        to: '2026-07-31',
        sortBy: 'segundos',
        sortDirection: 'desc',
        page: 2,
        pageSize: 50,
      })

      expect(vi.mocked(api.get).mock.calls[0][0]).toBe('/api/v1/reports/billing-exceptions')
      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params).toEqual({
        from: '2026-07-01',
        to: '2026-07-31',
        sortBy: 'segundos',
        sortDirection: 'desc',
        page: 2,
        pageSize: 50,
      })
      // Sem `tipo`, o contrato de §8 vale verbatim: nada é enviado, o backend
      // responde a seção `anomalia` (default). É o que preserva §8 sob F-15.
      expect(params).not.toHaveProperty('tipo')
    })

    it('F-15: envia tipo=postergado quando a seção informativa é pedida', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listBillingExceptions({
        tipo: 'postergado',
        from: '2026-07-01',
        to: '2026-07-31',
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.tipo).toBe('postergado')
    })

    it('F-15: tipo=anomalia é enviado explicitamente quando pedido', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listBillingExceptions({ tipo: 'anomalia', from: null, to: null, page: 1, pageSize: 25 })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.tipo).toBe('anomalia')
    })

    it('OMITE from/to quando nulos — ramo "ignorar período" (nunca string vazia: 400)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listBillingExceptions({ from: null, to: null, page: 1, pageSize: 25 })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params).not.toHaveProperty('from')
      expect(params).not.toHaveProperty('to')
      expect(params).toHaveProperty('page', 1)
      expect(params).toHaveProperty('pageSize', 25)
    })

    it('envia clientId, teamId[] e search quando presentes', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listBillingExceptions({
        clientId: 9,
        teamId: [1, 4],
        search: 'invoicy',
        page: 1,
        pageSize: 25,
      })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params.clientId).toBe(9)
      expect(params.teamId).toEqual([1, 4])
      expect(params.search).toBe('invoicy')
    })

    it('devolve PaginatedResponse CRU (sem envelope data) com os valores do item', async () => {
      const mockResponse: PaginatedResponse<BillingExceptionItemDto> = {
        items: [excecao],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockResponse })

      const result = await listBillingExceptions({ from: null, to: null, page: 1, pageSize: 25 })

      // Literais escritos à mão — nada derivado da própria resposta.
      expect(result.totalCount).toBe(1)
      expect(result.items[0].hubspotTicketId).toBe('77001')
      expect(result.items[0].segundosTotais).toBe(5400)
      expect(result.items[0].segundosPlano + result.items[0].segundosFaturado).toBe(5400)
    })

    it('resposta VAZIA é sucesso com totalCount 0 (não é erro, não é null)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      const result = await listBillingExceptions({ from: null, to: null, page: 1, pageSize: 25 })

      expect(result.items).toEqual([])
      expect(result.totalCount).toBe(0)
    })

    it('propaga o erro do axios (o service não engole falha em resposta vazia)', async () => {
      vi.mocked(api.get).mockRejectedValueOnce(new Error('500'))

      await expect(
        listBillingExceptions({ from: null, to: null, page: 1, pageSize: 25 }),
      ).rejects.toThrow('500')
    })
  })

  // ── getBillingExceptionsSummary (F-15 — contrato NOVO, definido nesta unidade) ──

  describe('getBillingExceptionsSummary', () => {
    const summary: BillingExceptionsSummaryDto = {
      anomaliasCount: 3,
      anomaliasSegundos: 6300,
      postergadoCount: 12,
      postergadoSegundos: 54000,
      naoClassificadosCount: 2,
      naoClassificadosSegundos: 1200,
    }

    it('desempacota data.data (envelope ApiResponse — recurso único, NÃO paginado)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: summary } })

      const result = await getBillingExceptionsSummary({ from: '2026-07-01', to: '2026-07-31' })

      // Literais escritos à mão, nada derivado da resposta.
      expect(result.anomaliasCount).toBe(3)
      expect(result.anomaliasSegundos).toBe(6300)
      expect(result.postergadoCount).toBe(12)
      expect(result.postergadoSegundos).toBe(54000)
      expect(result.naoClassificadosCount).toBe(2)
    })

    it('chama a rota do resumo com o período', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: summary } })

      await getBillingExceptionsSummary({ from: '2026-07-01', to: '2026-07-31' })

      expect(vi.mocked(api.get).mock.calls[0][0]).toBe(
        '/api/v1/reports/billing-exceptions/summary',
      )
      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    })

    it('omite from/to nulos', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: summary } })

      await getBillingExceptionsSummary({ from: null, to: null })

      const params = (vi.mocked(api.get).mock.calls[0][1] as { params: Record<string, unknown> })
        .params
      expect(params).toEqual({})
    })

    it('naoClassificadosCount AUSENTE chega como undefined, nunca como 0', async () => {
      // Backend sem o campo: "não sei responder" ≠ "não há nenhum" (AP-FRONTEND-021).
      const semCampo = {
        anomaliasCount: 0,
        anomaliasSegundos: 0,
        postergadoCount: 0,
        postergadoSegundos: 0,
      }
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: semCampo } })

      const result = await getBillingExceptionsSummary({ from: null, to: null })

      expect(result.naoClassificadosCount).toBeUndefined()
      expect(result.anomaliasCount).toBe(0)
    })
  })
})
