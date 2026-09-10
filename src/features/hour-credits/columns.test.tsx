import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildHourCreditColumns, competenciaTexto, divergenciaTexto, horasDerivadasTexto } from './columns'
import type { HourCreditDto } from './types/hourCredit'

const base: HourCreditDto = {
  id: 1,
  clientId: 42,
  clienteNome: 'Acme',
  cnpj: '12.345.678/0001-90',
  horas: 2,
  competencia: '2026-09',
  status: 'vigente',
  origem: 'manual',
  motivoId: 3,
  motivoNome: 'Estorno de Credito Problema - Invoicy',
  criadoEm: '2026-09-08T12:00:00Z',
  criadoPorNome: 'Ana',
}

function celula(row: HourCreditDto, key: string, handlers?: {
  onEdit?: (c: HourCreditDto) => void
  onDelete?: (c: HourCreditDto) => void
}) {
  const columns = buildHourCreditColumns({
    onEdit: handlers?.onEdit ?? vi.fn(),
    onDelete: handlers?.onDelete ?? vi.fn(),
  })
  const coluna = columns.find((c) => c.key === key)
  if (!coluna) throw new Error(`coluna "${key}" não existe`)
  return render(<>{coluna.accessor(row)}</>)
}

describe('guards de ausência (AP-FRONTEND-028) — funções puras', () => {
  it('🔴 horas derivadas: `null` e ausente viram "—"; ZERO vira "0h 0m"', () => {
    // O caso `0` é o discriminador: um guard escrito como `horas ? … : '—'` (ou
    // `horas ?? '—'` sobre um número que o servidor mandou como 0) transformaria
    // "consumiu zero" em "não sei" — e o `null` vira "0h 0m", que afirma o contrário.
    expect(horasDerivadasTexto(null)).toBe('—')
    expect(horasDerivadasTexto(undefined)).toBe('—')
    expect(horasDerivadasTexto(0)).toBe('0h 0m')
    expect(horasDerivadasTexto(2.75)).toBe('2h 45m')
  })

  it('🔴 divergência: `null` → "—", `false` → "Não", `true` → "Divergente"', () => {
    // `null → "Não"` é o defeito literal do `AP-FRONTEND-028` (`entraNaFatura`): afirma
    // "não divergiu" sobre um valor desconhecido. O caso `false` é a companheira que
    // impede a "correção" preguiçosa de colapsar os dois em "—".
    expect(divergenciaTexto(null)).toBe('—')
    expect(divergenciaTexto(undefined)).toBe('—')
    expect(divergenciaTexto(false)).toBe('Não')
    expect(divergenciaTexto(true)).toBe('Divergente')
  })

  it('competência: `"YYYY-MM"` vira mês por extenso; ausente/vazia viram "—"', () => {
    expect(competenciaTexto('2026-09')).toBe('Setembro 2026')
    expect(competenciaTexto(null)).toBe('—')
    expect(competenciaTexto('')).toBe('—')
  })
})

describe('colunas — as três formas da divergência na CÉLULA (T-25)', () => {
  it('`null` renderiza "—" e NÃO a pílula de alerta', () => {
    const { container } = celula({ ...base, divergenteDoSnapshot: null }, 'divergente')
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(container.textContent).not.toContain('Divergente')
  })

  it('`false` renderiza "Não" — companheira positiva do caso acima', () => {
    celula({ ...base, divergenteDoSnapshot: false }, 'divergente')
    expect(screen.getByText('Não')).toBeInTheDocument()
  })

  it('`true` renderiza a pílula de alerta com o texto (WCAG 1.4.1: não é só cor)', () => {
    celula({ ...base, divergenteDoSnapshot: true }, 'divergente')
    const pilula = screen.getByText('Divergente')
    expect(pilula).toBeInTheDocument()
    expect(pilula.className).toContain('bg-warning-bg')
  })
})

