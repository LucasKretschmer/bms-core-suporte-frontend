import { useCallback, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { InfoIcon } from '../../../components/ui/InfoIcon'
import { Input } from '../../../components/ui/Input'
import { MultiSelectCombobox } from '../../../components/ui/MultiSelectCombobox'
import { Pagination } from '../../../components/ui/Pagination'
import { Modal } from '../../../components/ui/Modal'
import { ReportPageLayout } from '../../../components/layout/ReportPageLayout'
import { ExportButtons } from '../shared/components/ExportButtons'
import { PeriodFilter } from '../shared/components/PeriodFilter'
import { PlanCombobox } from '../shared/components/PlanCombobox'
import {
  durationCellFromHours,
  exportToCsv,
  exportToXlsx,
} from '../shared/utils/exportTable'
import type { ExportColumn, ExportRow } from '../shared/utils/exportTable'
import { listPlanConsumption } from '../shared/services/reportsService'
import { planConsumptionColumns } from './columns'
import { usePlanConsumption } from './hooks/usePlanConsumption'
import { PlanConsumptionHelp } from './components/PlanConsumptionHelp'
import { FonteDoPeriodoAviso } from './components/FonteDoPeriodoAviso'
import { normalizarFonte } from './fonteDoPeriodoTextos'
import {
  LABEL_FILTRO_USO_DO_PLANO,
  LABEL_USO_DO_PLANO_TODOS,
  OPCOES_USO_DO_PLANO,
  TOOLTIP_FILTRO_USO_DO_PLANO,
  normalizarSelecaoUsoDoPlano,
  valorExibidoUsoDoPlano,
} from './usoDoPlanoTextos'
import type { UsoDoPlanoToken } from './usoDoPlanoTextos'
import { formatClientName, formatPercent } from '../shared/utils/formatters'
import {
  HEADER_EXPORT_CREDITO,
  HEADER_EXPORT_PLANO_EFETIVO,
} from '../shared/utils/creditoTexts'
import { derivarPlanoEfetivo } from '../shared/utils/planoEfetivo'
import { ClientTicketsPanel } from '../../client-tickets/components/ClientTicketsPanel'
import type { ClientTicketItemDto } from '../../client-tickets/types/clientTickets'
import type { PlanConsumptionItemDto } from '../shared/types/reports'

/** Chave única para persistência da ordem das colunas */
const TABLE_ID = 'plan-consumption'

/**
 * ─── Export (CSV/XLSX) — S1 da demanda **134** + as 2 colunas novas da **132/F4c** ─────────
 *
 * 🔴 **AP-FRONTEND-028, o 4º e mais grave lugar do mesmo campo:** *tela errada o gestor
 * recarrega, planilha errada ele encaminha.* Toda coluna de hora da tela tem de estar aqui, e
 * com o MESMO significado.
 *
 * **134/§8.1 (aplicado agora, era a onda 2 dela):** as 6 colunas de hora ganharam
 * `type: 'duration'` e o mapper passou a devolver **segundos crus** (`durationCellFromHours`)
 * em vez de `'2h 44m'`. O Excel recebe número com `numFmt [h]:mm:ss` e o usuário consegue
 * **somar a coluna** — que é o pedido da 134. `% do Plano` **não entra**: é percentual.
 * `formatHours` saiu do arquivo por consequência (nenhum outro uso), e não por decisão.
 *
 * **132/F4c — DUAS colunas novas**, imediatamente depois de "Qtde. Plano (h)":
 *  · `Crédito (h)` e `Plano Efetivo (h)`.
 *
 * 🔴 **"Qtde. Plano (h)" continua sendo o plano BASE na planilha.** Somar o crédito nela em
 * silêncio faria a planilha de um mês com crédito divergir da de um mês sem crédito **sem
 * nenhum sinal no arquivo**. Com as três colunas lado a lado, a planilha explica a si mesma —
 * e é por isso que a soma NÃO acompanha a tela aqui: na tela o `+ 2h` está visível ao lado.
 *
 * ⚠️ **Célula VAZIA quando o crédito é desconhecido**, `0` quando é conhecido e zero
 * (`derivarPlanoEfetivo`): um `?? 0` afirmaria "não há crédito" durante todo o intervalo entre
 * os dois deploys — e essa é a planilha que vai por e-mail.
 *
 * Hoistado para constante de módulo **exportada** (pedido de 134/§8.1): dentro do componente,
 * a superfície é inalcançável por teste unitário, e é ela que gera o artefato da fatura.
 */
export const PLAN_CONSUMPTION_EXPORT_COLUMNS: ExportColumn[] = [
  { header: 'CNPJ', key: 'cnpj' },
  { header: 'Nome Fantasia', key: 'nomeFantasia' },
  { header: 'Razão Social', key: 'razaoSocial' },
  { header: 'Nome do Plano', key: 'nomePlano' },
  { header: 'Qtde. Plano (h)', key: 'qtdePlanoHoras', type: 'duration' },
  { header: HEADER_EXPORT_CREDITO, key: 'creditoHoras', type: 'duration' },
  { header: HEADER_EXPORT_PLANO_EFETIVO, key: 'qtdePlanoEfetivoHoras', type: 'duration' },
  { header: 'Horas Usadas', key: 'horasUsadas', type: 'duration' },
  { header: 'Horas Restantes', key: 'horasRestantes', type: 'duration' },
  { header: 'Horas Adicionais', key: 'horasAdicionais', type: 'duration' },
  { header: '% do Plano', key: 'percentualPlano' },
  { header: 'Horas Faturáveis', key: 'horasFaturaveis', type: 'duration' },
  { header: 'Horas de Análise', key: 'horasAnalise', type: 'duration' },
  /**
   * 🔴 **135/G1 — SEM `type`, e a ausência é requisito de DADO, não de estilo.**
   *
   * Contagem não é duração. Com `type: 'duration'` o `exportTable` trataria o número como
   * **segundos**: 12 chamados sairiam como `00:00:12` no CSV e como fração de dia com
   * `numFmt [h]:mm:ss` no XLSX. A identidade literal do conjunto `duration`
   * (`index.export.test.ts`) continua com **8** chaves, e esta **não** está lá — é o par
   * (presente na ordem/cabeçalhos, ausente do `duration`) que discrimina.
   */
  { header: 'Qtde. Tickets', key: 'qtdeTickets' },
]

/**
 * Uma linha do wire → uma linha da planilha. Função pura exportada (134/§8.1), pelo mesmo
 * motivo das colunas.
 *
 * `horasRestantes` **pode ser negativo** (plano estourado) e `durationCellFromHours` clampa em
 * 0 — o mesmo valor que `formatHours` já produzia (`formatSeconds` clampa em
 * `formatters.ts:12-13`). Nenhuma mudança de comportamento, e evita `########` no Excel, que
 * não exibe tempo negativo.
 */
export function planConsumptionExportRow(item: PlanConsumptionItemDto): ExportRow {
  // Fonte ÚNICA dos dois números de crédito da planilha — o mesmo helper da célula da tela,
  // com o mesmo guard `== null` (AP-ARQUITETURA-005: nenhuma segunda implementação).
  const plano = derivarPlanoEfetivo(item)

  return {
    cnpj: item.cnpj ?? '—',
    nomeFantasia: item.nomeFantasia ?? '—',
    razaoSocial: item.razaoSocial ?? '—',
    nomePlano: item.nomePlano ?? '—',
    qtdePlanoHoras: durationCellFromHours(item.qtdePlanoHoras),
    // `null` (célula vazia) quando o backend não respondeu sobre crédito; `0` quando
    // respondeu "não há". A planilha distingue os dois; a tela, de propósito, não.
    creditoHoras: plano.creditoConhecido ? durationCellFromHours(plano.creditoHoras) : null,
    qtdePlanoEfetivoHoras: plano.creditoConhecido
      ? durationCellFromHours(plano.efetivoHoras)
      : null,
    horasUsadas: durationCellFromHours(item.horasUsadas),
    horasRestantes: durationCellFromHours(item.horasRestantes),
    horasAdicionais: durationCellFromHours(item.horasAdicionais),
    percentualPlano: formatPercent(item.percentualPlano),
    horasFaturaveis: durationCellFromHours(item.horasFaturaveis),
    horasAnalise: durationCellFromHours(item.horasAnalise),
    /**
     * 🔴 **135/G1 — número CRU, e `null` quando não se sabe.**
     *
     * `?? 0` afirmaria "nenhum chamado aberto" sobre um valor **desconhecido** durante toda
     * a janela entre os dois deploys (o backend anterior à 135 não manda a chave) — e essa é
     * a planilha que vai por e-mail (AP-FRONTEND-028). `'—'` também não serve: mudaria o
     * tipo da célula e a coluna deixaria de somar no Excel. `0` **é** `0`: a partir da 135
     * ele é o valor normal de "nenhum chamado no período", e o guard `== null` é o que
     * distingue os dois.
     */
    qtdeTickets: item.qtdeTickets ?? null,
  }
}

/**
 * 132/§3.5 — **a fonte do número precisa sair na planilha.** Um export de período
 * personalizado (`fonte = aovivo`, C-7) é indistinguível de um export de mês fechado depois
 * que o arquivo sai do sistema, e os dois respondem perguntas diferentes sobre a MESMA
 * competência.
 *
 * Codificado no **nome do arquivo**, que já é o 1º parâmetro de `exportToCsv`/`exportToXlsx`.
 * Um slot de metadados dentro do `exportTable` seria mudança no núcleo da 134 — não se abre
 * aqui.
 */
export function nomeDoArquivoDeExport(
  fonteBruta: string | null | undefined,
  competencia: string | null | undefined,
): string {
  const fonte = normalizarFonte(fonteBruta)
  const sufixoDeFonte =
    fonte === 'snapshot' ? '-snapshot' : fonte === 'aovivo' ? '-ao-vivo' : ''
  const miolo = competencia != null && competencia !== '' ? `-${competencia}` : ''
  return `consumo-planos${miolo}${sufixoDeFonte}`
}

/**
 * Página U3 — Consumo de Planos.
 * Restrita a CoordenadorPlus (guarda de rota configurada em routes/_auth/relatorios/consumo-planos.tsx).
 *
 * Drill-down (#11): clicar numa linha abre um drawer/modal com os chamados do
 * cliente (ClientTicketsPanel, scope='all') NA PRÓPRIA tela — sem navegar.
 */
export default function PlanConsumptionPage() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    sortBy,
    sortDirection,
    filters,
    setPage,
    setPageSize,
    setSort,
    setFilters,
  } = usePlanConsumption()

  const navigate = useNavigate()

  // Drill-down inline (#11): abre um drawer com os chamados do cliente na própria tela.
  const [openClient, setOpenClient] = useState<PlanConsumptionItemDto | null>(null)
  // Ref para devolver o foco à última linha clicada ao fechar o drawer (AP-FRONTEND-004).
  const lastTriggerRef = useRef<HTMLElement | null>(null)

  // Click no chamado (070): navega para o detalhe/apontamentos do ticket por id interno.
  // O link externo do HubSpot continua na célula "Ticket" (stopPropagation).
  const handleTicketClick = useCallback(
    (row: ClientTicketItemDto) => {
      void navigate({
        to: '/relatorios/tickets/$ticketId',
        params: { ticketId: String(row.ticketId) },
        search: { from: 'consumo-planos' },
      })
    },
    [navigate],
  )

  const handleRowClick = useCallback((row: PlanConsumptionItemDto) => {
    // Guarda o elemento focado (linha clicada) para restaurar o foco ao fechar.
    lastTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOpenClient(row)
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setOpenClient(null)
    // Devolve o foco à linha que abriu o drawer (acessibilidade).
    const trigger = lastTriggerRef.current
    if (trigger && document.contains(trigger)) {
      window.setTimeout(() => trigger.focus(), 0)
    }
  }, [])

  // Debounce para o campo de busca
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [searchInput, setSearchInput] = useState('')

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setFilters({ search: value })
    }, 300)
  }

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  /**
   * Busca todas as páginas para export completo.
   *
   * Devolve também a **fonte** e a **competência** da última página lida (o envelope é o
   * mesmo em todas): é o que nomeia o arquivo (§3.5). Ler a fonte do envelope, e não do
   * filtro, é a mesma regra do aviso na tela — o front nunca infere.
   */
  const fetchAllForExport = useCallback(async () => {
    const PAGE_SIZE = 200
    const allItems: ExportRow[] = []
    let currentPage = 1
    let totalPages = 1
    let fonte: string | null | undefined
    let competencia: string | null | undefined

    do {
      const result = await listPlanConsumption({
        search: filters.search || undefined,
        planId: filters.planId,
        from: filters.from,
        to: filters.to,
        // 🔴 135/§5.2 — o SEGUNDO call site do filtro, com a MESMA conversão
        // `[] → undefined` do hook (`usePlanConsumption`). Sem ele a planilha traria
        // **todos** os clientes enquanto a tela mostra os filtrados: o export sai com o
        // mesmo recorte da tela, senão a planilha responde a outra pergunta que a tabela de
        // onde o usuário clicou "Exportar".
        usoPlano: filters.usoPlano.length > 0 ? filters.usoPlano : undefined,
        sortBy,
        sortDirection,
        page: currentPage,
        pageSize: PAGE_SIZE,
      })
      totalPages = result.totalPages
      fonte = result.fonte
      competencia = result.competencia
      result.items.forEach((item) => {
        allItems.push(planConsumptionExportRow(item))
      })
      currentPage++
    } while (currentPage <= totalPages)

    return { rows: allItems, fonte, competencia }
  }, [filters, sortBy, sortDirection])

  async function handleExportCsv() {
    setIsExporting(true)
    try {
      const { rows, fonte, competencia } = await fetchAllForExport()
      exportToCsv(
        nomeDoArquivoDeExport(fonte, competencia),
        PLAN_CONSUMPTION_EXPORT_COLUMNS,
        rows,
      )
    } finally {
      setIsExporting(false)
    }
  }

  async function handleExportXlsx() {
    setIsExporting(true)
    try {
      const { rows, fonte, competencia } = await fetchAllForExport()
      await exportToXlsx(
        nomeDoArquivoDeExport(fonte, competencia),
        PLAN_CONSUMPTION_EXPORT_COLUMNS,
        rows,
      )
    } finally {
      setIsExporting(false)
    }
  }

  const isEmpty = !isLoading && !isError && (!data || data.items.length === 0)

  /**
   * 127/FE-AJUDA — o slot `banner` recebe o `(?)` (`PlanConsumptionHelp`), que recolhe a
   * nota de competência ("Como o período é contado aqui").
   *
   * 🔴 **132/F1 (D7):** o `(?)` hospedava TAMBÉM o card de exceções de faturamento, e a
   * variável daqui se chamava `billingExceptionsBanner`. O card foi removido — com
   * `TimeEntry.InicioEm` como competência (D1), a hora é faturada no mês em que foi
   * apontada, chamado aberto ou fechado, e "chamado fora de qualquer fatura" deixou de
   * ser um conjunto. **A nota FICOU** (`FE/D-1`): a instrução de remoção apontava para
   * estas linhas, que renderizam o hospedeiro, não o hóspede — cumprida ao pé da letra,
   * apagaria a explicação de competência no mês em que essa regra mudou.
   *
   * Os motivos do slot, escritos em 121/A2 e 123/FAT-1, **continuam valendo** — o
   * conjunto de coisas que ele carrega é que encolheu:
   *
   *  - o slot continua sendo `banner`, e NÃO `children`: `ReportPageLayout` só renderiza
   *    `children` no estado "com dados", então o `(?)` desapareceria justamente quando a
   *    listagem voltasse vazia ou falhasse — que é o momento em que a explicação de qual
   *    período está em uso é necessária (travado em
   *    `ReportPageLayout.consumidores.test.ts`);
   *  - o período continua vindo de `filters.from`/`filters.to`, a MESMA fonte da tabela e
   *    do export (uma fonte só).
   *
   * `notaDeProjeto` e `comparaSaudePlanos` (123/FE-PER, D-14) continuam decididos dentro
   * de `PlanConsumptionHelp` — esta tela é a que compara com o gráfico "Saúde dos Planos"
   * do painel; o Relatório do Cliente usa a MESMA nota sem essa frase. 131:
   * `notaDeProjeto` vale `'fora-do-plano'` aqui e `'no-plano-por-apontamento'` lá — a
   * afirmação sobre projeto deixou de ser a mesma nas duas telas.
   */
  /**
   * 🔴 **132/F4d (D12)** — o aviso de origem dos números entra no MESMO slot `banner`, acima
   * do `(?)`, e pelas mesmas duas razões escritas acima: ele precisa sobreviver ao vazio e ao
   * erro da listagem (é quando o usuário pergunta de onde vem o número), e o `ReportPageLayout`
   * só renderiza `children` no estado "com dados".
   *
   * Ele recebe o **envelope** (`data`), nunca as datas do filtro: quem sabe se existe snapshot
   * é o backend. Enquanto `fonte` não vier no wire (132/B11), `FonteDoPeriodoAviso` devolve
   * `null` e o banner fica exatamente como está hoje.
   */
  const ajudaBanner = (
    <div className="flex flex-col gap-3">
      <FonteDoPeriodoAviso envelope={data} />
      <PlanConsumptionHelp from={filters.from} to={filters.to} />
    </div>
  )

  return (
    <ReportPageLayout
      title="Consumo de Planos"
      breadcrumbItems={[
        { label: 'Relatórios' },
        { label: 'Consumo de Planos' },
      ]}
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Buscar"
            placeholder="Nome, CNPJ..."
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="min-w-[220px]"
          />
          <PlanCombobox
            value={filters.planId}
            onChange={(planId) => setFilters({ planId })}
          />
          {/*
            135/G5 — filtro "Uso do plano". Enum FIXO: nenhuma requisição de opções, logo
            **nenhuma `useQuery` nova** e nenhum `isLoading`/`error` aqui — é a diferença
            deliberada em relação ao filtro de Status do painel do parceiro, de onde vem o
            layout (copiamos o layout, não a fonte das opções).

            🔴 O `onChange` NUNCA repassa `proximo` cru: o combobox é genérico e devolve só
            o array alternado, sem dizer **qual** item foi clicado — e os dois cliques que
            G2 tem de distinguir ("marcar faixa com Todos ativo" × "clicar em Todos com
            faixa ativa") produzem arrays com o mesmo conteúdo. Quem decide é
            `normalizarSelecaoUsoDoPlano`, com o estado ANTERIOR na mão.
          */}
          <div className="flex items-end gap-1.5">
            <MultiSelectCombobox<UsoDoPlanoToken>
              id="plan-consumption-uso-do-plano"
              label={LABEL_FILTRO_USO_DO_PLANO}
              summaryLabel={LABEL_FILTRO_USO_DO_PLANO}
              value={valorExibidoUsoDoPlano(filters.usoPlano)}
              options={OPCOES_USO_DO_PLANO}
              onChange={(proximo) =>
                setFilters({
                  usoPlano: normalizarSelecaoUsoDoPlano(proximo, filters.usoPlano),
                })
              }
              /* Nunca aparece (o valor exibido nunca é vazio, por desenho) — declarado em
                 defesa de profundidade: se um dia ficar vazio, a tela diz a verdade
                 ("Todos") em vez do "Selecione…" default, que seria falso. */
              placeholder={LABEL_USO_DO_PLANO_TODOS}
              className="min-w-[200px]"
            />
            {/* 135/G3 — por que "Fora do Plano" traz linhas com `—` em "% do Plano":
                cliente SEM plano entra nessa faixa. Fica aqui, onde o usuário está
                olhando, e não atrás do `(?)` recolhido (que é sobre PERÍODO). */}
            <InfoIcon tooltip={TOOLTIP_FILTRO_USO_DO_PLANO} className="pb-3" />
          </div>
          <PeriodFilter
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => setFilters({ from, to })}
          />
        </div>
      }
      exportActions={
        <ExportButtons
          onExportCsv={() => void handleExportCsv()}
          onExportXlsx={() => void handleExportXlsx()}
          isExporting={isExporting}
        />
      }
      banner={ajudaBanner}
      isLoading={isLoading}
      isError={isError}
      isEmpty={isEmpty}
      onRetry={refetch}
      /*
        🔴 135/§5.3 — a frase antiga ("Nenhum cliente **com plano** encontrado…") ficou FALSA
        com o filtro: "Fora do Plano" inclui, por G3, o cliente **sem plano** — a mensagem
        afirmaria o oposto do recorte pedido. E o vazio significa coisas diferentes com e sem
        faixa selecionada: a segunda frase é o que distingue "não há cliente no período" de
        "há, mas nenhum na faixa" (precedente: `ClientTicketsPanel`).
      */
      emptyMessage={
        filters.usoPlano.length > 0
          ? 'Nenhum cliente encontrado para os filtros selecionados. Nenhum cliente do período está nas faixas de uso do plano selecionadas.'
          : 'Nenhum cliente encontrado para os filtros selecionados.'
      }
    >
      <DataTable
        tableId={TABLE_ID}
        columns={planConsumptionColumns}
        data={data?.items ?? []}
        sortState={{ sortBy, sortDirection }}
        onSort={setSort}
        onRowClick={handleRowClick}
        isClickable
      />
      {data && data.totalPages > 0 && (
        <div className="px-5 border-t border-border">
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            totalCount={data.totalCount}
            totalPages={data.totalPages}
            pageSizeOptions={[10, 25, 50, 100, 200]}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Drawer inline com os chamados do cliente (#11) */}
      {openClient && (
        <Modal
          isOpen
          onClose={handleCloseDrawer}
          title={`Chamados — ${formatClientName(openClient)}`}
          size="xl"
          className="max-w-[90vw] w-[90vw]"
        >
          <ClientTicketsPanel
            clientId={openClient.clientId}
            tableId={`client-tickets-drawer-${openClient.clientId}`}
            onTicketClick={handleTicketClick}
            initialFrom={filters.from}
            initialTo={filters.to}
          />
        </Modal>
      )}
    </ReportPageLayout>
  )
}
