/**
 * 127/FE-AJUDA — o `(?)` da tela de **Consumo de Planos**.
 *
 * Recolhe atrás de um botão a nota **"Como o período é contado aqui"**
 * (`CompetenciaNota`), que ocupava o topo da tela e empurrava a tabela para baixo
 * (decisão do usuário em 08/09/2026, olhando a tela).
 *
 * ## 🔴 O que a 132 removeu daqui, e o que ela NÃO removeu (`FE/D-1`)
 *
 * Até a 132 este componente hospedava **duas** coisas: a nota de competência **e** o
 * card de exceções de faturamento, com o botão *Conferir* e um **indicador** de quatro
 * estados no próprio gatilho.
 *
 * A 132/D7 removeu **as exceções**. Com `TimeEntry.InicioEm` como competência (D1), a
 * hora é faturada no mês em que foi **apontada** — chamado aberto ou fechado —, logo
 * "chamado fora de qualquer fatura" deixou de ser um conjunto: não há o que conferir,
 * nem o que indicar. Saíram o card, a query do resumo, o indicador, o selo e a região
 * `role="status"` que anunciava a transição entre os estados.
 *
 * ⚠️ **A nota de competência FICOU, e isso é requisito, não sobra.** A instrução
 * original da remoção (`R32`) apontava para as linhas que renderizam **este
 * componente** — o hospedeiro —, não para o hóspede. Cumprida ao pé da letra, ela
 * apagaria a explicação de como o período é contado **no mês em que essa regra
 * mudou**, que é exatamente quando o gestor abre o `(?)`. Ver `FE/D-1` em
 * `decisoes-ratificadas.md` §2.
 *
 * Sem requisição nenhuma, o componente não tem mais estado de carga nem de falha — e
 * portanto nada a distinguir no gatilho. O `aria-label`, que era o indicador, virou um
 * texto fixo que **não afirma conferência** (`planConsumptionHelpTexts.ts`).
 *
 * A11y: `<button>` real (teclado de graça), `aria-expanded` + `aria-controls` apontando
 * para um elemento que **existe nos dois estados**, foco visível pelo anel global da
 * demanda 126 (nenhum `outline-none` aqui). O conteúdo só é montado quando aberto, para
 * que nenhum focável fique escondido no anel de Tab.
 */

import { useId, useState } from 'react'
import { clsx } from 'clsx'
import { CompetenciaNota } from '../../shared/components/CompetenciaNota'
import { TEXTO_QTDE_TICKETS_RECORTE_PROPRIO } from '../../shared/utils/competenciaTexts'
import {
  TEXTO_AJUDA_NOME_ACESSIVEL,
  TEXTO_AJUDA_ROTULO,
} from '../planConsumptionHelpTexts'

type PlanConsumptionHelpProps = {
  /** Período da tela (YYYY-MM-DD) — a MESMA fonte da tabela e do export. */
  from: string | null
  to: string | null
  className?: string
}

export function PlanConsumptionHelp({ from, to, className }: PlanConsumptionHelpProps) {
  const [isOpen, setIsOpen] = useState(false)
  const conteudoId = useId()

  return (
    <div className={clsx('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={conteudoId}
          aria-label={TEXTO_AJUDA_NOME_ACESSIVEL}
          onClick={() => setIsOpen((aberto) => !aberto)}
          data-testid="ajuda-gatilho"
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
        </button>
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
          /* 131: nesta tela projeto NÃO consome o plano — enquadramento próprio,
             nunca o mesmo do Relatório do Cliente. */
          <CompetenciaNota from={from} to={to} notaDeProjeto="fora-do-plano" comparaSaudePlanos />
        )}

        {/*
          🔴 **135/G1 — o recorte PRÓPRIO da coluna "Qtde. Tickets", AO LADO da nota e
          nunca dentro dela.** `CompetenciaNota` é compartilhada com o Relatório do
          Cliente, que **não tem** esta coluna: um parágrafo incondicional lá afirmaria a
          existência de uma coluna inexistente naquela tela (AP-FRONTEND-028, o 5º lugar —
          a 132 já pagou esse defeito uma vez).

          Entra **dentro** do disclosure, não acima dele: solto na tela, voltaria a empurrar
          a tabela para baixo, que é exatamente a decisão de 127/FE-AJUDA. E o nome
          acessível do `(?)` ("como o período é contado nesta tela") continua verdadeiro —
          este parágrafo é sobre como o período é contado.
        */}
        {isOpen && (
          <p
            className="rounded-card border border-line bg-card shadow-card p-4 text-xs text-foreground"
            data-testid="ajuda-qtde-tickets"
          >
            {TEXTO_QTDE_TICKETS_RECORTE_PROPRIO}
          </p>
        )}
      </div>
    </div>
  )
}
