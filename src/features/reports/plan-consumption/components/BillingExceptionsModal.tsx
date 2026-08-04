/**
 * 121/A2 (D2) + F-15 — modal de conferência das exceções de faturamento, com as
 * DUAS seções em abas.
 *
 * Por que ABAS e não duas áreas empilhadas — decidido pelo momento de uso
 * (conferência imediatamente antes de fechar o mês):
 *  - a primeira pergunta do gestor é *"algo exige minha ação?"* ⇒ a aba **Precisa
 *    ação** abre por default e ocupa a tela inteira, sem competir com nada;
 *  - a segunda é *"por que a fatura veio menor?"* ⇒ a aba **Postergado** responde,
 *    quando ele for procurar;
 *  - empilhadas, uma lista acionável de 25 linhas empurraria o bloco informativo para
 *    fora da tela — ou, pior, o informativo (quase sempre maior) empurraria o
 *    acionável. Foi o motivo pelo qual a lista única foi recusada; duas áreas no mesmo
 *    scroll reintroduzem o mesmo defeito de forma mais discreta.
 * As DUAS contagens continuam visíveis sem clique nenhum — no card, e no badge de
 * cada aba.
 *
 * ⚠️ O endpoint é a unidade FAT-4 e ainda **não existe** no backend: escrito contra o
 * contrato congelado de §8 + o param `tipo` desta unidade.
 */

import { useMemo, useState } from 'react'
import { DataTable } from '../../../../components/ui/DataTable/DataTable'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { Modal } from '../../../../components/ui/Modal'
import { Pagination } from '../../../../components/ui/Pagination'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { Switch } from '../../../../components/ui/Switch'
import { Tabs } from '../../../../components/ui/Tabs'
import type { TabItem } from '../../../../components/ui/Tabs'
import { tabId, tabPanelId } from '../../../../components/ui/tabsIds'
import { useBillingExceptions } from '../hooks/useBillingExceptions'
import { buildBillingExceptionsColumns } from './billingExceptionsColumns'
import {
  BILLING_EXCEPTIONS_PAGE_SIZE,
  BILLING_EXCEPTIONS_SORT_BY,
  BILLING_EXCEPTIONS_TIPO_INICIAL,
  BILLING_EXCEPTIONS_TIPOS,
} from '../billingExceptions'
import {
  TEXTO_EXCECOES_TITULO,
  TEXTO_SECAO_DEFINICAO,
  TEXTO_SECAO_ROTULO,
  textoNaoClassificados,
  textoRecorteDeAtividade,
  textoSecaoVazia,
} from '../billingExceptionsTexts'
import type { BillingExceptionTipo } from '../../shared/types/reports'

const TABLE_ID = 'billing-exceptions'
const TOGGLE_ID = 'billing-exceptions-ignorar-periodo'
/** Prefixo estável dos ids de aba/painel (ver `Tabs` — o painel vive fora dele). */
const TABS_BASE_ID = 'billing-exceptions-secoes'

type BillingExceptionsModalProps = {
  isOpen: boolean
  onClose: () => void
  /** Período da tela (YYYY-MM-DD) — o mesmo que o card usa. */
  from: string | null
  to: string | null
  /**
   * F-15 — contagem de chamados cujo estágio não tem cadastro em `pipelinestages`.
   * AUSENTE (`undefined` **ou** `null`, 121/F4) ⇒ o backend ainda não expõe; a nota
   * aparece sem número.
   */
  naoClassificadosCount?: number | null
}

