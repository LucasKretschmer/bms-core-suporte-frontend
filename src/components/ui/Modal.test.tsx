/**
 * Testes do Modal — as adições da 096 (tamanho 'fullscreen' e backdrop com blur opt-in)
 * e o **trap de foco** da 121/F2.
 *
 * O trap é provado por TRAVESSIA REAL de `Tab`, ancorada num botão FORA do modal, com a
 * sequência inteira asseverada nas duas direções (`rules/frontend.md` § "Acessibilidade
 * de teclado só se prova com travessia de `Tab`" / AP-QA-007). `el.focus()` responderia
 * "este elemento pode receber foco", que não é a pergunta: a pergunta é se o `Tab`
 * **sai** do dialog — e saía. A medição do QA foi
 * `["Fechar modal", "Conferir exceções…", "BODY"]`, com o foco pousando no gatilho
 * ATRÁS do overlay.
 *
 * ⚠️ As duas metades do requisito de §5.3 ("foco preso **e** devolve ao gatilho") têm
 * donos diferentes: a prisão é do `Modal` (aqui); a devolução é de quem abre e está
 * provada no consumidor (`BillingExceptionsCard.test.tsx`).
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

/** Rótulo estável do elemento focado — é a sequência que o teste compara. */
function foco(): string {
  const el = document.activeElement
  if (!el || el === document.body) return 'BODY'
  if (el.getAttribute('role') === 'dialog') return 'DIALOG'
  const nome = el.getAttribute('aria-label') ?? el.textContent ?? ''
  return `${el.tagName.toLowerCase()}:${nome.trim()}`
}

/** Travessia real: N `Tab` (ou `Shift+Tab`), coletando cada parada. */
async function sequenciaTab(passos: number, shift = false): Promise<string[]> {
  const seq: string[] = []
  for (let i = 0; i < passos; i += 1) {
    await userEvent.tab({ shift })
    seq.push(foco())
  }
  return seq
}

/**
 * Modal com 3 focáveis no corpo + um `[tabindex="-1"]` (a forma exata da aba inativa do
 * `Tabs`, que precisa ficar FORA do ciclo) + a âncora externa.
 */
function ComTrap({ semTitulo = false }: { semTitulo?: boolean }) {
  return (
    <>
      <button type="button">ancora</button>
      <Modal isOpen onClose={vi.fn()} title={semTitulo ? undefined : 'Conferência'}>
        <input aria-label="campo" />
        <button type="button">Salvar</button>
        <button type="button" tabIndex={-1}>
          fora do ciclo
        </button>
        <a href="#destino">link</a>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('aplica dimensões 92vw × 92vh no tamanho fullscreen', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Preview" size="fullscreen">
        <div>conteúdo</div>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    const content = dialog.querySelector('.bg-white') as HTMLElement
    expect(content.className).toContain('w-[92vw]')
    expect(content.className).toContain('h-[92vh]')
    expect(content.className).toContain('max-w-[92vw]')
    expect(content.className).toContain('max-h-[92vh]')
  })

  it('usa backdrop-blur-sm por padrão', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="X">
        <div>c</div>
      </Modal>,
    )
    const overlay = screen.getByRole('dialog').querySelector('[aria-hidden="true"]') as HTMLElement
    expect(overlay.className).toContain('backdrop-blur-sm')
  })

  it('usa backdrop-blur-md quando backdropBlur="lg" (opt-in)', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="X" backdropBlur="lg">
        <div>c</div>
      </Modal>,
    )
    const overlay = screen.getByRole('dialog').querySelector('[aria-hidden="true"]') as HTMLElement
    expect(overlay.className).toContain('backdrop-blur-md')
  })

  it('não renderiza quando isOpen=false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()} title="X">
        <div>c</div>
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Modal — trap de foco (121/F2)', () => {
  it('o foco ENTRA no modal ao abrir, no botão de fechar', () => {
    render(<ComTrap />)
    expect(screen.getByRole('button', { name: 'Fechar modal' })).toHaveFocus()
  })

  it('sem título (logo, sem botão de fechar) o foco vai ao PRIMEIRO focável do corpo', () => {
    render(<ComTrap semTitulo />)
    expect(screen.queryByRole('button', { name: 'Fechar modal' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('campo')).toHaveFocus()
  })

  it('Tab circula: do último volta ao primeiro, e a âncora externa nunca é visitada', async () => {
    render(<ComTrap />)

    // Sequência INTEIRA, não "o próximo é X": o defeito mora nas paradas vizinhas.
    // "fora do ciclo" tem tabindex="-1" e não aparece — é a forma da aba inativa do `Tabs`.
    expect(await sequenciaTab(4)).toEqual([
      'input:campo',
      'button:Salvar',
      'a:link',
      'button:Fechar modal',
    ])
  })

  it('Shift+Tab do PRIMEIRO vai ao ÚLTIMO — nunca ao gatilho atrás do overlay', async () => {
    render(<ComTrap />)

    // Medição do QA antes da correção: ["Fechar modal","Conferir exceções…","BODY"].
    // O primeiro passo é o que reprovava: saía para a âncora e depois para o BODY.
    // A volta completa fecha o ciclo no botão de fechar, sem visitar "fora do ciclo"
    // (`tabindex="-1"`) nem a âncora externa em nenhum passo.
    expect(await sequenciaTab(4, true)).toEqual([
      'a:link',
      'button:Salvar',
      'input:campo',
      'button:Fechar modal',
    ])
  })

  it('modal sem nenhum focável mantém o foco no contêiner em vez de vazar', async () => {
    render(
      <>
        <button type="button">ancora</button>
        <Modal isOpen onClose={vi.fn()}>
          <p>somente texto</p>
        </Modal>
      </>,
    )

    expect(foco()).toBe('DIALOG')
    expect(await sequenciaTab(2)).toEqual(['DIALOG', 'DIALOG'])
  })

  it('Escape continua fechando mesmo com o foco fora do dialog (listener no documento)', async () => {
    const onClose = vi.fn()
    render(
      <>
        <button type="button">ancora</button>
        <Modal isOpen onClose={onClose} title="Conferência">
          <button type="button">Salvar</button>
        </Modal>
      </>,
    )

    // Simula o foco escorregando para o `body` (clique no overlay, nó removido):
    // com o listener preso ao dialog, o Escape deixaria de fechar.
    ;(document.activeElement as HTMLElement).blur()
    expect(foco()).toBe('BODY')

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
