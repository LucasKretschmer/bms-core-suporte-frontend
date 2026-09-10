import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { razaoDoTexto, reprovacoesAA, varrer } from '../../../test/medidor-de-contraste'
import { ReopenCompetenciaModal } from './ReopenCompetenciaModal'
import type { BillingPeriodDto } from '../types/billingPeriod'

const FECHADA: BillingPeriodDto = {
  competencia: '2026-08',
  estado: 'fechada',
  fechadaEm: '2026-09-01T03:00:00Z',
  fechadaPorNome: null,
  versao: 1,
  totalClientes: 42,
  totalHorasAdicionais: 12.5,
}

type Opcoes = {
  periodo?: BillingPeriodDto | null
  onConfirm?: (values: { motivo: string; confirmarImpactoEmCreditos: boolean }) => void
  onClose?: () => void
  erroDoServidor?: string | null
  isSubmitting?: boolean
}

function renderModal(opcoes: Opcoes = {}) {
  const onConfirm = opcoes.onConfirm ?? vi.fn()
  const onClose = opcoes.onClose ?? vi.fn()
  const utils = render(
    <>
      <button type="button">âncora fora do modal</button>
      <ReopenCompetenciaModal
        periodo={opcoes.periodo === undefined ? FECHADA : opcoes.periodo}
        onClose={onClose}
        onConfirm={onConfirm}
        isSubmitting={opcoes.isSubmitting ?? false}
        erroDoServidor={opcoes.erroDoServidor ?? null}
      />
    </>,
  )
  return { ...utils, onConfirm, onClose }
}

const botaoReabrir = () => screen.getByRole('button', { name: /reabrir competência/i })
const checkbox = () => screen.getByRole('checkbox')
const campoMotivo = () => screen.getByLabelText(/motivo da reabertura/i)

describe('ReopenCompetenciaModal — a confirmação de impacto (C-8)', () => {
  it('sem a confirmação marcada, o botão está `aria-disabled` e NENHUMA confirmação sai', async () => {
    // 🔴 O coração do C-8. Enviar sem confirmação devolveria `409` num laço que o usuário
    // não entende — e reabriria em silêncio o mês sem dependentes, sem ninguém ter lido o
    // aviso. Quem garante que nada sai é o SCHEMA, não o atributo do botão: por isso o
    // teste clica de verdade em vez de só olhar o atributo.
    const user = userEvent.setup()
    const { onConfirm } = renderModal()

    await user.type(campoMotivo(), 'Fatura corrigida pelo financeiro')
    expect(botaoReabrir()).toHaveAttribute('aria-disabled', 'true')

    await user.click(botaoReabrir())

    expect(onConfirm).not.toHaveBeenCalled()
    expect(
      await screen.findByText('Confirme que leu o impacto sobre os créditos para poder reabrir.'),
    ).toBeInTheDocument()
  })

  it('com a confirmação marcada, o corpo leva `confirmarImpactoEmCreditos: true`', async () => {
    // A companheira positiva do caso acima, na mesma suíte: sem ela, "não chamou"
    // passaria com o formulário quebrado.
    const user = userEvent.setup()
    const { onConfirm } = renderModal()

    await user.type(campoMotivo(), 'Fatura corrigida pelo financeiro')
    await user.click(checkbox())
    expect(botaoReabrir()).not.toHaveAttribute('aria-disabled')

    await user.click(botaoReabrir())

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1))
    expect(onConfirm).toHaveBeenCalledWith({
      motivo: 'Fatura corrigida pelo financeiro',
      confirmarImpactoEmCreditos: true,
    })
  })

  it('motivo curto reprova inline e não envia nada', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderModal()

    await user.type(campoMotivo(), 'ab')
    await user.click(checkbox())
    await user.click(botaoReabrir())

    expect(await screen.findByText(/pelo menos 3 caracteres/i)).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('o botão bloqueado continua alcançável e ANUNCIA o motivo do bloqueio', () => {
    // `disabled` nativo tiraria o botão do `Tab` e do leitor de tela: quem navega por
    // teclado nunca saberia por que não consegue reabrir.
    renderModal()
    const botao = botaoReabrir()
    expect(botao).not.toBeDisabled()
    const descrito = botao.getAttribute('aria-describedby')
    expect(descrito).not.toBeNull()
    expect(document.getElementById(descrito ?? '')?.textContent).toContain(
      'marque a confirmação de impacto',
    )
  })
})

