import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildHourCreditReasonColumns } from './columns'
import type { HourCreditReasonDto } from './types/hourCreditReason'

const SEMEADO: HourCreditReasonDto = {
  id: 1,
  nome: 'Estorno de Credito Problema - Invoicy',
  isActive: true,
  isSistema: true,
}
const COMUM: HourCreditReasonDto = {
  id: 2,
  nome: 'Cortesia comercial',
  isActive: true,
  isSistema: false,
}
/** Backend anterior ao campo: a chave nem vem. */
const SEM_CHAVE: HourCreditReasonDto = { id: 3, nome: 'Legado', isActive: true }
/** Serializador do outro lado mandando `null` — o caso que `=== undefined` deixa passar. */
const NULO: HourCreditReasonDto = { id: 4, nome: 'Outro', isActive: true, isSistema: null }

function renderAcao(row: HourCreditReasonDto, handlers?: {
  onEdit?: (m: HourCreditReasonDto) => void
  onDelete?: (m: HourCreditReasonDto) => void
}) {
  const columns = buildHourCreditReasonColumns({
    onEdit: handlers?.onEdit ?? vi.fn(),
    onDelete: handlers?.onDelete ?? vi.fn(),
  })
  const coluna = columns.find((c) => c.key === 'acao')
  if (!coluna) throw new Error('coluna "acao" não existe')
  return render(<>{coluna.accessor(row)}</>)
}

describe('T-26 — motivo de SISTEMA: bloqueado, e o usuário sabe por quê', () => {
  it('🔴 editar e excluir ficam `aria-disabled` — e NÃO `disabled` mudo', async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    renderAcao(SEMEADO, { onEdit, onDelete })

    const editar = screen.getByRole('button', { name: /Editar motivo Estorno de Credito/ })
    const excluir = screen.getByRole('button', { name: /Excluir motivo Estorno de Credito/ })

    for (const botao of [editar, excluir]) {
      expect(botao).toHaveAttribute('aria-disabled', 'true')
      // `disabled` tiraria o botão da ordem de tabulação e do leitor de tela: a ação
      // sumiria sem explicação (`rules/frontend.md` § Acessibilidade de teclado).
      expect(botao).not.toBeDisabled()
    }

    // Bloqueio REAL: sem isto o `aria-disabled` seria decoração e o clique passaria.
    await userEvent.click(editar)
    await userEvent.click(excluir)
    expect(onEdit).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('🔴 a explicação está VISÍVEL e o `aria-describedby` aponta para ela (id não órfão)', () => {
    renderAcao(SEMEADO)

    const excluir = screen.getByRole('button', { name: /Excluir motivo/ })
    const id = excluir.getAttribute('aria-describedby')
    expect(id).toBeTruthy()

    // Um `aria-describedby` que aponta para o nada existe, não quebra nada e não é lido
    // por ninguém — a única asserção que pega isso é resolver o id no documento.
    const explicacao = document.getElementById(id as string)
    expect(explicacao).not.toBeNull()
    expect(explicacao?.textContent).toContain('não pode ser renomeado nem excluído')
    // ...e está no DOM visível, não em `title`/`sr-only` apenas.
    expect(screen.getByText(/não pode ser renomeado nem excluído/)).toBeInTheDocument()
  })

  it('🔴 o botão bloqueado continua ALCANÇÁVEL por Tab — travessia real', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">âncora fora da célula</button>
        {
          buildHourCreditReasonColumns({ onEdit: vi.fn(), onDelete: vi.fn() })
            .find((c) => c.key === 'acao')!
            .accessor(SEMEADO)
        }
      </>,
    )

    // Ancorado FORA da célula: `el.focus()` provaria só que o elemento PODE receber foco,
    // não que o usuário CHEGA nele. Trocar `aria-disabled` por `disabled` deixa este
    // teste vermelho — é ele que distingue as duas implementações.
    screen.getByRole('button', { name: 'âncora fora da célula' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Editar motivo/ }))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Excluir motivo/ }))
  })
})

describe('T-26 — fail-closed contra backend que não manda a flag', () => {
  it('🔴 `isSistema` AUSENTE também bloqueia', () => {
    // É este caso que impede o motivo semeado de virar apagável entre dois deploys.
    const { container } = renderAcao(SEM_CHAVE)
    expect(screen.getByRole('button', { name: /Excluir motivo Legado/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(container.textContent).toContain('não pode ser renomeado nem excluído')
  })

  it('🔴 `isSistema: null` EXPLÍCITO também bloqueia', () => {
    // O teste só com `undefined` passaria numa implementação `=== undefined` e não
    // discriminaria (`AP-FRONTEND-028`).
    expect(
      (renderAcao(NULO), screen.getByRole('button', { name: /Excluir motivo Outro/ })),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('companheira positiva: `isSistema: false` libera as DUAS ações, e o clique passa', async () => {
    // Sem este par, uma coluna que bloqueasse TUDO passaria em todos os asserts acima —
    // e a tela ficaria inerte, sem nenhum teste vermelho.
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const { container } = renderAcao(COMUM, { onEdit, onDelete })

    const editar = screen.getByRole('button', { name: 'Editar motivo Cortesia comercial' })
    const excluir = screen.getByRole('button', { name: 'Excluir motivo Cortesia comercial' })
    expect(editar).not.toHaveAttribute('aria-disabled')
    expect(excluir).not.toHaveAttribute('aria-disabled')
    // A explicação NÃO aparece para motivo comum (senão o assert de texto acima passaria
    // em qualquer linha).
    expect(container.textContent).not.toContain('não pode ser renomeado')

    await userEvent.click(editar)
    await userEvent.click(excluir)
    expect(onEdit).toHaveBeenCalledWith(COMUM)
    expect(onDelete).toHaveBeenCalledWith(COMUM)
  })

  it('cardinalidade assimétrica: 3 linhas bloqueadas × 1 livre', () => {
    // Num par 1×1 a inversão do predicado (`=== true`) passaria: o conjunto de botões
    // bloqueados teria o mesmo tamanho.
    const bloqueados = [SEMEADO, SEM_CHAVE, NULO, COMUM].map((row) => {
      const { container, unmount } = renderAcao(row)
      const bloqueado =
        container.querySelector('[aria-disabled="true"]') !== null
      unmount()
      return bloqueado
    })
    expect(bloqueados).toEqual([true, true, true, false])
  })
})

describe('colunas de leitura', () => {
  it('coluna Motivo mostra o texto COMPLETO — D15, tela GerentePlus', () => {
    const columns = buildHourCreditReasonColumns({ onEdit: vi.fn(), onDelete: vi.fn() })
    const { container } = render(<>{columns.find((c) => c.key === 'nome')!.accessor(SEMEADO)}</>)
    expect(container.textContent).toBe('Estorno de Credito Problema - Invoicy')
  })

  it('coluna Situação: "—" para desconhecido, "Ativo"/"Inativo" para o declarado', () => {
    const columns = buildHourCreditReasonColumns({ onEdit: vi.fn(), onDelete: vi.fn() })
    const situacao = columns.find((c) => c.key === 'situacao')!
    const casos: [HourCreditReasonDto, string][] = [
      [{ id: 9, nome: 'x', isActive: true }, 'Ativo'],
      [{ id: 9, nome: 'x', isActive: false }, 'Inativo'],
      [{ id: 9, nome: 'x', isActive: null }, '—'],
    ]
    for (const [row, esperado] of casos) {
      const { container, unmount } = render(<>{situacao.accessor(row)}</>)
      expect(container.textContent).toBe(esperado)
      unmount()
    }
  })
})
