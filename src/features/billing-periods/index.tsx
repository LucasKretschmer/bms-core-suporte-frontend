import { useState } from 'react'
import { PageWrapper } from '../../components/layout/PageWrapper'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DataTable } from '../../components/ui/DataTable/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Pagination } from '../../components/ui/Pagination'
import { Skeleton } from '../../components/ui/Skeleton'
import { usePermissions } from '../../hooks/usePermissions'
import { useReturnFocus } from '../../hooks/useReturnFocus'
import { ClientCombobox } from '../reports/shared/components/ClientCombobox'
import { formatMonth } from '../reports/shared/utils/formatters'
import { buildBillingPeriodColumns } from './columns'
import { ComparacaoTable } from './components/ComparacaoTable'
import { ReopenCompetenciaModal } from './components/ReopenCompetenciaModal'
import {
  AVISO_ESTADO_DESCONHECIDO,
  AVISO_HISTORICA,
  COMPARACAO_VAZIA,
  CONFIRMACAO_FECHAR,
  CONFIRMACAO_REFECHAR,
  DESCRICAO_COMPARACAO,
  DESCRICAO_DA_TELA,
  TITULO_COMPARACAO,
  TITULO_DA_TELA,
  TITULO_FECHAR,
} from './competenciaTelaTextos'
import { normalizarEstado } from './estadoDaCompetencia'
import { useBillingPeriodComparison } from './hooks/useBillingPeriodComparison'
import { useBillingPeriodMutations } from './hooks/useBillingPeriodMutations'
import { useBillingPeriods } from './hooks/useBillingPeriods'
import type { BillingPeriodDto, ReabrirCompetenciaFormValues } from './types/billingPeriod'
import { getBillingPeriodErrorMessage } from './utils/billingPeriodErrorMessage'

type CompetenciasPageProps = {
  /** `?competencia=YYYY-MM` — já validada pela rota. */
  competenciaInicial?: string | null
  /** `?comparar=1` — abre a comparação já na competência acima. */
  compararInicial?: boolean
}

const BREADCRUMB = [{ label: 'Administração' }, { label: TITULO_DA_TELA }]

/**
 * 132/F7 — tela de Competências (`GerentePlus`).
 *
 * É a interface de duas decisões: **D12** (a comparação snapshot × cálculo atual, sem a
 * qual "o número de julho mudou sozinho" não tem onde ser investigado) e **C-8** (reabrir
 * e refechar, sem alterar crédito nenhum).
 *
 * Guarda de permissão na **página**, não na rota — mesmo padrão do Sincronizador e de
 * `service-categories`. É UX: o backend é a fonte de verdade e responde 403.
 */