describe('ReopenCompetenciaModal — o que ele AFIRMA (C-8)', () => {
  /**
   * 🔴 O texto é lido do NÓ DO DIÁLOGO, não do `container` do `render`: o `Modal` monta
   * num **portal** para o `document.body`, então o `container` contém só a âncora — e uma
   * asserção negativa sobre ele passaria por vacuidade, medindo a árvore errada. Cada bloco
   * abaixo tem a companheira positiva justamente para reprovar nesse caso (foi o que
   * aconteceu na primeira execução deste arquivo).
   */
  const textoDoDialogo = () => screen.getByRole('dialog').textContent ?? ''

  it('diz que reabrir não altera crédito e que o divergente só é REPORTADO', () => {
    renderModal()
    expect(textoDoDialogo()).toContain('não altera nenhum crédito já concedido')
    expect(textoDoDialogo()).toContain('marcados na tela de Créditos')
    // A negativa que a decisão exige — com a positiva acima na mesma execução.
    expect(textoDoDialogo()).not.toMatch(/corrigid[oa]s? automaticamente/i)
    expect(textoDoDialogo()).not.toMatch(/ajustad[oa]s? automaticamente/i)
  })

  it('sem a contagem do servidor, NÃO afirma "nenhum crédito"', () => {
    // `creditosDependentes` ausente **e** `null` explícito são o mesmo fato: desconhecido.
    for (const periodo of [FECHADA, { ...FECHADA, creditosDependentes: null }]) {
      const { unmount } = renderModal({ periodo })
      expect(textoDoDialogo()).toContain('não sabe quantos créditos')
      expect(textoDoDialogo()).not.toMatch(/0 créditos/)
      unmount()
    }
  })

  it('com a contagem do servidor, exibe o NÚMERO — inclusive o zero', () => {
    const tres = renderModal({ periodo: { ...FECHADA, creditosDependentes: 3 } })
    expect(textoDoDialogo()).toContain('3 créditos vivos foram gerados')
    tres.unmount()

    // Zero informado pelo servidor é um fato — e é diferente de não saber.
    renderModal({ periodo: { ...FECHADA, creditosDependentes: 0 } })
    expect(textoDoDialogo()).toContain('0 créditos')
    expect(textoDoDialogo()).not.toContain('não sabe quantos')
  })
})

describe('ReopenCompetenciaModal — o 409 é estado de negócio', () => {
  it('o erro do servidor aparece DENTRO do diálogo, com role="alert"', () => {
    // O 409 traz a CONTAGEM de créditos dependentes: um toast que fecha a tela esconderia
    // exatamente a informação que resolve o problema (`rules/api.md`).
    renderModal({ erroDoServidor: '3 créditos vivos dependem desta competência. Marque a confirmação.' })

    const alerta = screen.getByRole('alert')
    expect(alerta).toHaveTextContent('3 créditos vivos dependem desta competência.')
    // O diálogo continua aberto e operável — este é o ponto.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(campoMotivo()).toBeInTheDocument()
  })

  it('sem erro do servidor, não há alerta nenhum', () => {
    renderModal()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ReopenCompetenciaModal — foco', () => {
  it('`periodo: null` não renderiza nada', () => {
    renderModal({ periodo: null })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('o foco fica PRESO no diálogo — travessia circular nos dois sentidos', async () => {
    // A prova de que o trap existe não é a travessia feliz (que a ordem natural do
    // documento também satisfaz), é a CIRCULAR: do último volta ao primeiro e vice-versa
    // (`AP-FRONTEND-027`).
    const user = userEvent.setup()
    renderModal()

    const dialog = screen.getByRole('dialog')
    const focaveis = Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea'),
    )
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    expect(primeiro).toHaveAttribute('aria-label', 'Fechar modal')

    ultimo.focus()
    await user.tab()
    expect(document.activeElement).toBe(primeiro)

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(ultimo)
  })
})

describe('ReopenCompetenciaModal — contraste medido no DOM', () => {
  it('nem o aviso de impacto nem o erro do servidor reprovam 4,5:1', () => {
    // ⚠️ `AP-FRONTEND-030`: o medidor trunca o texto do nó em **60 caracteres**, e os
    // textos deste diálogo são longos. Por isso cada asserção usa o PREFIXO, e usa
    // `razaoDoTexto` — a única função da família que LANÇA quando não encontra o nó.
    // `reprovacoesAA` sozinho passaria medindo zero elementos.
    renderModal({ erroDoServidor: '3 créditos vivos dependem desta competência.' })

    const { medidas, pulados } = varrer(document.body)

    expect(pulados).toEqual([])
    expect(reprovacoesAA(medidas)).toEqual([])
    expect(razaoDoTexto(medidas, 'Reabrir não altera nenhum crédito')).toBeGreaterThanOrEqual(4.5)
    expect(razaoDoTexto(medidas, '3 créditos vivos dependem')).toBeGreaterThanOrEqual(4.5)
    expect(razaoDoTexto(medidas, 'Li o impacto acima')).toBeGreaterThanOrEqual(4.5)
    expect(razaoDoTexto(medidas, 'Reabrir competência')).toBeGreaterThanOrEqual(4.5)
  })
})