export function BillingExceptionsModal({
  isOpen,
  onClose,
  from,
  to,
  naoClassificadosCount,
}: BillingExceptionsModalProps) {
  const [tipo, setTipo] = useState<BillingExceptionTipo>(BILLING_EXCEPTIONS_TIPO_INICIAL)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(BILLING_EXCEPTIONS_PAGE_SIZE)
  const [ignorarPeriodo, setIgnorarPeriodo] = useState(false)
  const [sortBy, setSortBy] = useState<string>(BILLING_EXCEPTIONS_SORT_BY)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const query = useBillingExceptions({
    from,
    to,
    tipo,
    ignorarPeriodo,
    page,
    pageSize,
    sortBy,
    sortDirection,
    enabled: isOpen,
  })

  // 121/F7 — as colunas dependem da seção: o cabeçalho de horas afirma o destino delas.
  const columns = useMemo(() => buildBillingExceptionsColumns(tipo), [tipo])

  function handleSort(sortKey: string) {
    if (sortKey === sortBy) {
      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(sortKey)
      setSortDirection('desc')
    }
    setPage(1)
  }

  function handleToggleIgnorarPeriodo(checked: boolean) {
    setIgnorarPeriodo(checked)
    // Trocar o universo de linhas invalida a página atual (a página 7 pode não existir).
    setPage(1)
  }

  function handleTrocarSecao(novoTipo: BillingExceptionTipo) {
    setTipo(novoTipo)
    // A outra seção tem outro conjunto: manter a página seria pedir a página 4 de uma
    // lista de 1 página e mostrar vazio como se não houvesse nada.
    setPage(1)
  }

  const data = query.data
  // "Nada nesta seção" é SUCESSO, não vazio-por-erro (AP-FRONTEND-021): só é lido
  // quando a query resolveu sem erro.
  const isSecaoVazia = !query.isLoading && !query.isError && data?.totalCount === 0

  const abas: TabItem<BillingExceptionTipo>[] = BILLING_EXCEPTIONS_TIPOS.map((t) => ({
    id: t,
    label: TEXTO_SECAO_ROTULO[t],
    // Contagem só da seção carregada — nunca inventamos a da outra.
    badge: t === tipo && data ? data.totalCount : undefined,
  }))

  const notaNaoClassificados = textoNaoClassificados(naoClassificadosCount)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={TEXTO_EXCECOES_TITULO}
      size="xl"
      className="max-w-[90vw] w-[90vw]"
    >
      <div className="flex flex-col gap-4">
        <Tabs<BillingExceptionTipo>
          items={abas}
          value={tipo}
          onChange={handleTrocarSecao}
          label="Seções do relatório de exceções"
          baseId={TABS_BASE_ID}
        />

        {/* 121/F1 — um `role="tabpanel"` para CADA aba, não só para a selecionada
            (contrato documentado no `Tabs`). O `Tabs` emite `aria-controls` em todas as
            abas, e a aba inativa apontava para um id inexistente
            (`getElementById` → `null`, medido pelo QA) ⇒ `aria-valid-attr-value`
            violado. O painel inativo existe só para o id resolver: vai **vazio** (nada
            da outra seção é buscado), com `hidden` (fora da árvore de acessibilidade e
            do fluxo de `Tab`) e SEM classe de `display` — um `flex` venceria o
            `[hidden]` da folha do agente e o painel reapareceria em branco. */}
        {BILLING_EXCEPTIONS_TIPOS.filter((secao) => secao !== tipo).map((secao) => (
          <div
            key={secao}
            role="tabpanel"
            hidden
            id={tabPanelId(TABS_BASE_ID, secao)}
            aria-labelledby={tabId(TABS_BASE_ID, secao)}
          />
        ))}

        <div
          role="tabpanel"
          id={tabPanelId(TABS_BASE_ID, tipo)}
          aria-labelledby={tabId(TABS_BASE_ID, tipo)}
          className="flex flex-col gap-4"
        >
          {/* Definição da seção + recorte aplicado. Os textos são constantes
              compartilhadas com o card: afirmação sobre comportamento do sistema é
              código, não copy (AP-FRONTEND-022). */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="max-w-[70ch] text-xs text-muted">
              {TEXTO_SECAO_DEFINICAO[tipo]}{' '}
              {textoRecorteDeAtividade({ from, to, ignorarPeriodo })}
            </p>
            <div className="flex items-center gap-2">
              <Switch
                id={TOGGLE_ID}
                checked={ignorarPeriodo}
                onChange={handleToggleIgnorarPeriodo}
                label="Ignorar período (todas)"
                hideLabel={false}
              />
              <label htmlFor={TOGGLE_ID} className="text-xs text-foreground cursor-pointer">
                Ignorar período (todas)
              </label>
            </div>
          </div>

          {/* Estados de UI — os 3 obrigatórios + o estado "nada nesta seção" (sucesso). */}
          {query.isLoading && <Skeleton lines={6} />}

          {!query.isLoading && query.isError && (
            <ErrorState
              message="Não foi possível carregar as exceções de faturamento."
              onRetry={() => void query.refetch()}
            />
          )}

          {isSecaoVazia && (
            <EmptyState message={textoSecaoVazia(tipo, { from, to, ignorarPeriodo })} />
          )}

          {!query.isLoading && !query.isError && data && data.totalCount > 0 && (
            <div className="rounded-card border border-border overflow-hidden">
              <DataTable<(typeof data.items)[number]>
                tableId={`${TABLE_ID}-${tipo}`}
                columns={columns}
                data={data.items}
                sortState={{ sortBy, sortDirection }}
                onSort={handleSort}
              />
              <div className="px-5 border-t border-border">
                <Pagination
                  page={data.page}
                  pageSize={data.pageSize}
                  totalCount={data.totalCount}
                  totalPages={data.totalPages}
                  pageSizeOptions={[25, 50, 100, 200]}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size)
                    setPage(1)
                  }}
                />
              </div>
            </div>
          )}

          {/* Ponto cego declarado (F-15): vale para as duas seções, por isso fica
              fora do bloco de estados. */}
          {notaNaoClassificados && (
            <p className="text-xs text-muted" data-testid="excecoes-nota-cega-modal">
              {notaNaoClassificados}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
