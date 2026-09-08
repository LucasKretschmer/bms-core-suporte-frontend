import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { getPercentClass, planConsumptionColumns } from './columns'
import type { PlanConsumptionItemDto } from '../shared/types/reports'

/**
 * 129/FE-PCT — "chave AUSENTE" ≠ "chave nula".
 *
 * O backend serializa com `DefaultIgnoreCondition = WhenWritingNull` (`Program.cs:210-215`),
 * então `Cnpj`/`PercentualPlano` (`string?`/`decimal?`, `ReportsDtos.cs:174,183`) **não chegam
 * como `null`: a chave simplesmente não vem**. O guard antigo era `value === null`, que é falso
 * para `undefined` — e como toda comparação `undefined < n` também é falsa, a função caía até o
 * `return 'red'`. Resultado em produção: **a tela que decide faturamento pintava de vermelho
 * ("estourou o plano") um cliente cujo percentual é DESCONHECIDO.**
 *
 * ⚠️ O teste com `null` PASSA NOS DOIS MUNDOS (`=== null` e `== null` concordam) — foi
 * exatamente ele que deixou o defeito entrar. Por isso o par ausente/nulo roda aqui na
 * MESMA execução, com discriminador de fixture, e a vítima é a **tabela renderizada**.
 */

/** Classes literais escritas à mão — não derivadas de `percentColorClasses`. */
const CLASSE_NEUTRA = 'text-foreground'
const CLASSE_VERMELHA = 'text-error-fg'

/** Índices das colunas na `planConsumptionColumns` (ordem travada por `columns.test.ts`). */
const COL_CNPJ = 0
const COL_PERCENTUAL = 8

const base = {
  clientId: 1,
  nomeFantasia: 'Cliente Alfa',
  razaoSocial: 'Cliente Alfa LTDA',
  nomePlano: 'Plano 10h',
  qtdePlanoHoras: 10,
  horasUsadas: 3,
  horasRestantes: 7,
  horasAdicionais: 0,
  horasFaturaveis: 3,
  horasAnalise: 0,
}

/** Como a linha chega do wire quando o backend omite as duas chaves. */
const semChaveNoWire: PlanConsumptionItemDto = { ...base }

/** O irmão que passava nos dois mundos: as chaves existem, valendo `null`. */
const comChaveNula: PlanConsumptionItemDto = {
  ...base,
  cnpj: null,
  percentualPlano: null,
}

/** Controle positivo: percentual conhecido e estourado — este SIM é vermelho. */
const estourado: PlanConsumptionItemDto = {
  ...base,
  cnpj: '12345678000195',
  percentualPlano: 120,
}

function celulas(row: PlanConsumptionItemDto): HTMLTableCellElement[] {
  const { container } = render(
    <DataTable tableId="plan-consumption-teste" columns={planConsumptionColumns} data={[row]} />,
  )
  return Array.from(container.querySelectorAll<HTMLTableCellElement>('tbody tr td'))
}

describe('129/FE-PCT — os fixtures discriminam ausente × nulo', () => {
  it('`semChaveNoWire` NÃO tem as chaves; `comChaveNula` tem, valendo null', () => {
    // Sem isto, alguém "conserta" o fixture pondo `cnpj: null` e o par volta a
    // passar nos dois mundos, em silêncio.
    expect(Object.hasOwn(semChaveNoWire, 'percentualPlano')).toBe(false)
    expect(Object.hasOwn(semChaveNoWire, 'cnpj')).toBe(false)
    expect(Object.hasOwn(comChaveNula, 'percentualPlano')).toBe(true)
    expect(Object.hasOwn(comChaveNula, 'cnpj')).toBe(true)
    expect(comChaveNula.percentualPlano).toBeNull()
    expect(comChaveNula.cnpj).toBeNull()
  })
})

describe('getPercentClass — ausente e nulo na mesma execução', () => {
  it('chave AUSENTE (undefined) ⇒ "neutral", NUNCA "red"', () => {
    expect(getPercentClass(semChaveNoWire.percentualPlano)).toBe('neutral')
    expect(getPercentClass(undefined)).toBe('neutral')
  })

  it('chave presente valendo null ⇒ "neutral" (o irmão que não discrimina)', () => {
    expect(getPercentClass(comChaveNula.percentualPlano)).toBe('neutral')
    expect(getPercentClass(null)).toBe('neutral')
  })

  it('percentual CONHECIDO e ≥ 95 continua "red" — o vermelho não foi desligado', () => {
    expect(getPercentClass(estourado.percentualPlano)).toBe('red')
    expect(getPercentClass(95)).toBe('red')
  })
})

describe('tabela renderizada — a coluna "% do Plano" com a chave ausente', () => {
  it('chave AUSENTE ⇒ célula "—" em classe neutra, sem o vermelho de "estourou"', () => {
    const cell = celulas(semChaveNoWire)[COL_PERCENTUAL]
    const span = cell.querySelector('span')!
    expect(cell).toHaveTextContent('—')
    expect(span.className).toContain(CLASSE_NEUTRA)
    expect(span.className).not.toContain(CLASSE_VERMELHA)
  })

  it('chave presente valendo null ⇒ mesma célula neutra (irmão na mesma execução)', () => {
    const cell = celulas(comChaveNula)[COL_PERCENTUAL]
    const span = cell.querySelector('span')!
    expect(cell).toHaveTextContent('—')
    expect(span.className).toContain(CLASSE_NEUTRA)
    expect(span.className).not.toContain(CLASSE_VERMELHA)
  })

  it('controle positivo: 120% conhecido ⇒ célula "120,0%" em VERMELHO', () => {
    const cell = celulas(estourado)[COL_PERCENTUAL]
    const span = cell.querySelector('span')!
    expect(cell).toHaveTextContent('120,0%')
    expect(span.className).toContain(CLASSE_VERMELHA)
    expect(span.className).not.toBe(CLASSE_NEUTRA)
  })
})

describe('tabela renderizada — a coluna "CNPJ" com a chave ausente', () => {
  it('chave AUSENTE ⇒ "—", nunca "undefined" nem célula vazia', () => {
    const cell = celulas(semChaveNoWire)[COL_CNPJ]
    expect(cell.textContent).toBe('—')
    expect(cell.textContent).not.toContain('undefined')
  })

  it('chave presente valendo null ⇒ "—" (irmão na mesma execução)', () => {
    expect(celulas(comChaveNula)[COL_CNPJ].textContent).toBe('—')
  })

  it('controle positivo: CNPJ conhecido sai mascarado', () => {
    expect(celulas(estourado)[COL_CNPJ].textContent).toBe('12.345.678/0001-95')
  })
})