describe('colunas Consumido/Perdido — o mesmo guard, agora na CÉLULA', () => {
  it('🔴 `consumidoHoras: 0` renderiza "0h 0m" na célula; `null` renderiza "—"', () => {
    // Companheira COMPORTAMENTAL do teste puro acima (`rules/tests.md`: um invariante de
    // efeito precisa de ao menos um teste que não seja da mesma classe do outro). É a
    // célula que o gestor lê — e "—" no lugar de "0h 0m" muda a conversa de fatura.
    const zero = celula({ ...base, consumidoHoras: 0 }, 'consumido')
    expect(zero.container.textContent).toBe('0h 0m')
    zero.unmount()

    const nulo = celula({ ...base, consumidoHoras: null }, 'consumido')
    expect(nulo.container.textContent).toBe('—')
    nulo.unmount()

    const perdido = celula({ ...base, perdidoHoras: 1.5 }, 'perdido')
    expect(perdido.container.textContent).toBe('1h 30m')
  })
})

describe('coluna Criado em — "Sistema" só quando o servidor diz que não houve autor', () => {
  it('`criadoPorNome: null` (crédito automático) exibe "Sistema"', () => {
    celula({ ...base, criadoPorNome: null }, 'criado')
    expect(screen.getByText('Sistema')).toBeInTheDocument()
  })

  it('companheira positiva: com autor, exibe o nome — nunca "Sistema"', () => {
    const { container } = celula({ ...base, criadoPorNome: 'Ana' }, 'criado')
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(container.textContent).not.toContain('Sistema')
  })
})

