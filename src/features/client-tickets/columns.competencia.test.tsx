/**
 * 123/FAT-1 — coluna "Concluído em" e os 3 baldes de fatura do chamado, no detalhe do
 * parceiro.
 *
 * 🔴 **132/D1 — o que este arquivo NÃO prova mais.** Ele nunca asseverou o TEXTO dos
 * tooltips (isso é de `competenciaTexts.test.ts`), então a inversão da regra não o derrubou.
 * Mas duas premissas dos comentários mudaram e estão corrigidas abaixo: a data de conclusão
 * deixou de decidir a competência, e os 3 baldes deixaram de ser all-time — agora são
 * recortados pela janela pedida (região `⟪132 JANELA-COMPETENCIA⟫`,
 * `ReportQueryRepository.cs:1423-1456`). O CONSUMO dos quatro campos, que é o que este
 * arquivo trava, não mudou em nada.
 *
 * Os quatro campos (`fechadoEm`, `faturaPlanoSegundos`, `faturaFaturadoSegundos`,
 * `faturaAnaliseSegundos`) o backend JÁ emitia — grep no painel dava zero usos fora dos
 * tipos. Este arquivo trava o consumo deles.
 *
 * O que deixa cada asserção VERMELHA:
 *  · trocar o guard `== null` por `=== undefined` → `null` volta a cair no ramo do valor e
 *    a célula escreve "Invalid Date" / "0h 0m" (o defeito 121/F4, terceira face);
 *  · trocar `== null` por `?? 0` nos baldes → campo AUSENTE passa a afirmar "0h 0m", ou
 *    seja "nenhuma hora neste balde", onde o valor é DESCONHECIDO;
 *  · declarar `sortable`/`sortKey` em qualquer uma das quatro → a chave não está na
 *    whitelist do backend, o `sortBy` cairia no default e a seta mentiria;
 *  · remover ou renomear qualquer uma das quatro → o assert de identidade do conjunto de
 *    colunas cai, nomeando a coluna.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { baldeTexto, buildClientTicketsColumns } from './columns'
import type { ClientTicketItemDto } from './types/clientTickets'

function ticket(overrides: Partial<ClientTicketItemDto> = {}): ClientTicketItemDto {
  return {
    ticketId: 1,
    hubspotTicketId: '10001',
    assunto: 'Assunto',
    clienteNome: 'Acme',
    equipe: 'Suporte',
    ownerNome: 'Ana',
    status: 'Fechado',
    totalSeconds: 5400,
    apontamentosCount: 2,
    hubspotUrl: null,
    totalSecondsAllTime: 5400,
    apontamentosCountAllTime: 2,
    statusNome: 'Fechado',
    statusCategoria: 'fechado',
    categoriasTimer: [],
    ...overrides,
  }
}

function coluna(key: string) {
  const col = buildClientTicketsColumns().find((c) => c.key === key)
  expect(col, `coluna "${key}" não existe`).toBeDefined()
  return col!
}

/** Renderiza o nó do accessor e devolve o texto visível. */
function textoDaCelula(key: string, row: ClientTicketItemDto): string {
  const { container } = render(<>{coluna(key).accessor(row)}</>)
  return container.textContent ?? ''
}

