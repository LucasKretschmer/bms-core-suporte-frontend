/**
 * CONTRATO DE WIRE do "Saúde dos Planos" (demanda 123 · D4).
 *
 * ## Por que este arquivo existe
 *
 * O gráfico ficava **em branco, sem erro**: o backend emite
 * `summary: { totalClientes, verde, amarelo, vermelho }` (`MetricsDtos.cs:132` +
 * `PropertyNamingPolicy = CamelCase` em `Program.cs:106`) e o frontend lia
 * `totalVerde/totalAmarelo/totalVermelho`. O Recharts com `dataKey` cujo valor é
 * `undefined` não desenha e não reclama, e o estado vazio testava `!summary` — o objeto
 * existia, só tinha outras chaves.
 *
 * A suíte estava **verde** durante todo esse tempo porque os mocks eram construídos a
 * partir do **tipo do frontend** (`const X: PlanHealthSummaryDto = { totalVerde: 5 … }`):
 * comparavam o front com o front, e o contrato real nunca entrava.
 *
 * ## Como este arquivo evita repetir isso
 *
 * O payload aqui é uma **string JSON literal**, escrita à mão com as chaves como o backend
 * as emite, passada por `JSON.parse` e injetada no `api.get`. Nenhum tipo do TypeScript
 * participa da construção do dado — se o tipo do front divergir do wire de novo, o valor
 * chega `undefined` em runtime e os casos abaixo ficam vermelhos.
 *
 * O caminho exercitado é o real: `api.get` → `metricsService.getPlanHealth` →
 * `usePlanHealth` (TanStack Query de verdade) → `SupportPlanHealthSection` →
 * `PlanHealthChart` / export.
 *
 * ## Limite declarado (jsdom)
 *
 * Sob `ResponsiveContainer` o Recharts não renderiza em jsdom (largura 0) — não há `<svg>`
 * nem `<rect>` de barra para assertar. Por isso a prova de que os valores chegam ao
 * desenho tem duas camadas: (1) a **série entregue ao `BarChart`** e os `dataKey` de cada
 * `<Bar>`, capturados por um mock do `recharts` (é exatamente o par que o defeito
 * quebrava: `dataKey` sem valor correspondente na linha da série); e (2) a **legenda de
 * drill acessível**, que é DOM real e mostra os números ao usuário.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Captura da série entregue ao Recharts. `vi.hoisted` porque o factory do `vi.mock` é
// içado acima das declarações do módulo.
const recharts = vi.hoisted(() => ({
  dataDoBarChart: [] as Array<Record<string, unknown>>,
  dataKeysDasBarras: [] as string[],
}))

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="recharts-container">{children}</div>
  ),
  BarChart: ({
    data,
    children,
  }: {
    data: Array<Record<string, unknown>>
    children?: React.ReactNode
  }) => {
    recharts.dataDoBarChart = data
    return <div data-testid="recharts-barchart">{children}</div>
  },
  Bar: ({ dataKey }: { dataKey: string }) => {
    recharts.dataKeysDasBarras.push(dataKey)
    return null
  },
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

// Instância central do Axios: é aqui que o JSON do backend entra no sistema.
vi.mock('../../../../services/api', () => ({ api: { get: vi.fn() } }))

// Evita o import lazy do exceljs no export XLSX.
vi.mock('../../../reports/shared/utils/exportTable', () => ({
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { api } from '../../../../services/api'
import * as exportTable from '../../../reports/shared/utils/exportTable'
import { SupportPlanHealthSection } from './SupportPlanHealthSection'
import { ToastProvider } from '../../../../components/ui/Toast'

// ── Payloads: JSON LITERAL, como o backend serializa ──────────────────────────

/**
 * Resposta real de `GET /api/v1/metrics/plan-health`.
 * Quantidades DIFERENTES por faixa (2/1/0) de propósito: com 1/1/1 uma asserção de
 * contagem passaria com as faixas trocadas.
 * O 3º item vem SEM `nomeFantasia` e SEM `planNome` — é o que
 * `DefaultIgnoreCondition = WhenWritingNull` (`Program.cs:107-108`) produz quando as
 * colunas são nulas: a chave some, não vira `null`.
 */
