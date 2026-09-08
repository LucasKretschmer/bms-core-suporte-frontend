/**
 * 127/FE-AJUDA — o `(?)` da tela de **Consumo de Planos**.
 *
 * Recolhe atrás de um botão os dois blocos que ocupavam o topo da tela e empurravam a
 * tabela para baixo (decisão do usuário em 08/09/2026, olhando a tela):
 *  1. a nota **"Como o período é contado aqui"** (`CompetenciaNota`);
 *  2. o **card de exceções de faturamento** (`BillingExceptionsCard`) — com o botão
 *     **Conferir** que ele traz.
 *
 * ## A ressalva que este componente carrega
 *
 * O card era **sempre renderizado**, inclusive zerado, porque esconder no zero tornaria
 * *"não há exceções"* indistinguível de *"a requisição falhou"* (`AP-FRONTEND-021`), e
 * porque a conferência acontece **enquanto** o gestor olha os números da fatura — página
 * separada só é aberta por quem lembra que ela existe. Com tudo recolhido, essas duas
 * garantias migram para o **próprio gatilho**:
 *
 *  - a **distinção** vive no `aria-label` do botão, que muda nos quatro estados
 *    (`planConsumptionHelpTexts.ts`) — logo é lida por quem usa leitor de tela **sem
 *    abrir nada**, e não depende de enxergar cor nenhuma;
 *  - o **chamamento** vive no selo: glifo/número visível (`…`, `!`, `3`), com cor apenas
 *    como reforço. Cor **nunca** é o único meio (WCAG 1.4.1).
 *
 * Por isso a query do resumo (`useBillingExceptionsSummary`) é feita **aqui**, e não só
 * dentro do card: o indicador precisa do número mesmo com o conteúdo fechado. Quando o
 * usuário abre, o card chama o MESMO hook com a MESMA `queryKey` — o TanStack Query serve
 * do cache e **nenhuma requisição nova** é disparada (há teste para isso).
 *
 * ⚠️ **Não abre sozinho quando há anomalias.** A decisão foi "os dois ficam recolhidos"; um
 * auto-abrir a contradiria e devolveria o empurrão na tabela justamente no mês com
 * problema. O que compensa o risco é o indicador — e é ele que os testes travam.
 *
 * A11y: `<button>` real (teclado de graça), `aria-expanded` + `aria-controls` apontando
 * para um elemento que **existe nos dois estados**, foco visível pelo anel global da
 * demanda 126 (nenhum `outline-none` aqui).
 */

import { useId, useState } from 'react'
import { clsx } from 'clsx'
import { CompetenciaNota } from '../../shared/components/CompetenciaNota'
import { EXCECAO_FATURA_CLASSES } from '../../shared/utils/faturamentoTheme'
import { useBillingExceptionsSummary } from '../hooks/useBillingExceptions'
import {
  TEXTO_AJUDA_ROTULO,
  indicadorDeConferencia,
  type EstadoDaConferencia,
} from '../planConsumptionHelpTexts'
import { BillingExceptionsCard } from './BillingExceptionsCard'

type PlanConsumptionHelpProps = {
  /** Período da tela (YYYY-MM-DD) — a MESMA fonte da tabela e do export. */
  from: string | null
  to: string | null
  className?: string
}

/**
 * Cor do selo **por estado**, sempre por token (nunca hex). É reforço: o que discrimina
 * é o glifo e o nome acessível.
 *
 * `zero` não tem selo — o repouso é a ausência de marca, e o texto do `aria-label` é que
 * diz "nenhum chamado exige conferência".
 */
const CLASSES_DO_SELO: Record<EstadoDaConferencia, string> = {
  carregando: 'border-line bg-card text-muted',
  erro: 'border-error-fg/40 bg-error-bg text-error-fg',
  zero: '',
  pendente: `border-excecao-fatura-fg/40 bg-excecao-fatura-bg ${EXCECAO_FATURA_CLASSES.accent}`,
}

export function PlanConsumptionHelp({ from, to, className }: PlanConsumptionHelpProps) {
  const [isOpen, setIsOpen] = useState(false)
  const conteudoId = useId()

  const query = useBillingExceptionsSummary({ from, to })
  const indicador = indicadorDeConferencia({
    isLoading: query.isLoading,
    isError: query.isError,
    anomaliasCount: query.data?.anomaliasCount,
  })

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={conteudoId}
          aria-label={indicador.nomeAcessivel}
          onClick={() => setIsOpen((aberto) => !aberto)}
          data-testid="ajuda-gatilho"
          data-estado={indicador.estado}
          className={clsx(
            'inline-flex items-center gap-2 rounded-control border border-line bg-card',
            'px-3 py-1.5 text-sm font-semibold text-foreground',
            // Hover por SOMBRA (design system BMS) — nunca só troca de cor.
            'shadow-card hover:shadow-hover',
          )}
        >
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full border border-line text-xs font-bold leading-none"
            data-testid="ajuda-glifo"
          >
            ?
          </span>
          {TEXTO_AJUDA_ROTULO}
          {indicador.selo !== null && (
            <span
              data-testid="ajuda-selo"
              className={clsx(
                'inline-flex min-w-5 items-center justify-center rounded-full border px-1.5 text-xs font-bold leading-5',
                CLASSES_DO_SELO[indicador.estado],
              )}
            >
              {indicador.selo}
            </span>
          )}
        </button>

        {/*
          O nome acessível do botão MUDA quando a requisição resolve, e mudança de
          `aria-label` não é anunciada a quem já leu o botão. Esta região `status`
          (polida, sr-only) carrega a mesma frase — é o que torna a transição
          "carregando → 3 chamados exigem conferência" perceptível sem foco nenhum.
        */}
        <p className="sr-only" role="status" data-testid="ajuda-anuncio">
          {indicador.nomeAcessivel}
        </p>
      </div>

      {/*
        O contêiner existe nos DOIS estados (o `aria-controls` acima aponta para um id
        real); o conteúdo é montado só quando aberto, para que nenhum focável fique
        escondido no anel de Tab.
      */}
      <div
        id={conteudoId}
        hidden={!isOpen}
        className={clsx(isOpen && 'flex flex-col gap-4')}
        data-testid="ajuda-conteudo"
      >
        {isOpen && (
          <>
            {/* 131: nesta tela projeto NÃO consome o plano — enquadramento próprio,
                nunca o mesmo do Relatório do Cliente. */}
            <CompetenciaNota from={from} to={to} notaDeProjeto="fora-do-plano" comparaSaudePlanos />
            <BillingExceptionsCard from={from} to={to} />
          </>
        )}
      </div>
    </div>
  )
}
