/**
 * Testes do `useReturnFocus` — devolução do foco ao gatilho (§5.3).
 *
 * ORIGEM (122/CONSOL-1): os 5 primeiros casos são herdados, sem afrouxamento, do
 * `dashboards/shared/hooks/useTriggerFocusReturn.test.tsx` (A11Y-3) — só os nomes dos
 * métodos mudaram na unificação (`captureTrigger`→`capture`, `restoreFocus`→`restore`).
 * Os 2 últimos cobrem `release`/`adopt`, que vieram do `ticket-detail` (A11Y-2) e lá só
 * tinham cobertura comportamental de página.
 *
 * Contra os padrões que passam nos dois mundos:
 *  - **identidade, nunca ausência**: o assert é sobre O NÓ capturado antes de abrir
 *    (`expect(gatilho).toHaveFocus()`), nunca "não é o body";
 *  - **discriminador na mesma execução**: entre capturar e devolver, o foco vai para
 *    outro elemento e isso é asseverado — sem isso o teste passaria num mundo em que o
 *    foco NUNCA saiu do gatilho e a devolução não faz nada;
 *  - **espião que registra** (não `activeElement`) onde o jsdom não modela o efeito —
 *    ver os comentários dos casos 3 e 4;
 *  - o caso do gatilho SVG existe porque foi ele que ditou o tipo aceito pelo hook:
 *    com um guarda `instanceof HTMLElement`, a fatia de gráfico seria descartada em
 *    silêncio (ver docstring do hook).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReturnFocus, type FocusableNode } from './useReturnFocus'

/** DOM de apoio: um gatilho HTML, um gatilho SVG e um "outro lugar" para o foco ir. */
function montarDom() {
  document.body.innerHTML = `
    <div id="kpi" role="button" tabindex="0"><span id="kpi-filho">12</span></div>
    <svg id="grafico">
      <g id="fatia" tabindex="-1"></g>
    </svg>
    <button id="dentro-do-modal">Fechar modal</button>
    <button id="removivel" type="button">gatilho que some</button>
  `
  const buscar = <T extends Element>(id: string): T => {
    const el = document.getElementById(id)
    if (!el) throw new Error(`elemento #${id} não montado`)
    return el as unknown as T
  }
  return {
    kpi: buscar<HTMLElement>('kpi'),
    fatia: buscar<SVGElement>('fatia'),
    dentroDoModal: buscar<HTMLElement>('dentro-do-modal'),
    removivel: buscar<HTMLElement>('removivel'),
  }
}