const WIRE_COM_DADOS = `{
  "data": [
    {
      "clientId": 41,
      "nomeFantasia": "ACME Ltda",
      "planNome": "Premium",
      "horasContratadas": 40,
      "horasConsumidas": 20,
      "percentualConsumo": 50,
      "faixa": "verde"
    },
    {
      "clientId": 42,
      "nomeFantasia": "Contoso",
      "planNome": "Básico",
      "horasContratadas": 10,
      "horasConsumidas": 9.7,
      "percentualConsumo": 97,
      "faixa": "vermelho"
    },
    {
      "clientId": 43,
      "horasContratadas": 8,
      "horasConsumidas": 7,
      "percentualConsumo": 87.5,
      "faixa": "amarelo"
    }
  ],
  "summary": { "totalClientes": 3, "verde": 2, "amarelo": 1, "vermelho": 0 }
}`

/** Nenhum cliente com plano no período — vazio HONESTO. */
const WIRE_VAZIO = `{
  "data": [],
  "summary": { "totalClientes": 0, "verde": 0, "amarelo": 0, "vermelho": 0 }
}`

/** Todas as linhas sem identificação: nada de útil para exportar. */
const WIRE_SEM_IDENTIFICACAO = `{
  "data": [
    {
      "clientId": 44,
      "horasContratadas": 5,
      "horasConsumidas": 1,
      "percentualConsumo": 20,
      "faixa": "verde"
    }
  ],
  "summary": { "totalClientes": 1, "verde": 1, "amarelo": 0, "vermelho": 0 }
}`

/**
 * As HORAS faltam de DUAS formas diferentes no mesmo wire, e elas não são a mesma coisa
 * para o `JSON.parse` (123/QA rodada 4, achado `A-4`):
 *
 *  - **chave AUSENTE** (1º item) — é o que `DefaultIgnoreCondition = WhenWritingNull`
 *    (`Program.cs:107-108`) produz quando a coluna é nula no banco. Sem guarda,
 *    `formatHours(undefined)` → `Math.round(undefined * 3600)` = `NaN` → **"NaNh NaNm"**
 *    dentro do arquivo que o gestor encaminha por e-mail;
 *  - **`null` EXPLÍCITO** (2º item) — chega quando o serializador do outro lado muda de
 *    ideia (um `WhenWritingDefault`, um campo novo, um proxy). Sem guarda,
 *    `formatHours(null)` → `null * 3600` = `0` → **"0h 0m"**, que AFIRMA "nenhuma hora
 *    neste balde" onde o valor é **desconhecido**. É o pior dos dois: não parece defeito.
 *
 * O 3º item traz as duas horas preenchidas de propósito: é a **companheira positiva** na
 * mesma execução, sem a qual "não contém NaN" seria satisfeito pelo vazio
 * (`rules/tests.md` § padrão 1 — foi exatamente assim que o defeito passou batido).
 *
 * O 4º item é a **companheira de FRONTEIRA** (123/QA rodada 4, achado `A-7`):
 * `horasConsumidas: 0` é um zero **legítimo** — o cliente tem plano e ainda não consumiu
 * nada no período. Ele existe para distinguir a guarda certa da **sobre-correção**: a
 * guarda ingênua `if (!horas) return '—'` devolve traço para `undefined`, `null`, `NaN` e
 * `Infinity` exatamente como a certa, e difere dela em **um único valor de entrada** — este.
 * Sem esta linha, "simplificar" a guarda passaria a **afirmar "desconhecido" onde o valor é
 * zero** com a suíte inteira verde: o defeito espelhado do que o `D4-1` corrigiu.
 */
