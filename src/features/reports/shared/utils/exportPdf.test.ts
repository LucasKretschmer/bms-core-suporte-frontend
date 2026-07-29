/**
 * Testes de exportPdf.tsx (118.5.2) — colunas "Serviço" e "Serviço - Secundário".
 *
 * O documento é montado via JSX puro (React.createElement), nunca de fato renderizado
 * (sem ReactDOM/react-test-renderer) — `pdf(<PdfDocument />)` só recebe a árvore de
 * elementos. Por isso mockamos @react-pdf/renderer e, no `pdf()`, percorremos
 * manualmente a árvore de elementos React (via `.type`/`.props.children`) coletando o
 * texto de cada nó `Text`, sem depender do parser interno da lib nem gerar um PDF real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import type { ClientReportDto, ClientReportItemDto } from '../types/reports'

// ── Mock de @react-pdf/renderer ──────────────────────────────────────────────
let capturedTexts: string[] = []

function TextMock(props: { children?: ReactNode }) {
  const text = Array.isArray(props.children)
    ? props.children.join('')
    : String(props.children ?? '')
  capturedTexts.push(text)
  return null
}

function walk(node: ReactNode): void {
  if (node == null || typeof node === 'boolean') return
  if (Array.isArray(node)) {
    node.forEach(walk)
    return
  }
  if (typeof node !== 'object') return
  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === TextMock) {
    TextMock(element.props)
    return
  }
  if (typeof element.type === 'function') {
    // Componente funcional (Document/Page/View/PdfDocument): invoca para obter a árvore.
    const rendered = (element.type as (props: unknown) => ReactNode)(element.props)
    walk(rendered)
    return
  }
  walk(element.props?.children)
}

vi.mock('@react-pdf/renderer', () => {
  return {
    pdf: (element: ReactElement) => ({
      toBlob: async () => {
        walk(element)
        return new Blob(['pdf'], { type: 'application/pdf' })
      },
    }),
    Document: (props: { children?: ReactNode }) => props.children ?? null,
    Page: (props: { children?: ReactNode }) => props.children ?? null,
    View: (props: { children?: ReactNode }) => props.children ?? null,
    Text: TextMock,
    StyleSheet: { create: (styles: unknown) => styles },
  }
})

import { generateClientReportPdf } from './exportPdf'

const REPORT: ClientReportDto = {
  client: {
    id: 1,
    hubspotCompanyId: 10,
    cnpj: null,
    razaoSocial: 'ACME',
    nomeFantasia: 'ACME',
    supportPlan: null,
    horasOverride: null,
    horasEfetivas: null,
  },
  plano: null,
  competencia: '2024-03',
  totalApontamentos: 2,
  totalSegundos: 1200,
  horasPlanoSegundos: 0,
  horasFaturadoSegundos: 0,
  horasNaoFaturadoSegundos: 0,
  items: null,
}

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
    solicitante: null,
    atendente: 'Ana',
    donoChamado: 'Dono',
    categorizacaoAtendimento: 'Consultoria',
    servico: 'Suporte Técnico',
    servicoSecundario: 'Configuração',
    faturamento: 'Faturado',
    aberturaDosChamado: null,
    dataApontamento: '2024-03-10T09:00:00Z',
    totalSegundos: 600,
    ...overrides,
  }
}

beforeEach(() => {
  capturedTexts.length = 0
})

describe('generateClientReportPdf — colunas Serviço / Serviço - Secundário (118.5.2)', () => {
  it('inclui os headers "Serviço" e "Serviço - Secundário" na tabela', async () => {
    await generateClientReportPdf({
      report: REPORT,
      items: [makeItem({})],
      type: 'detalhado',
    })
    expect(capturedTexts).toContain('Serviço')
    expect(capturedTexts).toContain('Serviço - Secundário')
  })

  it('modo detalhado: exibe o valor real de servico/servicoSecundario por apontamento', async () => {
    await generateClientReportPdf({
      report: REPORT,
      items: [
        makeItem({
          timeEntryId: 1,
          servico: 'Suporte Técnico',
          servicoSecundario: 'Configuração',
        }),
      ],
      type: 'detalhado',
    })
    expect(capturedTexts).toContain('Suporte Técnico')
    expect(capturedTexts).toContain('Configuração')
  })

  it('modo detalhado: aplica fallback "—" quando servico/servicoSecundario são null', async () => {
    await generateClientReportPdf({
      report: REPORT,
      items: [makeItem({ timeEntryId: 1, servico: null, servicoSecundario: null })],
      type: 'detalhado',
    })
    // Deve haver ao menos duas células "—" correspondentes às colunas de serviço
    // (além de outras colunas que também usam "—" como fallback — asserção não-exclusiva).
    expect(capturedTexts.filter((t) => t === '—').length).toBeGreaterThanOrEqual(2)
    expect(capturedTexts).not.toContain('Suporte Técnico')
  })

  it('modo consolidado: usa servico/servicoSecundario do apontamento mais recente do chamado', async () => {
    await generateClientReportPdf({
      report: REPORT,
      items: [
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
      ],
      type: 'consolidado',
    })
    expect(capturedTexts).toContain('Serviço Recente')
    expect(capturedTexts).toContain('Secundário Recente')
    expect(capturedTexts).not.toContain('Serviço Antigo')
    expect(capturedTexts).not.toContain('Secundário Antigo')
  })

  it('modo consolidado: aplica fallback "—" quando servico/servicoSecundario são null', async () => {
    await generateClientReportPdf({
      report: REPORT,
      items: [
        makeItem({
          timeEntryId: 1,
          ticketId: 200,
          servico: null,
          servicoSecundario: null,
        }),
      ],
      type: 'consolidado',
    })
    expect(capturedTexts.filter((t) => t === '—').length).toBeGreaterThanOrEqual(2)
  })
})
