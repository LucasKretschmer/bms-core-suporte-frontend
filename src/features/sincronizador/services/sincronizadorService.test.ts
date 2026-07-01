import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock da instância centralizada do Axios
vi.mock('../../../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

import { api } from '../../../services/api'
import {
  buildBuscaParams,
  getSincronizadorStatus,
  listSincronizacaoLogs,
  runSincronizador,
  syncTeams,
  syncEmpresas,
  listRegistrosTickets,
  listRegistrosProjetos,
  listRegistros,
  deleteRegistro,
} from './sincronizadorService'
import type {
  LogDto,
  SincronizadorStatusDto,
  TicketManutencaoDto,
  ProjetoManutencaoDto,
} from '../types/sincronizador'
import type { PaginatedResponse } from '../../../types/api'

function makeLog(overrides?: Partial<LogDto>): LogDto {
  return {
    logId: 1,
    tipo: 'tickets',
    status: 'concluido',
    disparo: 'automatico',
    iniciadoEm: '2026-06-19T10:00:00Z',
    finalizadoEm: '2026-06-19T10:00:05Z',
    duracaoMs: 5000,
    ticketsUpserted: 3,
    ticketsIgnorados: 1,
    projetosUpserted: 2,
    projetosIgnorados: 0,
    empresasResolvidas: 4,
    contatosResolvidos: 5,
    empresasCriadas: 0,
    empresasAtualizadas: 0,
    empresasDesativadas: 0,
    mensagemErro: null,
    ...overrides,
  }
}

describe('sincronizadorService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── buildBuscaParams ──────────────────────────────────────────────────────────

  describe('buildBuscaParams', () => {
    it('termo só com dígitos vira hubspotId', () => {
      expect(buildBuscaParams('123456')).toEqual({ hubspotId: '123456' })
    })

    it('termo textual vira search', () => {
      expect(buildBuscaParams('login')).toEqual({ search: 'login' })
    })

    it('trim aplicado em ambos os casos', () => {
      expect(buildBuscaParams('  789  ')).toEqual({ hubspotId: '789' })
      expect(buildBuscaParams('  erro  ')).toEqual({ search: 'erro' })
    })

    it('termo alfanumérico (ID com letra) vira search', () => {
      expect(buildBuscaParams('12a45')).toEqual({ search: '12a45' })
    })
  })

  // ── getSincronizadorStatus ────────────────────────────────────────────────────

  describe('getSincronizadorStatus', () => {
    it('desempacota o envelope { data } e mantém camelCase', async () => {
      const status: SincronizadorStatusDto = {
        statusSistema: 'online',
        emExecucao: false,
        intervaloMinutos: 2,
        ultimaExecucao: makeLog(),
      }

      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: status } })

      const result = await getSincronizadorStatus()

      expect(api.get).toHaveBeenCalledWith('/api/v1/sincronizador/status')
      expect(result.statusSistema).toBe('online')
      expect(result.emExecucao).toBe(false)
      expect(result.intervaloMinutos).toBe(2)
      expect(result.ultimaExecucao?.logId).toBe(1)
      expect(result.ultimaExecucao?.duracaoMs).toBe(5000)
    })

    it('aceita ultimaExecucao null', async () => {
      const status: SincronizadorStatusDto = {
        statusSistema: 'offline',
        emExecucao: false,
        intervaloMinutos: 2,
        ultimaExecucao: null,
      }
      vi.mocked(api.get).mockResolvedValueOnce({ data: { data: status } })

      const result = await getSincronizadorStatus()
      expect(result.ultimaExecucao).toBeNull()
      expect(result.statusSistema).toBe('offline')
    })
  })

  // ── listSincronizacaoLogs ─────────────────────────────────────────────────────

  describe('listSincronizacaoLogs', () => {
    it('retorna PaginatedResponse direto (sem envelope data)', async () => {
      const page: PaginatedResponse<LogDto> = {
        items: [makeLog()],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }
      vi.mocked(api.get).mockResolvedValueOnce({ data: page })

      const result = await listSincronizacaoLogs({ page: 1, pageSize: 25 })

      expect(result.items).toHaveLength(1)
      expect(result.totalCount).toBe(1)
      expect(result.items[0].logId).toBe(1)
    })

    it('só envia params definidos (status/sortBy/sortDirection)', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 2, pageSize: 50, totalPages: 0 },
      })

      await listSincronizacaoLogs({
        page: 2,
        pageSize: 50,
        status: 'erro',
        sortBy: 'duracaoMs',
        sortDirection: 'asc',
      })

      expect(api.get).toHaveBeenCalledWith('/api/v1/sincronizador/logs', {
        params: { page: 2, pageSize: 50, status: 'erro', sortBy: 'duracaoMs', sortDirection: 'asc' },
      })
    })

    it('omite params undefined', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 },
      })

      await listSincronizacaoLogs({ page: 1, pageSize: 25 })

      expect(api.get).toHaveBeenCalledWith('/api/v1/sincronizador/logs', {
        params: { page: 1, pageSize: 25 },
      })
    })
  })

  // ── runSincronizador ──────────────────────────────────────────────────────────

  describe('runSincronizador', () => {
    it('desempacota { data: { logId } }', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { logId: 99 } } })

      const result = await runSincronizador()

      expect(api.post).toHaveBeenCalledWith('/api/v1/sincronizador/run')
      expect(result).toEqual({ logId: 99 })
    })
  })

  // ── syncTeams ─────────────────────────────────────────────────────────────────

  describe('syncTeams', () => {
    it('desempacota o envelope { data }', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { data: { ownersProcessed: 3, teamsProcessed: 2 }, message: 'Sync concluído.' },
      })

      const result = await syncTeams()

      expect(api.post).toHaveBeenCalledWith('/api/v1/admin/sync/owners')
      expect(result).toEqual({ ownersProcessed: 3, teamsProcessed: 2 })
    })
  })

  // ── syncEmpresas ──────────────────────────────────────────────────────────────

  describe('syncEmpresas', () => {
    it('POST no endpoint dedicado e desempacota o envelope { data }', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: {
          data: { criadas: 5, atualizadas: 3, desativadas: 1 },
          message: 'Empresas sincronizadas.',
        },
      })

      const result = await syncEmpresas()

      expect(api.post).toHaveBeenCalledWith('/api/v1/sincronizador/empresas')
      expect(result).toEqual({ criadas: 5, atualizadas: 3, desativadas: 1 })
    })
  })

  // ── listRegistrosTickets ──────────────────────────────────────────────────────

  describe('listRegistrosTickets', () => {
    it('mapeia items de PaginatedResponse para RegistroDto com tipo="ticket"', async () => {
      const ticket: TicketManutencaoDto = {
        ticketId: 1,
        hubspotId: '111',
        assunto: 'Erro de login',
        pipeline: 'Suporte',
        pipelineStage: 'Aberto',
        hsCriadoEm: '2026-06-01T00:00:00Z',
        criadoEm: '2026-06-02T00:00:00Z',
        atualizadoEm: '2026-06-03T00:00:00Z',
      }
      const page: PaginatedResponse<TicketManutencaoDto> = {
        items: [ticket],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }
      vi.mocked(api.get).mockResolvedValueOnce({ data: page })

      const result = await listRegistrosTickets({ search: 'login' })

      expect(api.get).toHaveBeenCalledWith('/api/v1/sincronizador/registros/tickets', {
        params: { search: 'login' },
      })
      expect(result).toEqual([
        {
          tipo: 'ticket',
          hubspotId: '111',
          assunto: 'Erro de login',
          pipeline: 'Suporte',
          criadoEm: '2026-06-02T00:00:00Z',
        },
      ])
    })

    it('assunto nulo vira "—"', async () => {
      vi.mocked(api.get).mockResolvedValueOnce({
        data: {
          items: [
            {
              ticketId: 2,
              hubspotId: '222',
              assunto: null,
              pipeline: null,
              pipelineStage: null,
              hsCriadoEm: null,
              criadoEm: '2026-06-02T00:00:00Z',
              atualizadoEm: '2026-06-03T00:00:00Z',
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 25,
          totalPages: 1,
        },
      })

      const result = await listRegistrosTickets({ hubspotId: '222' })
      expect(result[0].assunto).toBe('—')
      expect(result[0].pipeline).toBeNull()
    })
  })

  // ── listRegistrosProjetos ─────────────────────────────────────────────────────

  describe('listRegistrosProjetos', () => {
    it('mapeia nome → assunto e injeta tipo="projeto"', async () => {
      const projeto: ProjetoManutencaoDto = {
        projetoId: 1,
        hubspotId: '333',
        nome: 'Implantação ACME',
        tipo: 'Onboarding',
        pipeline: 'Projetos',
        stage: 'Em andamento',
        iniciadoEm: '2026-06-01T00:00:00Z',
        concluidoEm: null,
        criadoEm: '2026-06-02T00:00:00Z',
        atualizadoEm: '2026-06-03T00:00:00Z',
      }
      const page: PaginatedResponse<ProjetoManutencaoDto> = {
        items: [projeto],
        totalCount: 1,
        page: 1,
        pageSize: 25,
        totalPages: 1,
      }
      vi.mocked(api.get).mockResolvedValueOnce({ data: page })

      const result = await listRegistrosProjetos({ search: 'ACME' })

      expect(api.get).toHaveBeenCalledWith('/api/v1/sincronizador/registros/projetos', {
        params: { search: 'ACME' },
      })
      expect(result).toEqual([
        {
          tipo: 'projeto',
          hubspotId: '333',
          assunto: 'Implantação ACME',
          pipeline: 'Projetos',
          criadoEm: '2026-06-02T00:00:00Z',
        },
      ])
    })
  })

  // ── listRegistros (combina) ───────────────────────────────────────────────────

  describe('listRegistros', () => {
    it('combina tickets e projetos numa única lista', async () => {
      vi.mocked(api.get)
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                ticketId: 1,
                hubspotId: '111',
                assunto: 'Ticket A',
                pipeline: 'Suporte',
                pipelineStage: null,
                hsCriadoEm: null,
                criadoEm: '2026-06-02T00:00:00Z',
                atualizadoEm: '2026-06-03T00:00:00Z',
              },
            ],
            totalCount: 1,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        })
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                projetoId: 1,
                hubspotId: '333',
                nome: 'Projeto B',
                tipo: null,
                pipeline: 'Projetos',
                stage: null,
                iniciadoEm: null,
                concluidoEm: null,
                criadoEm: '2026-06-04T00:00:00Z',
                atualizadoEm: '2026-06-05T00:00:00Z',
              },
            ],
            totalCount: 1,
            page: 1,
            pageSize: 25,
            totalPages: 1,
          },
        })

      const result = await listRegistros({ search: 'teste' })

      expect(result).toHaveLength(2)
      expect(result.find((r) => r.tipo === 'ticket')?.assunto).toBe('Ticket A')
      expect(result.find((r) => r.tipo === 'projeto')?.assunto).toBe('Projeto B')
    })
  })

  // ── deleteRegistro ────────────────────────────────────────────────────────────

  describe('deleteRegistro', () => {
    it('ticket → DELETE no endpoint de tickets', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ status: 204 })
      await deleteRegistro('ticket', '111')
      expect(api.delete).toHaveBeenCalledWith('/api/v1/sincronizador/registros/tickets/111')
    })

    it('projeto → DELETE no endpoint de projetos', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ status: 204 })
      await deleteRegistro('projeto', '333')
      expect(api.delete).toHaveBeenCalledWith('/api/v1/sincronizador/registros/projetos/333')
    })
  })
})