const WIRE_HORAS_AUSENTES_E_NULAS = `{
  "data": [
    {
      "clientId": 51,
      "nomeFantasia": "Sem Horas Ltda",
      "planNome": "Premium",
      "percentualConsumo": 0,
      "faixa": "verde"
    },
    {
      "clientId": 52,
      "nomeFantasia": "Horas Nulas SA",
      "planNome": "Básico",
      "horasContratadas": null,
      "horasConsumidas": null,
      "percentualConsumo": 0,
      "faixa": "verde"
    },
    {
      "clientId": 53,
      "nomeFantasia": "Completa ME",
      "planNome": "Ouro",
      "horasContratadas": 12,
      "horasConsumidas": 6.5,
      "percentualConsumo": 54.2,
      "faixa": "verde"
    },
    {
      "clientId": 54,
      "nomeFantasia": "Zero Real SA",
      "planNome": "Bronze",
      "horasContratadas": 8,
      "horasConsumidas": 0,
      "percentualConsumo": 0,
      "faixa": "verde"
    }
  ],
  "summary": { "totalClientes": 4, "verde": 4, "amarelo": 0, "vermelho": 0 }
}`

/**
 * O shape ERRADO que o frontend acreditava receber até a 123/D4. Nenhum backend emite
 * isto — serve como prova de que uma divergência de chave passa a virar estado vazio
 * honesto, em vez de moldura de gráfico em branco.
 */
const WIRE_DIVERGENTE_LEGADO = `{
  "data": [
    {
      "clientId": 41,
      "nomeCliente": "ACME Ltda",
      "nomePlano": "Premium",
      "horasPlano": 40,
      "horasUsadas": 20,
      "percentualConsumo": 50,
      "faixaSaude": "verde"
    }
  ],
  "summary": { "totalVerde": 2, "totalAmarelo": 1, "totalVermelho": 0 }
}`

