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

// Encena o download (evita o import lazy do exceljs dentro de `exportToXlsx`), mas mantém o
// RESTO do módulo real — em especial `durationCellFromHours`, que é o núcleo da conversão da
// demanda 134. Um fake dessa função provaria o fake, não a conversão (`rules/tests.md`).
vi.mock('../../../reports/shared/utils/exportTable', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../reports/shared/utils/exportTable')>()),
  exportToCsv: vi.fn(),
  exportToXlsx: vi.fn(),
}))

import { api } from '../../../../services/api'
import * as exportTable from '../../../reports/shared/utils/exportTable'
import {
  assertCelulasDeDuracaoSaoNumericas,
  chavesDeDuracao,
} from '../../../../test/duracaoExport'
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

  it('o export CSV sai com os campos dos itens preenchidos, e as horas em SEGUNDOS (134)', async () => {
    responderCom(WIRE_COM_DADOS)
    renderSection()

    fireEvent.click(await screen.findByLabelText('Baixar CSV'))

    expect(exportTable.exportToCsv).toHaveBeenCalledTimes(1)
    const [, , linhas] = vi.mocked(exportTable.exportToCsv).mock.calls[0]

    // 134: a origem desta tela está em HORAS DECIMAIS; a unidade canônica da linha do
    // export é SEGUNDO INTEIRO (`analise-frontend.md` §2.1). Os literais abaixo foram
    // calculados À MÃO a partir do JSON de wire — nunca por `hoursToSeconds(...)` no
    // teste, que provaria a função contra ela mesma (`rules/tests.md` § tautologia):
    //   40 h   = 40 × 3600     = 144000
    //   20 h   = 20 × 3600     =  72000
    //   10 h   = 10 × 3600     =  36000
    //    9,7 h =  9,7 × 3600   =  34920   (= 9 h 42 min, o mesmo instante do "9h 42m" de antes)
    //    8 h   =  8 × 3600     =  28800
    //    7 h   =  7 × 3600     =  25200
    expect(linhas).toEqual([
      {
        cliente: 'ACME Ltda',
        plano: 'Premium',
        consumo: '50,0%',
        horasPlano: 144000,
        horasUsadas: 72000,
        saude: 'Ok (< 80%)',
      },
      {
        cliente: 'Contoso',
        plano: 'Básico',
        consumo: '97,0%',
        horasPlano: 36000,
        horasUsadas: 34920,
        saude: 'Crítico (≥ 95%)',
      },
      {
        // Cliente sem nome nem plano no banco: traço no nome, mas as HORAS continuam
        // vindo — é o par positivo da ausência (o defeito antigo zerava as duas coisas).
        cliente: '—',
        plano: '—',
        consumo: '87,5%',
        horasPlano: 28800,
        horasUsadas: 25200,
        saude: 'Atenção (80–95%)',
      },
    ])

    // Fica vermelho se alguém devolver a pré-formatação (`'40h 0m'`) ou trocar o helper por
    // `durationCell` (que leria 40 como 40 SEGUNDOS e escreveria 40 aqui).
    expect(linhas[0].horasPlano).toBe(144000)
    expect(typeof linhas[0].horasPlano).toBe('number')

    const serializado = JSON.stringify(linhas)
    expect(serializado).not.toContain('NaN')
    expect(serializado).not.toContain('undefined')
    // O texto de tela não pode viajar dentro do arquivo calculável.
    expect(serializado).not.toContain('h 0m')
    expect(serializado).not.toContain('9h 42m')
  })

  it('134 · invariante da superfície: as colunas de duração são {horasPlano, horasUsadas}', async () => {
    responderCom(WIRE_COM_DADOS)
    renderSection()

    fireEvent.click(await screen.findByLabelText('Baixar CSV'))

    const [, colunas, linhas] = vi.mocked(exportTable.exportToCsv).mock.calls[0]

    // IDENTIDADE literal do conjunto DERIVADO da declaração real das colunas
    // (`analise-frontend.md` §9.3) — nunca a cardinalidade, que passa quando uma coluna
    // entra e outra sai. Fica vermelho se alguém tirar o `type` de uma das duas, renomear
    // a chave, ou marcar como duração o que não é (`consumo` é PERCENTUAL e fica de fora).
    expect(new Set(chavesDeDuracao(colunas))).toEqual(new Set(['horasPlano', 'horasUsadas']))

    // Derivado: para cada chave do conjunto acima, a célula é `number | null` — vermelho se
    // o mapper voltar a pré-formatar. O helper começa pelos dois controles positivos
    // (colunas > 0 e linhas > 0), então não é satisfeito pelo vazio.
    assertCelulasDeDuracaoSaoNumericas(colunas, linhas)

    // Contraprova positiva de que o conjunto não é "tudo": as colunas de texto seguem texto,
    // com os mesmos cabeçalhos e a mesma ordem de sempre.
    expect(colunas.map((c) => c.header)).toEqual([
      'Cliente',
      'Plano',
      'Consumo',
      'Horas do plano',
      'Horas usadas',
      'Saúde',
    ])
    expect(colunas.filter((c) => c.type === undefined).map((c) => c.key)).toEqual([
      'cliente',
      'plano',
      'consumo',
      'saude',
    ])
  })

  it('134 · a TELA não muda: o card segue desenhando faixas/contagens, sem segundo nem H:mm:ss', async () => {
    responderCom(WIRE_COM_DADOS)
    const { container } = renderSection()

    // Positivo primeiro (senão as negativas abaixo seriam satisfeitas pelo card vazio).
    expect(await screen.findByRole('button', { name: NOME_BOTAO_VERDE })).toBeInTheDocument()
    expect(recharts.dataDoBarChart).toEqual([
      { name: 'Planos', verde: 2, amarelo: 1, vermelho: 0 },
    ])

    // A conversão é do ARQUIVO. Nada dela pode vazar para o DOM.
    const textoDaTela = container.textContent ?? ''
    expect(textoDaTela).not.toContain('144000')
    expect(textoDaTela).not.toContain('40:00:00')
    expect(textoDaTela).not.toContain('02:44:00')
  })

  it('export: hora AUSENTE e `null` viram célula VAZIA; zero LEGÍTIMO continua 0 (sem sobre-correção)', async () => {
    responderCom(WIRE_HORAS_AUSENTES_E_NULAS)
    renderSection()

    fireEvent.click(await screen.findByLabelText('Baixar CSV'))

    expect(exportTable.exportToCsv).toHaveBeenCalledTimes(1)
    const [, colunas, linhas] = vi.mocked(exportTable.exportToCsv).mock.calls[0]

    // 134: o que este caso trava mudou de REPRESENTAÇÃO, não de exigência. Antes a ausência
    // saía '—'; agora sai `null`, que o núcleo escreve como célula VAZIA nos dois formatos
    // (`analise-frontend.md` §6) — vazio não afirma nada, '—' e `0` afirmam.
    // Literais calculados à mão: 12 h = 43200 s · 6,5 h = 23400 s · 8 h = 28800 s.
    // Continua VERMELHO nas DUAS direções:
    //  - guarda REMOVIDA → a 1ª linha vira `NaN` (chave ausente) e a 2ª vira `0` (`null`),
    //    que é pior porque `0` é um número legítimo e SOMA no Excel;
    //  - guarda SOBRE-CORRIGIDA (`if (!horas) return null`) → a 4ª linha vira `null` onde o
    //    valor é zero de verdade (achado `A-7`).
    // A 3ª linha é a companheira positiva; a 4ª é a companheira de fronteira.
    expect(linhas).toEqual([
      {
        cliente: 'Sem Horas Ltda',
        plano: 'Premium',
        consumo: '0,0%',
        horasPlano: null,
        horasUsadas: null,
        saude: 'Ok (< 80%)',
      },
      {
        cliente: 'Horas Nulas SA',
        plano: 'Básico',
        consumo: '0,0%',
        horasPlano: null,
        horasUsadas: null,
        saude: 'Ok (< 80%)',
      },
      {
        // Companheira POSITIVA, na mesma execução: hora que veio continua virando número
        // (6,5 h → 23400 s). Sem ela, uma guarda que devolvesse `null` para TUDO passaria.
        cliente: 'Completa ME',
        plano: 'Ouro',
        consumo: '54,2%',
        horasPlano: 43200,
        horasUsadas: 23400,
        saude: 'Ok (< 80%)',
      },
      {
        // Companheira de FRONTEIRA (`A-7`): plano de 8 h com ZERO hora consumida no
        // período. `0` é um valor legítimo e tem de sair como `0` — "não consumiu nada"
        // não é "não sabemos". É esta linha, e só ela, que separa a guarda certa
        // (`== null` + `Number.isFinite`) da sobre-correção `if (!horas)`.
        cliente: 'Zero Real SA',
        plano: 'Bronze',
        consumo: '0,0%',
        horasPlano: 28800,
        horasUsadas: 0,
        saude: 'Ok (< 80%)',
      },
    ])

    // `toEqual` ignora propriedade cujo valor é `undefined`, então a ausência é afirmada
    // NOMINALMENTE: `toHaveProperty(k, null)` reprova tanto para `undefined` quanto para `0`.
    // AP-FRONTEND-028: o caso que discrimina é o `null` EXPLÍCITO (linha 2) — um guard
    // `=== undefined` devolveria `0` ali, e `0` numa planilha AFIRMA "nenhuma hora".
    expect(linhas[0]).toHaveProperty('horasPlano', null) // chave ausente no wire
    expect(linhas[0]).toHaveProperty('horasUsadas', null)
    expect(linhas[1]).toHaveProperty('horasPlano', null) // `null` explícito no wire
    expect(linhas[1]).toHaveProperty('horasUsadas', null)

    // Fronteira, na mesma execução: zero é `0`, e `0` NÃO é `null`.
    expect(linhas[3].horasUsadas).toBe(0)
    expect(linhas[3].horasUsadas).not.toBeNull()

    // As negativas vêm DEPOIS do `toEqual` positivo, sobre o mesmo `linhas`: é o positivo
    // que garante que elas não estão olhando o vazio.
    const semHora = JSON.stringify(linhas.slice(0, 2))
    expect(semHora).not.toContain('NaN')
    // Nenhuma das duas linhas sem hora pode AFIRMAR zero.
    expect(semHora).not.toContain('"horasPlano":0')
    expect(semHora).not.toContain('"horasUsadas":0')
    // Nem o traço, que é texto e quebraria a coluna numérica do arquivo.
    expect(semHora).not.toContain('—')

    const serializado = JSON.stringify(linhas)
    expect(serializado).not.toContain('NaN')
    // Nenhuma hora pré-formatada sobreviveu em nenhuma das quatro linhas.
    expect(serializado).not.toContain('h 0m')
    expect(serializado).not.toContain('6h 30m')

    // Invariante da superfície também neste cenário (é aqui que moram o `null` e o `0`).
    expect(new Set(chavesDeDuracao(colunas))).toEqual(new Set(['horasPlano', 'horasUsadas']))
    assertCelulasDeDuracaoSaoNumericas(colunas, linhas)
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
