/**
 * 121/A2 (D2) + F-15 — card de exceções de faturamento, na própria tela de Consumo de
 * Planos.
 *
 * Por que **aqui** e não numa página nova no menu (§5.3): a conferência acontece
 * enquanto o gestor olha os números da fatura, imediatamente antes de fechar o mês.
 * Página separada só é aberta por quem lembra que ela existe — e o modo de falha que
 * D2 combate é justamente o silêncio.
 *
 * F-15 — DUAS linhas, com hierarquia visual deliberada:
 *  1. **Precisa ação** (anomalias): o que exige conferência humana. Define o tom do
 *     card (alerta quando > 0);
 *  2. **Postergado**: informativo — responde "quanto saiu desta fatura, e por quê".
 *     Nunca ganha tom de alerta: pedir ação onde não há ação é o mesmo defeito de
 *     misturar as duas listas.
 * Mais a nota do ponto cego (estágio sem cadastro), que é invisível por construção.
 *
 * ⚠️ O card é **sempre renderizado**, inclusive com tudo zerado. Esconder no zero
 * tornaria "não há exceções" indistinguível de "a requisição falhou"
 * (AP-FRONTEND-021).
 *
 * ⚠️ Endpoints = unidade FAT-4, ainda inexistentes. Escrito contra o contrato §8 +
 * o contrato do resumo que esta unidade congelou (ver `dev-fat-5-report.md`).
 */

import { useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Button } from '../../../../components/ui/Button'
import { ErrorState } from '../../../../components/ui/ErrorState'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { formatSeconds } from '../../shared/utils/formatters'
import { EXCECAO_FATURA_CLASSES } from '../../shared/utils/faturamentoTheme'
import {
  TEXTO_EXCECOES_ACAO,
  TEXTO_EXCECOES_TITULO,
  TEXTO_SECAO_ROTULO,
  textoContagemSecao,
  textoHorasSecao,
  textoNaoClassificados,
  textoRecorteDeAtividade,
  textoSecaoVazia,
} from '../billingExceptionsTexts'
import { useBillingExceptionsSummary } from '../hooks/useBillingExceptions'
import { BillingExceptionsModal } from './BillingExceptionsModal'

type BillingExceptionsCardProps = {
  /** Período da tela (YYYY-MM-DD) — o card filtra por atividade nesta janela. */
  from: string | null
  to: string | null
  className?: string
}

/** Moldura comum a todos os estados — garante que o card nunca "desaparece". */
function CardShell({
  children,
  tone = 'neutro',
  className,
}: {
  children: React.ReactNode
  tone?: 'neutro' | 'alerta'
  className?: string
}) {
  return (
    <section
      aria-label={TEXTO_EXCECOES_TITULO}
      className={clsx(
        'rounded-card border p-4',
        tone === 'alerta'
          ? EXCECAO_FATURA_CLASSES.surface
          : 'bg-card border-line shadow-card',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function BillingExceptionsCard({ from, to, className }: BillingExceptionsCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Devolve o foco ao gatilho ao fechar o modal (AP-FRONTEND-004: o ref precisa
  // chegar ao <button> real — o Button do app é forwardRef).
  const triggerRef = useRef<HTMLButtonElement>(null)

  const query = useBillingExceptionsSummary({ from, to })

  function handleClose() {
    setIsModalOpen(false)
    // setTimeout(0): o Modal desmonta no mesmo commit; focar antes seria no-op.
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }

  if (query.isLoading) {
    return (
      <CardShell className={className}>
        <Skeleton lines={2} height="h-4" />
      </CardShell>
    )
  }

  if (query.isError) {
    return (
      <CardShell className={className}>
        <ErrorState
          message="Não foi possível verificar as exceções de faturamento."
          onRetry={() => void query.refetch()}
        />
      </CardShell>
    )
  }

  const resumo = query.data
  if (!resumo) {
    // Sucesso sem corpo não deveria acontecer; mantém o card visível em vez de
    // trocar a tela por nada.
    return (
      <CardShell className={className}>
        <ErrorState
          message="Não foi possível verificar as exceções de faturamento."
          onRetry={() => void query.refetch()}
        />
      </CardShell>
    )
  }

  const temAnomalia = resumo.anomaliasCount > 0
  const temPostergado = resumo.postergadoCount > 0
  const notaNaoClassificados = textoNaoClassificados(resumo.naoClassificadosCount)

  return (
    <>
      <CardShell tone={temAnomalia ? 'alerta' : 'neutro'} className={className}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {/* Seção 1 — acionável. Dita o tom do card. */}
            <p
              className={clsx(
                'text-sm font-bold',
                temAnomalia ? EXCECAO_FATURA_CLASSES.accent : 'text-foreground',
              )}
              data-testid="excecoes-anomalias"
            >
              {temAnomalia
                ? `${TEXTO_SECAO_ROTULO.anomalia}: ${textoContagemSecao('anomalia', resumo.anomaliasCount)} · ${textoHorasSecao('anomalia', formatSeconds(resumo.anomaliasSegundos))}`
                : textoSecaoVazia('anomalia', { from, to })}
            </p>

            {/* Seção 2 — informativa. Nunca em tom de alerta. */}
            <p className="text-xs text-foreground" data-testid="excecoes-postergado">
              {temPostergado
                ? `${TEXTO_SECAO_ROTULO.postergado}: ${textoContagemSecao('postergado', resumo.postergadoCount)} · ${textoHorasSecao('postergado', formatSeconds(resumo.postergadoSegundos))} (não exige ação).`
                : textoSecaoVazia('postergado', { from, to })}
            </p>

            <p className="max-w-[80ch] text-xs text-muted">
              {textoRecorteDeAtividade({ from, to })}
            </p>

            {notaNaoClassificados && (
              <p className="max-w-[80ch] text-xs text-muted" data-testid="excecoes-nota-cega">
                {notaNaoClassificados}
              </p>
            )}
          </div>

          {(temAnomalia || temPostergado) && (
            <Button
              ref={triggerRef}
              variant="secondary"
              onClick={() => setIsModalOpen(true)}
              aria-label={`${TEXTO_EXCECOES_ACAO} exceções de faturamento`}
            >
              {TEXTO_EXCECOES_ACAO}
            </Button>
          )}
        </div>
      </CardShell>

      {isModalOpen && (
        <BillingExceptionsModal
          isOpen
          onClose={handleClose}
          from={from}
          to={to}
          naoClassificadosCount={resumo.naoClassificadosCount}
        />
      )}
    </>
  )
}
