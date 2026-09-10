import type { ColumnDef } from '../../../components/ui/DataTable/types'
import type { PlanConsumptionItemDto } from '../shared/types/reports'
import { formatHours, formatPercent } from '../shared/utils/formatters'
import {
  TOOLTIP_HORAS_ADICIONAIS,
  TOOLTIP_HORAS_ANALISE,
  TOOLTIP_HORAS_FATURAVEIS,
  TOOLTIP_HORAS_RESTANTES,
  TOOLTIP_HORAS_USADAS,
  TOOLTIP_QTDE_PLANO,
  TOOLTIP_QTDE_TICKETS,
} from '../shared/utils/competenciaTexts'
import { PlanoComCredito } from './components/PlanoComCredito'
import React from 'react'

/**
 * Aplica máscara de CNPJ: XX.XXX.XXX/XXXX-XX
 *
 * 129/FE-PCT — aceita `undefined` porque o backend omite a chave quando `Cnpj` é nulo
 * (`WhenWritingNull`, `Program.cs:210-215`). O `!` já cobria os dois casos em runtime;
 * o que estava errado era a **assinatura**, que obrigava o call site a mentir sobre o wire.
 */
function formatCnpj(cnpj: string | null | undefined): string {
  // `== null` cobre chave ausente E `null`; o `|| ''` mantém o comportamento anterior
  // (string vazia do wire também é "não informado").
  if (cnpj == null || cnpj === '') return '—'
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

/**
 * Cor do percentual de plano:
 * < 80%  → verde
 * 80–95% → amarelo
 * ≥ 95%  → vermelho (pode exceder 100%)
 * ausente/nulo → **neutro** (ver abaixo)
 */
export type PercentClass = 'green' | 'yellow' | 'red' | 'neutral'

/**
 * 129/FE-PCT — o guard é `== null`, e o parâmetro aceita `undefined`, porque
 * `PercentualPlano` é `decimal?` no backend e a API omite a chave quando é nulo
 * (`WhenWritingNull`, `Program.cs:210-215`). Com `=== null` e parâmetro estreito, o
 * `undefined` caía por **todos** os `<` (toda comparação com `undefined` é `false`) e a
 * função devolvia `'red'`: a tela que decide faturamento pintava de vermelho —
 * "estourou o plano" — um cliente cujo percentual é **desconhecido**. Desconhecido é
 * `'neutral'`; a célula ao lado já mostra "—" (`formatPercent`).
 */
export function getPercentClass(value: number | null | undefined): PercentClass {
  if (value == null) return 'neutral'
  if (value < 80) return 'green'
  if (value < 95) return 'yellow'
  return 'red'
}

const percentColorClasses: Record<PercentClass, string> = {
  green: 'text-success-fg font-medium',
  yellow: 'text-warning-fg font-medium',
  red: 'text-error-fg font-medium',
  neutral: 'text-foreground',
}

/**
 * Colunas da tabela U3 — Consumo de Planos.
 * Ordem exata conforme PRD. sortKey deve casar com a whitelist do backend.
 *
 * 123/FAT-1 — os `headerInfo` das colunas de horas vivem em
 * `shared/utils/competenciaTexts.ts`, com a âncora de backend de cada afirmação. Antes eles
 * diziam genericamente "no período": quem filtrava julho e não via a hora apontada em julho
 * concluía que o sistema tinha perdido o dado. Desde a 121 o recorte é por DATA DE CONCLUSÃO
 * do chamado, e agora a coluna diz isso.
 */
export const planConsumptionColumns: ColumnDef<PlanConsumptionItemDto>[] = [
  {
    key: 'cnpj',
    header: 'CNPJ',
    sortable: true,
    sortKey: 'cnpj',
    align: 'left',
    accessor: (row) => formatCnpj(row.cnpj),
  },
  {
    key: 'nomeFantasia',
    header: 'Nome Fantasia',
    sortable: true,
    sortKey: 'nomefantasia',
    align: 'left',
    accessor: (row) => row.nomeFantasia ?? '—',
  },
  {
    key: 'razaoSocial',
    header: 'Razão Social',
    sortable: true,
    sortKey: 'razaosocial',
    align: 'left',
    accessor: (row) => row.razaoSocial ?? '—',
  },
  {
    key: 'nomePlano',
    header: 'Nome do Plano',
    sortable: true,
    sortKey: 'nomeplano',
    align: 'left',
    accessor: (row) => row.nomePlano ?? '—',
  },
  {
    key: 'qtdePlanoHoras',
    header: 'Qtde. Plano (h)',
    // 🔴 132/F4b — a coluna passou a declarar o recorte, porque o CRÉDITO é por competência
    // (`creditoshoras.competencia`): o plano exibido depende do período filtrado, e antes da
    // 132 não dependia. Ver a justificativa nova em `columns.competencia.test.ts`.
    headerInfo: TOOLTIP_QTDE_PLANO,
    sortable: true,
    // ⚠️ A ordenação continua sendo pelo plano BASE (`qtdeplano` é a whitelist do backend,
    // `ReportQueryRepository.cs`): não há coluna de plano efetivo na ordenação, e inventar
    // uma chave aqui devolveria 400. Declarado para quem estranhar a diferença.
    sortKey: 'qtdeplano',
    align: 'right',
    // 132/D11 — `15h + 2h`, com o crédito em verde + reforço textual + ⓘ (D15).
    // `columns.ts` é `.ts` e usa `React.createElement` de propósito (ver `percentualPlano`
    // abaixo): renomear para `.tsx` mexeria em 5 imports e nos 4 arquivos de teste.
    accessor: (row) => React.createElement(PlanoComCredito, { item: row }),
  },
  {
    key: 'horasUsadas',
    header: 'Horas Usadas',
    headerInfo: TOOLTIP_HORAS_USADAS,
    sortable: true,
    sortKey: 'horasusadas',
    align: 'right',
    accessor: (row) => formatHours(row.horasUsadas),
  },
  {
    key: 'horasRestantes',
    header: 'Horas Restantes',
    headerInfo: TOOLTIP_HORAS_RESTANTES,
    sortable: true,
    sortKey: 'horasrestantes',
    align: 'right',
    accessor: (row) => formatHours(row.horasRestantes),
  },
  {
    key: 'horasAdicionais',
    header: 'Horas Adicionais',
    headerInfo: TOOLTIP_HORAS_ADICIONAIS,
    sortable: true,
    sortKey: 'horasadicionais',
    align: 'right',
    accessor: (row) => formatHours(row.horasAdicionais),
  },
  {
    key: 'percentualPlano',
    header: '% do Plano',
    sortable: true,
    sortKey: 'percentual',
    align: 'right',
    accessor: (row) => {
      const colorClass = percentColorClasses[getPercentClass(row.percentualPlano)]
      return React.createElement('span', { className: colorClass }, formatPercent(row.percentualPlano))
    },
  },
  {
    key: 'horasFaturaveis',
    header: 'Horas Faturáveis',
    headerInfo: TOOLTIP_HORAS_FATURAVEIS,
    sortable: true,
    sortKey: 'horasfaturaveis',
    align: 'right',
    accessor: (row) => formatHours(row.horasFaturaveis),
  },
  {
    key: 'horasAnalise',
    header: 'Horas de Análise',
    headerInfo: TOOLTIP_HORAS_ANALISE,
    sortable: true,
    sortKey: 'horasanalise',
    align: 'right',
    accessor: (row) => formatHours(row.horasAnalise),
  },
  {
    key: 'qtdeTickets',
    // Literal do usuário (`prd.md` §1/§7): "Tickets" no cabeçalho, "chamados" na prosa.
    // Divergência DELIBERADA, registrada em `analise-frontend.md` P-8.
    header: 'Qtde. Tickets',
    // 🔴 135/G1 — a ÚNICA coluna desta tela cujo recorte é a data de ABERTURA do chamado
    // (`Ticket.HsCriadoEm`), e não o apontamento. O número **não explica** as horas ao lado,
    // de propósito (PRD §2) — e é o tooltip que impede a leitura "então um deles está errado".
    // O padrão que este texto tem de declarar é `/abertura/i`, NUNCA `/apontad/`
    // (`columns.competencia.test.ts`).
    headerInfo: TOOLTIP_QTDE_TICKETS,
    sortable: true,
    // `qtdetickets` (minúscula) é a 12ª chave da whitelist de ordenação do backend
    // (`ReportQueryRepository.cs:1272`), servindo os dois caminhos — ao vivo e snapshot.
    // 🔴 `sortable: true` com chave FORA da whitelist é **seta que mente**: o backend cai no
    // default (`horasusadas desc`) em silêncio, sem erro, sem log e sem teste vermelho. A
    // coluna nasce ordenável PORQUE a entrada da whitelist entra no mesmo commit do backend —
    // e a identidade do token front↔backend vive em `columns.test.ts`.
    // ⚠️ Dependência de DEPLOY (tracker R-7): as duas pontas sobem juntas.
    sortKey: 'qtdetickets',
    // Precedente de célula de contagem em tabela: `movimentacao-diaria/columns.tsx:63-71`.
    align: 'right',
    width: '120px',
    // 🔴 O guard é `== null`, NUNCA `=== undefined` (AP-FRONTEND-028): cobre a chave AUSENTE
    // do backend anterior à 135 — o estado normal entre dois deploys — e também um `null` que
    // o serializador não deveria mandar.
    // 🔴 E `0` renderiza `'0'`, nunca `'—'`: a partir da 135, `0` é o valor NORMAL de um
    // cliente sem chamado aberto no período. `0` × ausência são telas DIFERENTES
    // (`tracker.md` R-10), ao contrário do crédito da 132.
    // 🔴 O ramo proibido é o **falsy check** — `if (!v)`, `v || '—'` —: é ele que colapsa
    // `0` em ausência e afirma "não sei" sobre um zero conhecido. MEDIDO: a mutação M-2 da
    // U2 (`|| '—'`) deixa 2 casos vermelhos em `columns.qtdeTickets.test.tsx`.
    // ⚠️ `?? '—'` **não é esse defeito**: `0 ?? '—'` continua `0`. A mutação M-2eq provou a
    // equivalência (0 vermelhos). O ternário explícito fica porque **nomeia os dois ramos**,
    // não porque `??` estaria errado — a `analise-frontend.md` §7.2/M-2 diz `?? '—'` e é
    // impreciso; está reportado ao Manager, e o contrato de R-10 continua intacto.
    // Número CRU, sem `Intl`: não existe `formatInteger` no repo e `formatDecimal` imprimiria
    // `12,0` para 12 chamados. Criar formatador de inteiro está fora do pedido.
    accessor: (row) => (row.qtdeTickets == null ? '—' : row.qtdeTickets),
  },
]
