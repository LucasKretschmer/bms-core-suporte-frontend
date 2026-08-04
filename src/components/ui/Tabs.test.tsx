/**
 * `Tabs` — padrão WAI-ARIA de abas com ativação manual.
 *
 * A acessibilidade aqui é provada por **travessia real de teclado**
 * (`rules/frontend.md` § "Acessibilidade de teclado só se prova com travessia de
 * `Tab`"): `el.focus(); expect(el).toHaveFocus()` afirmaria apenas "este elemento pode
 * receber foco", que não é a pergunta. O defeito mora nas paradas vizinhas — a aba
 * inativa precisa ficar FORA do fluxo de `Tab` e ser alcançada por ←/→.
 *
 * 121/F1 — e a mesma assimetria vale para IDREF: `aria-controls` da aba ATIVA resolvia,
 * o da INATIVA apontava para `null`. Por isso o teste de `aria-controls` aqui **itera
 * todas as abas** e trava a cardinalidade do conjunto: asserir só o par ativo prova
 * metade, e é a metade que já passava.
 */

import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs } from './Tabs'
import type { TabItem } from './Tabs'
import { tabId, tabPanelId } from './tabsIds'

type Id = 'um' | 'dois' | 'tres'

const ITENS: TabItem<Id>[] = [
  { id: 'um', label: 'Um' },
  { id: 'dois', label: 'Dois', badge: 3 },
  { id: 'tres', label: 'Três' },
]

const BASE_ID = 'teste'

function Controlado({ onChange }: { onChange?: (id: Id) => void }) {
  const [value, setValue] = useState<Id>('um')
  return (
    <>
      {/* Âncora FORA do componente: a travessia de Tab começa daqui, nunca de um
          elemento que o próprio componente possa reconciliar. */}
      <button type="button">ancora</button>
      <Tabs<Id>
        items={ITENS}
        value={value}
        onChange={(id) => {
          setValue(id)
          onChange?.(id)
        }}
        label="Seções"
        baseId={BASE_ID}
      />
      {/* Contrato do `Tabs` (121/F1): um painel por aba, o inativo VAZIO + `hidden` e
          sem classe de `display`. É a forma que o componente documenta. */}
      {ITENS.map((item) =>
        item.id === value ? (
          <div
            key={item.id}
            role="tabpanel"
            id={tabPanelId(BASE_ID, item.id)}
            aria-labelledby={tabId(BASE_ID, item.id)}
          >
            conteúdo de {value}
          </div>
        ) : (
          <div
            key={item.id}
            role="tabpanel"
            hidden
            id={tabPanelId(BASE_ID, item.id)}
            aria-labelledby={tabId(BASE_ID, item.id)}
          />
        ),
      )}
    </>
  )
}

/**
 * Para CADA aba do tablist: `aria-controls` presente e resolvendo num `tabpanel` real,
 * cujo `aria-labelledby` volta para a própria aba. Devolve quantas abas foram checadas
 * — a asserção de cardinalidade impede que o laço passe vazio.
 */
function conferirTodosOsAriaControls(): number {
  const abas = screen.getAllByRole('tab')
  for (const aba of abas) {
    const idPainel = aba.getAttribute('aria-controls')
    expect(idPainel, `aba "${aba.textContent ?? ''}" sem aria-controls`).toBeTruthy()
    const painel = document.getElementById(idPainel!)
    expect(
      painel,
      `aria-controls="${idPainel}" da aba "${aba.textContent ?? ''}" não resolve no DOM`,
    ).not.toBeNull()
    expect(painel!.getAttribute('role')).toBe('tabpanel')
    expect(painel!.getAttribute('aria-labelledby')).toBe(aba.id)
  }
  return abas.length
}