function responderCom(json: string) {
  vi.mocked(api.get).mockResolvedValue({ data: JSON.parse(json) as unknown })
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <SupportPlanHealthSection from="2026-06-01" to="2026-06-30" onFaixaDrill={() => {}} />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

const NOME_BOTAO_VERDE = 'Ver clientes com consumo abaixo de 80% do plano (2)'
const NOME_BOTAO_AMARELO = 'Ver clientes com consumo entre 80% e 95% do plano (1)'
const NOME_BOTAO_VERMELHO = 'Ver clientes com consumo de 95% ou mais do plano (0)'
const MENSAGEM_VAZIO = 'Sem dados de planos para o período.'

describe('Saúde dos Planos — contrato de wire com o backend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recharts.dataDoBarChart = []
    recharts.dataKeysDasBarras = []
  })

  it('a série entregue ao gráfico traz os totais do summary do backend, um por dataKey', async () => {
    responderCom(WIRE_COM_DADOS)
    renderSection()

    await screen.findByTestId('recharts-barchart')

    // Valores literais, escritos à mão a partir do JSON acima — não derivados da resposta.
    expect(recharts.dataDoBarChart).toEqual([
      { name: 'Planos', verde: 2, amarelo: 1, vermelho: 0 },
    ])

    // O defeito era `dataKey` apontando para chave inexistente na linha da série: as barras
    // sumiam em silêncio. Aqui cada dataKey tem de resolver para um NÚMERO.
    expect(recharts.dataKeysDasBarras).toEqual(['verde', 'amarelo', 'vermelho'])
    const linha = recharts.dataDoBarChart[0]
    for (const dataKey of recharts.dataKeysDasBarras) {
      expect(typeof linha[dataKey]).toBe('number')
    }
  })

  it('a legenda acessível mostra ao usuário o total de cada faixa vindo do backend', async () => {
    responderCom(WIRE_COM_DADOS)
    renderSection()

    expect(await screen.findByRole('button', { name: NOME_BOTAO_VERDE })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: NOME_BOTAO_AMARELO })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: NOME_BOTAO_VERMELHO })).toBeInTheDocument()

    // Companheira positiva das asserções de ausência dos outros casos: com dado, o card
    // NÃO mostra a mensagem de vazio.
    expect(screen.queryByText(MENSAGEM_VAZIO)).not.toBeInTheDocument()
  })

  it('o export CSV sai com os campos dos itens preenchidos (era tudo "—"/NaN)', async () => {
    responderCom(WIRE_COM_DADOS)
    renderSection()

    fireEvent.click(await screen.findByLabelText('Baixar CSV'))

    expect(exportTable.exportToCsv).toHaveBeenCalledTimes(1)
    const [, , linhas] = vi.mocked(exportTable.exportToCsv).mock.calls[0]

    // Literais escritos à mão (formatHours(40) → "40h 0m"; 9,7 h → "9h 42m").
    expect(linhas).toEqual([
      {
        cliente: 'ACME Ltda',
        plano: 'Premium',
        consumo: '50,0%',
        horasPlano: '40h 0m',
        horasUsadas: '20h 0m',
        saude: 'Ok (< 80%)',
      },
      {
        cliente: 'Contoso',
        plano: 'Básico',
        consumo: '97,0%',
        horasPlano: '10h 0m',
        horasUsadas: '9h 42m',
        saude: 'Crítico (≥ 95%)',
      },
      {
        // Cliente sem nome nem plano no banco: traço no nome, mas as HORAS continuam
        // vindo — é o par positivo da ausência (o defeito antigo zerava as duas coisas).
        cliente: '—',
        plano: '—',
        consumo: '87,5%',
        horasPlano: '8h 0m',
        horasUsadas: '7h 0m',
        saude: 'Atenção (80–95%)',
      },
    ])

    const serializado = JSON.stringify(linhas)
    expect(serializado).not.toContain('NaN')
    expect(serializado).not.toContain('undefined')
  })

  it('export: hora AUSENTE e `null` viram traço; zero LEGÍTIMO continua "0h 0m" (sem sobre-correção)', async () => {
    responderCom(WIRE_HORAS_AUSENTES_E_NULAS)
    renderSection()

    fireEvent.click(await screen.findByLabelText('Baixar CSV'))

    expect(exportTable.exportToCsv).toHaveBeenCalledTimes(1)
    const [, , linhas] = vi.mocked(exportTable.exportToCsv).mock.calls[0]

    // Literais escritos à mão. Fica VERMELHO nas DUAS direções:
    //  - guarda REMOVIDA → a 1ª linha vira "NaNh NaNm" (chave ausente) e a 2ª vira "0h 0m"
    //    (`null`), que é pior porque parece um número legítimo;
    //  - guarda SOBRE-CORRIGIDA (`if (!horas) return '—'`) → a 4ª linha vira "—" onde o
    //    valor é zero de verdade (achado `A-7`).
    // A 3ª linha é a companheira positiva; a 4ª é a companheira de fronteira.
    expect(linhas).toEqual([
      {
        cliente: 'Sem Horas Ltda',
        plano: 'Premium',
        consumo: '0,0%',
        horasPlano: '—',
        horasUsadas: '—',
        saude: 'Ok (< 80%)',
      },
      {
        cliente: 'Horas Nulas SA',
        plano: 'Básico',
        consumo: '0,0%',
        horasPlano: '—',
        horasUsadas: '—',
        saude: 'Ok (< 80%)',
      },
      {
        // Companheira POSITIVA, na mesma execução: hora que veio continua sendo formatada
        // (6,5 h → "6h 30m"). Sem ela, uma guarda que devolvesse "—" para TUDO passaria.
        cliente: 'Completa ME',
        plano: 'Ouro',
        consumo: '54,2%',
        horasPlano: '12h 0m',
        horasUsadas: '6h 30m',
        saude: 'Ok (< 80%)',
      },
      {
        // Companheira de FRONTEIRA (`A-7`): plano de 8 h com ZERO hora consumida no
        // período. `0` é um valor legítimo e tem de sair formatado — "não consumiu nada"
        // não é "não sabemos". É esta linha, e só ela, que separa a guarda certa da
        // sobre-correção `if (!horas)`.
        cliente: 'Zero Real SA',
        plano: 'Bronze',
        consumo: '0,0%',
        horasPlano: '8h 0m',
        horasUsadas: '0h 0m',
        saude: 'Ok (< 80%)',
      },
    ])

    // As asserções abaixo são negativas e por isso vêm DEPOIS do `toEqual` positivo,
    // sobre o mesmo `linhas`: é o positivo que garante que elas não estão olhando o vazio.
    //
    // 123/QA rodada 4, achado `A-7`: o negativo de "0h 0m" é recortado às DUAS LINHAS SEM
    // HORA — nunca ao conjunto. Sobre o conjunto ele proibiria estruturalmente a linha de
    // zero LEGÍTIMO (e qualquer hora inteira que termine em 0, como "10h 0m"), que é
    // justamente o valor-fronteira que separa a guarda certa (`typeof` + `Number.isFinite`)
    // da guarda ingênua (`if (!horas)`).
    const semHora = JSON.stringify(linhas.slice(0, 2))
    expect(semHora).not.toContain('NaN')
    expect(semHora).not.toContain('undefined')
    // "0h 0m" é uma AFIRMAÇÃO de zero: nenhuma das duas linhas sem hora pode produzi-la.
    expect(semHora).not.toContain('0h 0m')

    // Sobre o conjunto inteiro os dois sintomas barulhentos seguem proibidos.
    const serializado = JSON.stringify(linhas)
    expect(serializado).not.toContain('NaN')
    expect(serializado).not.toContain('undefined')
  })

  it('o botão de export só é oferecido quando há linha identificável', async () => {
    // Positivo primeiro: com linha identificável, os dois botões existem.
    responderCom(WIRE_COM_DADOS)
    const comDados = renderSection()
    expect(await screen.findByLabelText('Baixar CSV')).toBeInTheDocument()
    expect(screen.getByLabelText('Baixar Excel')).toBeInTheDocument()
    comDados.unmount()

    // Negativo: nenhuma linha tem cliente nem plano — a planilha sairia ilegível.
    responderCom(WIRE_SEM_IDENTIFICACAO)
    renderSection()
    // Espera o dado chegar (o gráfico monta) antes de afirmar a ausência do botão —
    // ausência medida antes da resposta seria satisfeita pelo loading.
    await screen.findByTestId('recharts-barchart')
    expect(screen.queryByLabelText('Baixar CSV')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Baixar Excel')).not.toBeInTheDocument()
  })

  it('summary com zero cliente → mensagem de vazio, nunca gráfico zerado', async () => {
    responderCom(WIRE_VAZIO)
    const vazio = renderSection()

    expect(await screen.findByText(MENSAGEM_VAZIO)).toBeInTheDocument()
    expect(screen.queryByTestId('recharts-barchart')).not.toBeInTheDocument()
    vazio.unmount()

    // Companheira positiva na mesma execução: o mesmo componente, com dado, desenha.
    responderCom(WIRE_COM_DADOS)
    renderSection()
    expect(await screen.findByTestId('recharts-barchart')).toBeInTheDocument()
    expect(screen.queryByText(MENSAGEM_VAZIO)).not.toBeInTheDocument()
  })

  it('summary com chaves divergentes → vazio honesto, não moldura em branco', async () => {
    responderCom(WIRE_DIVERGENTE_LEGADO)
    const divergente = renderSection()

    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(await screen.findByText(MENSAGEM_VAZIO)).toBeInTheDocument()
    expect(screen.queryByTestId('recharts-barchart')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Baixar CSV')).not.toBeInTheDocument()
    divergente.unmount()

    responderCom(WIRE_COM_DADOS)
    renderSection()
    expect(await screen.findByTestId('recharts-barchart')).toBeInTheDocument()
  })

  it('chama o endpoint de plan-health com o período da tela', async () => {
    responderCom(WIRE_COM_DADOS)
    renderSection()

    await waitFor(() => expect(api.get).toHaveBeenCalled())
    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/metrics/plan-health',
      expect.objectContaining({
        params: expect.objectContaining({ from: '2026-06-01', to: '2026-06-30' }),
      }),
    )
  })
})
