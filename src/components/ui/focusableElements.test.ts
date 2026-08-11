/**
 * Testes de `focaveisDentro` — a definição de "focável" compartilhada pelo trap do `Modal`
 * (121/F2) e pela sentinela de foco do preview de PDF (121/F-28 · D21).
 *
 * A trava mora aqui, ao lado do mecanismo, e não só nos consumidores: a exclusão por
 * `aria-hidden` é o que mantém a sentinela FORA do ciclo do `Tab`, e a inclusão de
 * `iframe` é o que faz o iframe ser o último focável do modal de preview. Se alguém
 * mexer no seletor sem saber disso, é este arquivo que reprova primeiro.
 */

import { describe, expect, it, afterEach } from 'vitest'
import { focaveisDentro } from './focusableElements'

function montar(html: string): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.appendChild(container)
  return container
}

function rotulos(els: HTMLElement[]): string[] {
  return els.map((el) => el.getAttribute('data-id') ?? el.tagName.toLowerCase())
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('focaveisDentro', () => {
  it('devolve os focáveis em ORDEM DE DOCUMENTO, incluindo iframe', () => {
    const container = montar(`
      <button data-id="b1">um</button>
      <iframe data-id="frame" title="preview"></iframe>
      <a data-id="link" href="#x">dois</a>
      <input data-id="campo" />
    `)

    // Ordem inteira: é ela que define quem é o "primeiro" e o "último" do trap.
    expect(rotulos(focaveisDentro(container))).toEqual(['b1', 'frame', 'link', 'campo'])
  })

  it('exclui `[tabindex="-1"]`, `[disabled]` e `input[type=hidden]`', () => {
    const container = montar(`
      <button data-id="ok">ok</button>
      <button data-id="fora" tabindex="-1">fora do ciclo</button>
      <button data-id="desabilitado" disabled>desabilitado</button>
      <input data-id="oculto" type="hidden" />
    `)

    expect(rotulos(focaveisDentro(container))).toEqual(['ok'])
  })

  it('exclui a SUBÁRVORE de `[hidden]` e de `aria-hidden="true"`', () => {
    const container = montar(`
      <button data-id="ok">ok</button>
      <div hidden><button data-id="dentro-do-hidden">x</button></div>
      <div aria-hidden="true"><button data-id="dentro-do-aria-hidden">x</button></div>
    `)

    expect(rotulos(focaveisDentro(container))).toEqual(['ok'])
  })

  it('exclui o PRÓPRIO elemento com `aria-hidden="true"` — é o que tira a sentinela de foco do ciclo', () => {
    // Forma exata da sentinela do `ClientReportPdf`: tabulável para o navegador,
    // invisível para o trap. Se esta asserção cair, o `Shift+Tab` do primeiro focável do
    // modal de preview passa a parar na sentinela em vez de alcançar o iframe.
    const container = montar(`
      <button data-id="fechar">Fechar modal</button>
      <iframe data-id="frame" title="preview"></iframe>
      <div data-id="sentinela" tabindex="0" aria-hidden="true"></div>
    `)

    const focaveis = focaveisDentro(container)
    expect(rotulos(focaveis)).toEqual(['fechar', 'frame'])
    // O último é o iframe, não a sentinela — identidade, não contagem.
    expect(focaveis[focaveis.length - 1]).toBe(container.querySelector('[data-id="frame"]'))
  })

  it('devolve lista vazia quando não há nada focável (o trap depende disso)', () => {
    const container = montar('<p>somente texto</p>')
    expect(focaveisDentro(container)).toEqual([])
  })
})