describe('Tabs — semântica ARIA', () => {
  it('tablist tem nome acessível e as abas expõem aria-selected', () => {
    render(<Controlado />)

    expect(screen.getByRole('tablist', { name: 'Seções' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Um/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /Dois/ })).toHaveAttribute('aria-selected', 'false')
  })

  it('aria-controls da aba ativa aponta para o id REAL do painel montado', () => {
    render(<Controlado />)

    const aba = screen.getByRole('tab', { name: /Um/ })
    const idPainel = aba.getAttribute('aria-controls')!
    // Se o `baseId` fosse interno (useId), este elemento não existiria — e nenhum
    // teste de renderização pegaria a referência quebrada.
    // `getByRole('tabpanel')` acha só o visível: os inativos têm `hidden` e ficam fora
    // da árvore de acessibilidade.
    expect(document.getElementById(idPainel)).toBe(screen.getByRole('tabpanel'))
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', aba.id)
  })

  it('TODA aba — inclusive as inativas — tem aria-controls que resolve no DOM (F1)', () => {
    render(<Controlado />)

    // Era exatamente aqui que o defeito morava: a inativa apontava para
    // "…-panel-postergado", id que não existia. Cardinalidade travada para o laço não
    // passar vazio.
    expect(conferirTodosOsAriaControls()).toBe(3)
  })

  it('o aria-controls continua resolvendo para todas as abas DEPOIS de trocar de aba', async () => {
    render(<Controlado />)

    await userEvent.click(screen.getByRole('tab', { name: /Três/ }))

    expect(screen.getByRole('tab', { name: /Três/ })).toHaveAttribute('aria-selected', 'true')
    expect(conferirTodosOsAriaControls()).toBe(3)
  })

  it('o badge é exibido dentro da própria aba', () => {
    render(<Controlado />)
    const aba = screen.getByRole('tab', { name: /Dois/ })
    expect(aba).toHaveTextContent('Dois')
    expect(aba).toHaveTextContent('3')
  })

  it('badge `null` é AUSÊNCIA, não o texto "null" (121/F4 — o total vem do backend)', () => {
    const itens: TabItem<Id>[] = [
      { id: 'um', label: 'Um', badge: null },
      { id: 'dois', label: 'Dois', badge: 0 },
      { id: 'tres', label: 'Três' },
    ]
    render(
      <Tabs<Id> items={itens} value="um" onChange={vi.fn()} label="Seções" baseId={BASE_ID} />,
    )

    expect(screen.getByRole('tab', { name: /Um/ })).not.toHaveTextContent('null')
    // Companheira POSITIVA: `0` é um total de verdade e continua aparecendo — sem ela,
    // "não escreve null" passaria com um componente que nunca escreve badge nenhum.
    expect(screen.getByRole('tab', { name: /Dois/ })).toHaveTextContent('0')
  })
})

describe('Tabs — travessia de teclado', () => {
  it('apenas a aba SELECIONADA está no fluxo de Tab (as outras têm tabIndex -1)', async () => {
    render(<Controlado />)

    screen.getByRole('button', { name: 'ancora' }).focus()
    await userEvent.tab()
    expect(screen.getByRole('tab', { name: /Um/ })).toHaveFocus()

    // O próximo Tab SAI do tablist — não visita "Dois" nem "Três".
    await userEvent.tab()
    expect(screen.getByRole('tab', { name: /Dois/ })).not.toHaveFocus()
    expect(screen.getByRole('tab', { name: /Três/ })).not.toHaveFocus()
  })

  it('→ e ← movem entre abas, com wrap nas duas pontas', async () => {
    const onChange = vi.fn()
    render(<Controlado onChange={onChange} />)

    screen.getByRole('button', { name: 'ancora' }).focus()
    await userEvent.tab()

    await userEvent.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('dois')
    expect(screen.getByRole('tab', { name: /Dois/ })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    // 'tres' → wrap para 'um'
    expect(onChange).toHaveBeenLastCalledWith('um')
    expect(screen.getByRole('tab', { name: /Um/ })).toHaveFocus()

    await userEvent.keyboard('{ArrowLeft}')
    // wrap para trás
    expect(onChange).toHaveBeenLastCalledWith('tres')
    expect(screen.getByRole('tab', { name: /Três/ })).toHaveFocus()
  })

  it('Home e End vão para a primeira e a última aba', async () => {
    const onChange = vi.fn()
    render(<Controlado onChange={onChange} />)

    screen.getByRole('button', { name: 'ancora' }).focus()
    await userEvent.tab()

    await userEvent.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('tres')
    expect(screen.getByRole('tab', { name: /Três/ })).toHaveFocus()

    await userEvent.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('um')
    expect(screen.getByRole('tab', { name: /Um/ })).toHaveFocus()
  })

  it('clique troca o painel exibido', async () => {
    render(<Controlado />)

    await userEvent.click(screen.getByRole('tab', { name: /Dois/ }))

    expect(screen.getByRole('tabpanel')).toHaveTextContent('conteúdo de dois')
    expect(screen.getByRole('tab', { name: /Dois/ })).toHaveAttribute('aria-selected', 'true')
  })
})