describe('coluna Chamado — link externo só quando a URL vem do servidor', () => {
  it('com `hubspotUrl`, é um link com rel="noopener noreferrer" e target=_blank', () => {
    celula({ ...base, hubspotTicketId: '7001', hubspotUrl: 'https://app.hubspot.com/ticket/7001' }, 'chamado')
    const link = screen.getByRole('link', { name: /7001/ })
    expect(link).toHaveAttribute('href', 'https://app.hubspot.com/ticket/7001')
    expect(link).toHaveAttribute('target', '_blank')
    // `rules/security.md`: sem isto, a página aberta ganha `window.opener`.
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('sem `hubspotUrl`, o número aparece em TEXTO — nenhuma URL é montada no front', () => {
    // Vermelho se alguém "resolver" o link concatenando um domínio do HubSpot aqui: URL
    // hardcoded é proibida (`CLAUDE.md`), e a URL certa depende do portal.
    const { container } = celula({ ...base, hubspotTicketId: '7001', hubspotUrl: null }, 'chamado')
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.textContent).toContain('#7001')
  })

  it('sem chamado nenhum, "—"', () => {
    const { container } = celula({ ...base, hubspotTicketId: null }, 'chamado')
    expect(container.textContent).toBe('—')
  })
})

describe('coluna Motivo — D15: o texto COMPLETO aparece nesta tela', () => {
  it('renderiza o motivo do wire sem encurtar (tela GerentePlus)', () => {
    // Esta é UMA das duas telas onde o rótulo completo pode aparecer (a outra é Motivos).
    // Em qualquer artefato do cliente o rótulo é "Crédito de Suporte" — travado nas telas
    // daquele lado, não aqui.
    const { container } = celula(base, 'motivo')
    expect(container.textContent).toBe('Estorno de Credito Problema - Invoicy')
  })

  it('motivo ausente vira "—", nunca string vazia', () => {
    const { container } = celula({ ...base, motivoNome: null }, 'motivo')
    expect(container.textContent).toBe('—')
  })
})

describe('ordenação — só `sortKey` da whitelist do backend', () => {
  it('as colunas ordenáveis são nominalmente estas, com as chaves do servidor', () => {
    // Identidade, não contagem: `sortBy` fora da whitelist devolve `400` na borda
    // (`analise-backend.md` §7.2). `status` fica FORA de propósito — é derivado.
    const columns = buildHourCreditColumns({ onEdit: vi.fn(), onDelete: vi.fn() })
    const ordenaveis = columns.filter((c) => c.sortable === true).map((c) => c.sortKey)
    expect(ordenaveis).toEqual([
      'clientenome',
      'horas',
      'competencia',
      'competenciaorigem',
      'origem',
      'criadoem',
    ])
    expect(columns.find((c) => c.key === 'status')?.sortable).toBeUndefined()
  })
})

describe('ações — crédito estornado é recusado pelo servidor, e a UI diz por quê', () => {
  it('🔴 estornado: "editar" fica `aria-disabled` (NUNCA `disabled` mudo) e explica', async () => {
    const onEdit = vi.fn()
    celula({ ...base, status: 'estornado' }, 'acao', { onEdit })

    const editar = screen.getByRole('button', { name: 'Editar crédito de Acme' })
    expect(editar).toHaveAttribute('aria-disabled', 'true')
    // `disabled` tiraria o botão da ordem de tabulação: quem navega por teclado nunca
    // saberia que a ação existe nem por que está indisponível (`AP-QA-007`).
    expect(editar).not.toBeDisabled()

    // O motivo está VISÍVEL e o `aria-describedby` aponta para ele — id órfão reprova.
    const idDoMotivo = editar.getAttribute('aria-describedby')
    expect(idDoMotivo).toBeTruthy()
    const explicacao = document.getElementById(idDoMotivo as string)
    expect(explicacao).not.toBeNull()
    expect(explicacao?.textContent).toContain('Crédito estornado não pode ser alterado')

    // Bloqueio REAL: o clique não chama o handler.
    await userEvent.click(editar)
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('🔴 o botão bloqueado continua ALCANÇÁVEL por Tab (travessia real)', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">âncora fora da célula</button>
        {
          buildHourCreditColumns({ onEdit: vi.fn(), onDelete: vi.fn() })
            .find((c) => c.key === 'acao')!
            .accessor({ ...base, status: 'estornado' })
        }
      </>,
    )

    // Ancorado FORA da célula, como manda `rules/frontend.md` § Acessibilidade de teclado:
    // `el.focus()` provaria só que o elemento PODE receber foco, não que o usuário chega
    // nele. Trocar `aria-disabled` por `disabled` deixa este teste vermelho.
    screen.getByRole('button', { name: 'âncora fora da célula' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Editar crédito de Acme' }),
    )
    await user.tab()
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Excluir crédito de Acme' }),
    )
  })

  it('companheira positiva: crédito VIGENTE tem "editar" livre e o clique passa', async () => {
    // Sem este par, um componente que bloqueasse TUDO passaria no teste acima.
    const onEdit = vi.fn()
    celula({ ...base, status: 'vigente' }, 'acao', { onEdit })

    const editar = screen.getByRole('button', { name: 'Editar crédito de Acme' })
    expect(editar).not.toHaveAttribute('aria-disabled')
    await userEvent.click(editar)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('excluir NÃO é bloqueado em crédito estornado — o DELETE é aceito (204)', async () => {
    // `arquitetura.md:922`: o `DELETE` não tem ramo de conflito. Bloquear aqui seria a UI
    // inventando uma regra que o servidor não tem.
    const onDelete = vi.fn()
    celula({ ...base, status: 'estornado' }, 'acao', { onDelete })

    const excluir = screen.getByRole('button', { name: 'Excluir crédito de Acme' })
    expect(excluir).not.toHaveAttribute('aria-disabled')
    await userEvent.click(excluir)
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('status DESCONHECIDO não bloqueia — quem decide é o servidor', async () => {
    const onEdit = vi.fn()
    celula({ ...base, status: 'mosaico' }, 'acao', { onEdit })
    await userEvent.click(screen.getByRole('button', { name: 'Editar crédito de Acme' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