export default function CompetenciasPage({
  competenciaInicial = null,
  compararInicial = false,
}: CompetenciasPageProps) {
  const { isGerentePlus } = usePermissions()
  const tabela = useBillingPeriods()
  const { fechar, reabrir } = useBillingPeriodMutations()

  const [aFechar, setAFechar] = useState<BillingPeriodDto | null>(null)
  const [aReabrir, setAReabrir] = useState<BillingPeriodDto | null>(null)
  const [erroDaReabertura, setErroDaReabertura] = useState<string | null>(null)
  const [emComparacao, setEmComparacao] = useState<string | null>(
    compararInicial && competenciaInicial != null ? competenciaInicial : null,
  )

  // A prisão do foco é do overlay; a DEVOLUÇÃO é de quem abre (`AP-FRONTEND-004`).
  const focoDoFechamento = useReturnFocus()
  const focoDaReabertura = useReturnFocus()

  function abrirFechamento(periodo: BillingPeriodDto) {
    focoDoFechamento.capture()
    setAFechar(periodo)
  }

  function fecharDialogoDeFechamento() {
    setAFechar(null)
    focoDoFechamento.restore()
  }

  function abrirReabertura(periodo: BillingPeriodDto) {
    focoDaReabertura.capture()
    setErroDaReabertura(null)
    setAReabrir(periodo)
  }

  function fecharDialogoDeReabertura() {
    setAReabrir(null)
    setErroDaReabertura(null)
    focoDaReabertura.restore()
  }

  function confirmarFechamento() {
    if (aFechar == null) return
    fechar.mutate(aFechar.competencia, { onSuccess: fecharDialogoDeFechamento })
  }

  function confirmarReabertura(values: ReabrirCompetenciaFormValues) {
    if (aReabrir == null) return
    setErroDaReabertura(null)
    reabrir.mutate(
      { competencia: aReabrir.competencia, ...values },
      {
        onSuccess: fecharDialogoDeReabertura,
        // O erro fica DENTRO do diálogo: o 409 traz a contagem de créditos dependentes e
        // o que fazer. Um toast que fecha a tela esconderia exatamente isso.
        onError: (error: unknown) => setErroDaReabertura(getBillingPeriodErrorMessage(error)),
      },
    )
  }

  const colunas = buildBillingPeriodColumns({
    onFechar: abrirFechamento,
    onReabrir: abrirReabertura,
    onComparar: (periodo) => setEmComparacao(periodo.competencia),
    isFechando: fechar.isPending,
    isReabrindo: reabrir.isPending,
  })

  const itens = tabela.data?.items ?? []
  const estadosNaPagina = itens.map((item) => normalizarEstado(item.estado))
  const temHistorica = estadosNaPagina.includes('historica')
  const temDesconhecido = estadosNaPagina.includes('desconhecido')

  const estadoAFechar = aFechar == null ? 'desconhecido' : normalizarEstado(aFechar.estado)
  const eRefechamento = estadoAFechar === 'reaberta'

  if (!isGerentePlus) {
    return (
      <ErrorState message="Você não tem permissão para acessar esta área." className="mt-16" />
    )
  }

  return (
    <PageWrapper title={TITULO_DA_TELA} breadcrumbItems={BREADCRUMB}>
      <div className="flex flex-col gap-4">
        <p className="max-w-3xl text-sm text-foreground/70">{DESCRICAO_DA_TELA}</p>

        {/* Avisos derivados do ESTADO que veio no payload — nunca da data (C-6). */}
        {temHistorica && (
          <section
            aria-label="Competências anteriores ao congelamento"
            className="rounded-card border border-line bg-warning-bg p-3 text-sm text-warning-fg"
          >
            {AVISO_HISTORICA}
          </section>
        )}
        {temDesconhecido && (
          <section
            aria-label="Competências com estado não reconhecido"
            className="rounded-card border border-line bg-background p-3 text-sm text-foreground"
          >
            {AVISO_ESTADO_DESCONHECIDO}
          </section>
        )}

        {tabela.isLoading && (
          <div className="bg-card rounded-card border border-border p-6">
            <Skeleton lines={6} />
          </div>
        )}
        {!tabela.isLoading && tabela.isError && (
          <ErrorState
            message="Não foi possível carregar as competências."
            onRetry={() => tabela.refetch()}
          />
        )}
        {!tabela.isLoading && !tabela.isError && itens.length === 0 && (
          <EmptyState message="Nenhuma competência encontrada." announce />
        )}
        {!tabela.isLoading && !tabela.isError && itens.length > 0 && (
          <>
            <div className="bg-card rounded-card border border-border overflow-hidden">
              <DataTable tableId="billing-periods" columns={colunas} data={itens} />
            </div>
            {tabela.data != null && (
              <Pagination
                page={tabela.data.page}
                pageSize={tabela.data.pageSize}
                totalCount={tabela.data.totalCount}
                totalPages={tabela.data.totalPages}
                onPageChange={tabela.setPage}
                onPageSizeChange={tabela.setPageSize}
              />
            )}
          </>
        )}

        {emComparacao != null && (
          <ComparacaoSecao
            /* `key` remonta a seção ao trocar de competência: paginação e filtro voltam ao
               início, e a `queryKey` nasce já com o mês certo (ver o hook). */
            key={emComparacao}
            competencia={emComparacao}
            onFechar={() => setEmComparacao(null)}
          />
        )}
      </div>

      <ConfirmDialog
        isOpen={aFechar !== null}
        title={eRefechamento ? 'Refechar competência' : TITULO_FECHAR}
        description={
          aFechar == null
            ? ''
            : `${formatMonth(aFechar.competencia)}. ${
                eRefechamento ? CONFIRMACAO_REFECHAR : CONFIRMACAO_FECHAR
              }`
        }
        confirmLabel={eRefechamento ? 'Refechar' : 'Fechar competência'}
        isLoading={fechar.isPending}
        onConfirm={confirmarFechamento}
        onClose={fecharDialogoDeFechamento}
      />

      <ReopenCompetenciaModal
        periodo={aReabrir}
        onClose={fecharDialogoDeReabertura}
        onConfirm={confirmarReabertura}
        isSubmitting={reabrir.isPending}
        erroDoServidor={erroDaReabertura}
      />
    </PageWrapper>
  )
}

type ComparacaoSecaoProps = {
  competencia: string
  onFechar: () => void
}

/**
 * A comparação de auditoria (D12 · `arquitetura.md` §8.2). Vive numa seção própria, com
 * paginação e filtro por cliente próprios — e com os três estados de UI, como qualquer
 * outra listagem.
 */
function ComparacaoSecao({ competencia, onFechar }: ComparacaoSecaoProps) {
  const comparacao = useBillingPeriodComparison(competencia)
  const itens = comparacao.data?.items ?? []

  return (
    <section
      aria-label={`${TITULO_COMPARACAO} — ${formatMonth(competencia)}`}
      className="flex flex-col gap-3 rounded-card border border-line bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">
            {TITULO_COMPARACAO} — {formatMonth(competencia)}
          </h2>
          <p className="max-w-3xl text-sm text-foreground/70">{DESCRICAO_COMPARACAO}</p>
        </div>
        <Button variant="secondary" onClick={onFechar}>
          Fechar comparação
        </Button>
      </div>

      <div className="w-72">
        <ClientCombobox
          value={comparacao.filters.clientId}
          onChange={(clientId) => comparacao.setFilters({ clientId })}
          label="Filtrar por cliente"
        />
      </div>

      {comparacao.isLoading && <Skeleton lines={4} />}
      {!comparacao.isLoading && comparacao.isError && (
        <ErrorState
          message="Não foi possível carregar a comparação desta competência."
          onRetry={() => comparacao.refetch()}
        />
      )}
      {!comparacao.isLoading && !comparacao.isError && itens.length === 0 && (
        <EmptyState message={COMPARACAO_VAZIA} announce />
      )}
      {!comparacao.isLoading && !comparacao.isError && itens.length > 0 && (
        <>
          <ComparacaoTable itens={itens} />
          {comparacao.data != null && (
            <Pagination
              page={comparacao.data.page}
              pageSize={comparacao.data.pageSize}
              totalCount={comparacao.data.totalCount}
              totalPages={comparacao.data.totalPages}
              onPageChange={comparacao.setPage}
              onPageSizeChange={comparacao.setPageSize}
            />
          )}
        </>
      )}
    </section>
  )
}