describe('useReturnFocus', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('devolve o foco AO MESMO nó HTML que estava focado na abertura', async () => {
    const { kpi, dentroDoModal } = montarDom()
    const { result } = renderHook(() => useReturnFocus())

    kpi.focus()
    expect(kpi).toHaveFocus() // pré-condição: o gatilho está focado
    act(() => result.current.capture())

    // Discriminador na MESMA execução: o foco sai do gatilho (é o que o modal faz).
    dentroDoModal.focus()
    expect(dentroDoModal).toHaveFocus()
    expect(kpi).not.toHaveFocus()

    act(() => result.current.restore())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })

    expect(kpi).toHaveFocus()
    expect(document.activeElement).toBe(kpi)
  })

  it('devolve o foco a um gatilho SVG (fatia de gráfico Recharts, tabindex="-1")', async () => {
    const { fatia, dentroDoModal } = montarDom()
    const { result } = renderHook(() => useReturnFocus())

    fatia.focus()
    expect(fatia).toHaveFocus()
    act(() => result.current.capture())

    dentroDoModal.focus()
    expect(fatia).not.toHaveFocus()

    act(() => result.current.restore())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })

    // Identidade: é o nó SVG, não um vizinho HTML e não o body.
    expect(document.activeElement).toBe(fatia)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('NÃO devolve o foco quando não havia gatilho (foco no body na abertura)', async () => {
    const { dentroDoModal } = montarDom()
    const { result } = renderHook(() => useReturnFocus())

    // ⚠️ Aqui NÃO basta asseverar "o foco ficou onde estava": no jsdom
    // `document.body.focus()` é NO-OP, então "guardar o body como gatilho" e "não
    // guardar nada" produzem exatamente o mesmo activeElement — a asserção seria
    // INERTE (medido: a mutação `HOOK-ACEITA-BODY` passava 5/5 antes deste espião).
    // O que discrimina é observar a CHAMADA, com espião que registra.
    const espiaoBodyFocus = vi.spyOn(document.body, 'focus')

    // Ninguém focado: activeElement é o body.
    expect(document.activeElement).toBe(document.body)
    act(() => result.current.capture())

    dentroDoModal.focus()
    act(() => result.current.restore())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })

    // O mecanismo não faz nada: nem tenta focar o body (devolver o foco ao `body`
    // seria fingir atendimento do requisito), e o foco fica onde estava.
    expect(espiaoBodyFocus).not.toHaveBeenCalled()
    expect(dentroDoModal).toHaveFocus()

    // CONTROLE POSITIVO do espião: ausência de chamada só prova algo se o ponto
    // observado for alcançável. Provamos que este espião registra de fato.
    document.body.focus()
    expect(espiaoBodyFocus).toHaveBeenCalledTimes(1)
    espiaoBodyFocus.mockRestore()
  })

  it('não lança nem move o foco quando o gatilho saiu do DOM antes da devolução', async () => {
    const { removivel, dentroDoModal } = montarDom()
    const { result } = renderHook(() => useReturnFocus())

    removivel.focus()
    act(() => result.current.capture())

    dentroDoModal.focus()
    removivel.remove() // seção re-renderizou enquanto o modal estava aberto

    // ⚠️ Mesmo motivo do caso do body: no jsdom `.focus()` num nó DESTACADO é no-op,
    // então "com guarda" e "sem guarda" dariam o mesmo activeElement e a asserção seria
    // INERTE (medido: a mutação `HOOK-SEM-CONTAINS` passava 5/5 antes deste espião).
    const espiaoFocus = vi.spyOn(removivel, 'focus')

    act(() => result.current.restore())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })

    expect(espiaoFocus).not.toHaveBeenCalled()
    expect(dentroDoModal).toHaveFocus()

    // CONTROLE POSITIVO: o espião registra de fato — a ausência acima significa algo.
    removivel.focus()
    expect(espiaoFocus).toHaveBeenCalledTimes(1)
    espiaoFocus.mockRestore()
  })

  it('esquece o gatilho após devolver (uma devolução por abertura)', async () => {
    const { kpi, dentroDoModal } = montarDom()
    const { result } = renderHook(() => useReturnFocus())

    kpi.focus()
    act(() => result.current.capture())
    dentroDoModal.focus()
    act(() => result.current.restore())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    expect(kpi).toHaveFocus()

    // Segunda chamada SEM captura nova: não pode "ressuscitar" o gatilho antigo.
    dentroDoModal.focus()
    act(() => result.current.restore())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })
    expect(dentroDoModal).toHaveFocus()
  })

  // ── `release`/`adopt` (encadeamento de overlays — origem A11Y-2) ────────────────

  it('release() entrega o gatilho e ESQUECE — quem soltou não devolve mais o foco', async () => {
    const { kpi, dentroDoModal } = montarDom()
    const { result } = renderHook(() => useReturnFocus())

    kpi.focus()
    act(() => result.current.capture())

    const solto: { valor: FocusableNode | null } = { valor: null }
    act(() => {
      solto.valor = result.current.release()
    })
    // IDENTIDADE do nó entregue — não basta "não é null".
    expect(solto.valor).toBe(kpi)

    // Discriminador: o foco está longe do gatilho quando `restore()` é chamado.
    dentroDoModal.focus()
    const espiaoKpiFocus = vi.spyOn(kpi, 'focus')
    act(() => result.current.restore())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })

    // Soltou ⇒ não é mais dono do foco. Espião (e não `activeElement`) porque o kpi
    // segue no DOM: um `focus()` indevido aqui MOVERIA o foco, e queremos flagrar a
    // TENTATIVA, não só o resultado.
    expect(espiaoKpiFocus).not.toHaveBeenCalled()
    expect(dentroDoModal).toHaveFocus()

    // CONTROLE POSITIVO do espião.
    kpi.focus()
    expect(espiaoKpiFocus).toHaveBeenCalledTimes(1)
    espiaoKpiFocus.mockRestore()
  })

  it('adopt() assume o gatilho de outro fluxo — inclusive um nó SVG', async () => {
    const { fatia, kpi, dentroDoModal } = montarDom()
    const { result: primeiro } = renderHook(() => useReturnFocus())
    const { result: segundo } = renderHook(() => useReturnFocus())

    // O primeiro overlay foi aberto pela fatia do gráfico…
    fatia.focus()
    act(() => primeiro.current.capture())

    // …e, dentro dele, abriu-se o segundo: o gatilho ORIGINAL é transferido.
    kpi.focus() // botão de dentro do 1º overlay — some junto com ele
    act(() => segundo.current.adopt(primeiro.current.release()))

    dentroDoModal.focus()
    expect(fatia).not.toHaveFocus()

    act(() => segundo.current.restore())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5))
    })

    // Identidade: volta à FATIA (gatilho original), não ao botão intermediário.
    expect(document.activeElement).toBe(fatia)
    expect(document.activeElement).not.toBe(kpi)
  })
})