describe('conjunto de colunas do detalhe do parceiro', () => {
  it('as colunas são nominalmente estas, nesta ordem', () => {
    // Identidade, não cardinalidade: `toHaveLength(12)` passaria com uma coluna entrando e
    // outra saindo. Aqui, tanto a remoção quanto a reordenação reprovam — e a ordem importa
    // porque "Concluído em" fica ao lado de "Na fatura" de propósito (é a leitura das duas
    // juntas que explica a competência da linha).
    expect(buildClientTicketsColumns().map((c) => c.key)).toEqual([
      'ticket',
      'assunto',
      'equipe',
      'owner',
      'status',
      'tempo',
      'apontamentos',
      'concluidoEm',
      'naFatura',
      'baldePlano',
      'baldeFaturado',
      'baldeAnalise',
    ])
  })

  it.each(['concluidoEm', 'baldePlano', 'baldeFaturado', 'baldeAnalise'])(
    'coluna %s NÃO é sortável (a chave não está na whitelist de /reports/tickets)',
    (key) => {
      // Whitelist real: hubspotticketid, assunto, cliente, equipe, owner, status, tempo,
      // apontamentos (`ReportQueryRepository.cs:1044-1113`). `fechadoem` e os baldes não
      // estão nela — o backend cairia no `_ =>` (ordena por HsCriadoEm) e a seta da coluna
      // afirmaria uma ordenação que não aconteceu.
      const col = coluna(key)
      expect(col.sortable).toBeFalsy()
      expect(col.sortKey).toBeUndefined()
    },
  )
})

describe('coluna "Concluído em" — três ramos, não dois', () => {
  it('data presente → dd/MM/yyyy no fuso de São Paulo (literal escrito à mão)', () => {
    // 2026-08-05T14:30Z → 11:30 em SP, mesmo dia. Literal, nunca derivado da entrada.
    expect(textoDaCelula('concluidoEm', ticket({ fechadoEm: '2026-08-05T14:30:00Z' }))).toBe(
      '05/08/2026',
    )
  })

  it('a data de conclusão pode ser de mês DIFERENTE do apontamento — e hoje isso é só informação', () => {
    // O cenário inteiro da queixa de 121: apontamento em julho, chamado fechado em agosto.
    //
    // 🔴 **132/D1 — o FATO continua; a CONSEQUÊNCIA acabou.** As duas datas continuam podendo
    // divergir, e a coluna continua exibindo a de conclusão. O que mudou é que ela deixou de
    // DECIDIR a fatura: a hora de julho é faturada em julho, chamado fechado ou não
    // (`ReportQueryRepository.cs:122-124` diz que `Ticket.FechadoEm` não participa de nenhuma
    // decisão de fatura). A coluna FICA porque "quando o chamado encerrou" é dado operacional
    // legítimo; quem carregava a afirmação revogada era o TOOLTIP, reescrito em 132/F3
    // (`TOOLTIP_CONCLUIDO_EM`, travado em `competenciaTexts.test.ts`).
    expect(textoDaCelula('concluidoEm', ticket({ fechadoEm: '2026-08-01T02:00:00Z' }))).toBe(
      '31/07/2026',
    )
  })

  it('campo AUSENTE → "—", nunca uma data', () => {
    // Estado real do wire: o backend serializa com `WhenWritingNull` (`Program.cs:107-108`),
    // então chamado sem `closed_date` vem SEM a chave.
    expect(textoDaCelula('concluidoEm', ticket())).toBe('—')
  })

  it('campo `null` → "—" também: `null` é a OUTRA forma de ausente', () => {
    // Com o guard `=== undefined` este caso caía em `formatDate(null)`. Teste só com
    // `undefined` passaria nas duas implementações e não discriminaria (AP-FRONTEND-028).
    expect(textoDaCelula('concluidoEm', ticket({ fechadoEm: null }))).toBe('—')
  })

  // 125/FE-A11Y-3 — teste INVERTIDO (não apagado). Ele exigia `text-foreground/40` e
  // chamava isso de "contraste tratado": aquela classe mede **2,34:1** sobre o card, pouco
  // mais de metade do piso AA de 4,5:1 — ele travava o defeito, não a correção. O
  // travessão é conteúdo (o `headerInfo` da coluna o define como "informação não
  // disponível") e não é `aria-hidden`, logo vale o piso de TEXTO. `/70` mede 5,47:1.
  // A medição no DOM, com o fundo efetivo e o número, está em
  // `src/test/contraste-a11y-3.test.tsx`; aqui trava-se a classe renderizada.
  it('o "—" fica secundário SEM cair abaixo do piso AA — e a classe velha não volta', () => {
    const { container } = render(<>{coluna('concluidoEm').accessor(ticket())}</>)
    expect(container.querySelector('.text-foreground\\/70')).not.toBeNull()
    expect(container.querySelector('.text-foreground\\/40')).toBeNull()
  })
})

describe('baldeTexto — ausência ≠ zero (AP-FRONTEND-021/028)', () => {
  it('ZERO é um valor e sai como "0h 0m"', () => {
    // Companheira positiva obrigatória do caso de ausência: sem ela, "não vejo 0h 0m" seria
    // satisfeito por um formatador quebrado que nunca escreve nada.
    expect(baldeTexto(0)).toBe('0h 0m')
  })

  it('valor presente sai formatado (5400 → "1h 30m")', () => {
    expect(baldeTexto(5400)).toBe('1h 30m')
  })

  it('AUSENTE sai como "—", nunca "0h 0m"', () => {
    // `?? 0` aqui afirmaria "nenhuma hora neste balde" enquanto o backend antigo estiver
    // no ar — a exata conflação de "não sei responder" com "respondi zero".
    expect(baldeTexto(undefined)).toBe('—')
  })

  it('`null` sai como "—" também', () => {
    expect(baldeTexto(null)).toBe('—')
  })
})

describe('colunas de balde — valores DISTINTOS por coluna (cardinalidade assimétrica)', () => {
  it('cada balde lê o SEU campo, não o do vizinho', () => {
    // Três valores diferentes de propósito: com os três iguais, trocar `faturaPlanoSegundos`
    // por `faturaAnaliseSegundos` no accessor passaria batido.
    const row = ticket({
      faturaPlanoSegundos: 3600, // 1h 0m
      faturaFaturadoSegundos: 1800, // 0h 30m
      faturaAnaliseSegundos: 900, // 0h 15m
    })
    expect(textoDaCelula('baldePlano', row)).toBe('1h 0m')
    expect(textoDaCelula('baldeFaturado', row)).toBe('0h 30m')
    expect(textoDaCelula('baldeAnalise', row)).toBe('0h 15m')
  })

  it('um balde zerado convive com os outros preenchidos', () => {
    const row = ticket({
      faturaPlanoSegundos: 7200,
      faturaFaturadoSegundos: 0,
      faturaAnaliseSegundos: 0,
    })
    expect(textoDaCelula('baldePlano', row)).toBe('2h 0m')
    expect(textoDaCelula('baldeFaturado', row)).toBe('0h 0m')
    expect(textoDaCelula('baldeAnalise', row)).toBe('0h 0m')
  })

  it('backend antigo (nenhum balde no wire) → os três "—", nenhum "0h 0m"', () => {
    const row = ticket()
    expect(textoDaCelula('baldePlano', row)).toBe('—')
    expect(textoDaCelula('baldeFaturado', row)).toBe('—')
    expect(textoDaCelula('baldeAnalise', row)).toBe('—')
  })
})

describe('a tabela aponta para a coluna que explica a fatura', () => {
  it('o tooltip de "Tempo no período" diz que NÃO é a data da fatura', () => {
    // Torna a divergência LEGÍVEL sem resolvê-la (a resolução é DP-7). Sem esta frase, a
    // única leitura possível de "Tempo no período" ≠ "Horas usadas" é "está errado".
    const info = coluna('tempo').headerInfo
    expect(info).toContain('todos os tipos de faturamento')
    expect(info).toContain('NÃO é a data que decide a fatura')
    expect(info).toContain('Concluído em')
  })

  it('os quatro cabeçalhos novos aparecem renderizados com os rótulos esperados', () => {
    const headers = buildClientTicketsColumns().map((c) => c.header)
    expect(headers).toContain('Concluído em')
    expect(headers).toContain('Plano (chamado)')
    expect(headers).toContain('Cobrado por fora (chamado)')
    expect(headers).toContain('Análise (chamado)')
    // Sanidade do render: o helper de célula usa `screen` do mesmo DOM.
    expect(screen.queryByText('Tempo do plano')).not.toBeInTheDocument()
  })
})
