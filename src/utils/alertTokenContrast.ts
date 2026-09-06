/**
 * 123/FE-A2 + 123/FE-FIX3 — inventário auditável dos pares de contraste da FAMÍLIA de
 * tokens de ERRO (`--color-error`, `--color-error-fg`, `--color-error-bg`,
 * `--color-alert-error`) e das superfícies em que ela é pintada.
 *
 * ## Por que este arquivo existe
 *
 * O QA da rodada 4 (achado `A-2`) mediu `--color-error-fg: #ff0000` sobre
 * `--color-card: #ffffff` em **4,00:1** — abaixo do piso AA de 4,5:1 — com o token
 * usado como TEXTO em ~20 call sites (`text-error-fg`). A decisão registrada
 * (`AUTO-3`) foi escurecer o token, e não trocar os call sites: uma mudança de valor
 * corrige todos de uma vez.
 *
 * A rodada 3 do QA mostrou que isso corrigiu **o token errado para a superfície do
 * achado** (`F-1`): a mensagem de validação inline dos formulários é pintada pelos
 * componentes COMPILADOS do design system com a classe `text-error`, que resolve
 * `--color-error` — token IRMÃO e quase homônimo, que continuava em `#ff0000`.
 * A 123/FE-FIX3 escureceu também `--color-error` (em `src/styles/global.css`, que
 * sobrescreve o `@theme` do pacote) e trouxe os pares dele para cá.
 *
 * `rules/frontend.md` § Contraste manda deixar "um teste que calcula o contraste de
 * todos os pares do mapa e falha abaixo de 4,5:1 — vale mais que os números do dia da
 * entrega". Este módulo é o **mapa**; `alertTokenContrast.test.ts` é o teste.
 *
 * ## Por que o hex aparece espelhado aqui
 *
 * jsdom/Vitest não resolve `var(--color-*)` sem o CSS real carregado (mesma limitação
 * já documentada em `features/reports/appointments/statusColors.ts`). Para que as duas
 * pontas não divirjam em silêncio, o teste companheiro **LÊ** `src/styles/global.css`
 * (e o `styles.css` do design system, para os tokens herdados) e exige que cada hex
 * abaixo seja idêntico ao do CSS real — o inventário não é mantido à mão nas duas
 * pontas (`rules/security.md` § "enumeração que dá poder a um invariante").
 *
 * ## O que a 123/FE-FIX3 acrescentou: os CALL SITES são DERIVADOS da fonte
 *
 * A trava anterior travava o **valor** do token, nunca a **escolha** dele. A mutação
 * `QMA2d` do QA provou o buraco: migrar um call site de `bg-error-fg` para `bg-error`
 * — isto é, mover uma superfície para o token que continuava reprovando — não deixava
 * **nenhum** teste vermelho, porque a coluna "onde" era prosa mantida à mão.
 * Agora `CALL_SITES_DE_ERRO` é o **esperado literal**, e o teste **deriva o real**
 * varrendo `src/**` e o bundle do DS com `REGEX_CALL_SITE_DE_ERRO`; a asserção é de
 * **identidade** (`arquivo::classe`), nunca de cardinalidade.
 */

import { contrastRatio } from './colorContrast'

/** Par de cor auditável: primeiro plano (`fg`) sobre fundo (`bg`), pelos tokens. */
export type ParDeContrasteDeAlerta = {
  /** Rótulo humano — aparece na mensagem de falha do teste. */
  label: string
  fgToken: string
  bgToken: string
  /** Hex espelhado do CSS. O teste confere a igualdade com o arquivo real. */
  fg: string
  bg: string
  /** Onde este par aparece de fato na app — a justificativa da entrada. */
  onde: string
}

/**
 * Todas as superfícies em que a família `error` é pintada hoje.
 *
 * As entradas de `--color-error-fg` vêm da 123/FE-A2 (achado `A-2`); as de
 * `--color-error` vêm da 123/FE-FIX3 (achado `F-1`) e cobrem os componentes
 * compilados do design system, que usam `text-error`/`bg-error`/`border-error`.
 *
 * Os usos como BORDA (`border-error-fg` em `Combobox`, `MultiSelectCombobox`,
 * `CancelTimeEntryDialog` e `border-error-fg/30` no `Toast`; `border-error` no
 * `Input`/`Select` do DS) não entram como par de texto: a régua deles é a WCAG 1.4.11
 * (3:1, não-textual), e escurecer o token só aumenta esse contraste — nunca o reduz.
 * O teste ainda os mede, derivados da fonte, contra o piso de 3:1.
 */
export const ALERTA_CONTRAST_PAIRS: ParDeContrasteDeAlerta[] = [
  {
    label: 'erro inline / ação destrutiva — error-fg sobre o card',
    fgToken: '--color-error-fg',
    bgToken: '--color-card',
    fg: '#c00000',
    bg: '#ffffff',
    onde:
      'EditCategoryModal, Combobox, MultiSelectCombobox, PeriodFilter, TimeEntryModal (×5), ' +
      'CancelTimeEntryDialog (×2), TimeEntryCard, service-categories/columns, ' +
      'plan-consumption/columns, KpiCard (subtextVariant negative), LogsTable (mensagem)',
  },
  {
    label: 'badge/toast de erro — error-fg sobre error-bg',
    fgToken: '--color-error-fg',
    bgToken: '--color-error-bg',
    fg: '#c00000',
    bg: '#ffe0e0',
    onde: 'Badge.tsx ("Cancelado"), Toast.tsx (tipo error), LogsTable.tsx (status "Erro")',
  },
  {
    label: 'error-fg sobre o fundo geral da página',
    fgToken: '--color-error-fg',
    bgToken: '--color-background',
    fg: '#c00000',
    bg: '#f0f4f7',
    onde: 'ManutencaoRegistros (botão "Desativar") e qualquer texto de erro fora de card',
  },
  {
    label: 'botão de descarte — branco sobre error-fg como FUNDO sólido',
    fgToken: '--color-white',
    bgToken: '--color-error-fg',
    fg: '#ffffff',
    bg: '#c00000',
    onde: 'CancelTimeEntryDialog ("Confirmar descarte"/"Confirmar cancelamento"), bg-error-fg',
  },
  {
    label: 'validação inline do design system — error sobre o card',
    fgToken: '--color-error',
    bgToken: '--color-card',
    fg: '#c00000',
    bg: '#ffffff',
    onde:
      'Input/Select do DS: mensagem de validação (dist/index.js:107 e :290) e asterisco de ' +
      'campo obrigatório (:81 e :211) — a superfície LITERAL do achado A-2, medida no ' +
      'browser em /categorias (123/FE-FIX3)',
  },
  {
    label: 'badge/alerta do design system — error sobre alert-error',
    fgToken: '--color-error',
    bgToken: '--color-alert-error',
    fg: '#c00000',
    bg: '#ffe0e0',
    onde:
      'Badge soft tone="error" (dist/index.js:438) e o acento do Alert tone="error" ' +
      '(:472) — o par mais apertado da família (era 3,24:1)',
  },
  {
    label: 'error sobre o fundo geral da página',
    fgToken: '--color-error',
    bgToken: '--color-background',
    fg: '#c00000',
    bg: '#f0f4f7',
    onde: 'qualquer text-error do DS renderizado fora de card (ErrorState em página cheia)',
  },
  {
    label: 'botão destrutivo — branco sobre error como FUNDO sólido',
    fgToken: '--color-white',
    bgToken: '--color-error',
    fg: '#ffffff',
    bg: '#c00000',
    onde:
      'Button.tsx:42 variant="danger" (bg-error text-white) e Badge solid tone="error" ' +
      'do DS (dist/index.js:446)',
  },
]

/* ────────────────────────────────────────────────────────────────────────────────────
 * Inventário DERIVADO de call sites (123/FE-FIX3, fecha `F-5` / mutação `QMA2d`)
 * ──────────────────────────────────────────────────────────────────────────────────── */

/**
 * Papel de contraste de um call site, **derivado do prefixo do utilitário** — nunca
 * anotado à mão call site a call site (seria a segunda fonte de verdade que a
 * `rules/security.md` proíbe).
 *
 * A derivação por prefixo **super-aproxima de propósito**: um ícone pintado com
 * `text-error` é julgado pelo piso de TEXTO (4,5:1) e não pelo de gráfico não-textual
 * (3:1). Erra para o lado seguro — reprovar um ícone é barato, aprovar um texto
 * ilegível não é.
 */
export type PapelDeCallSite = 'texto' | 'fundo-solido' | 'superficie' | 'borda'

/**
 * Tokens da família de erro que a varredura reconhece, pelo sufixo da classe.
 * `error-bg` e `alert-error` são SUPERFÍCIES (fundos claros); os outros dois são
 * tinta (texto/borda) ou fundo sólido.
 */
export const TOKENS_DE_SUPERFICIE_DE_ERRO = ['error-bg', 'alert-error'] as const

/**
 * Fonte da regex que deriva os call sites. Exportada como **string** de propósito:
 * uma `RegExp` global carrega `lastIndex` entre usos e produziria varredura
 * intermitente. O teste constrói uma instância nova a cada varredura.
 *
 * Precisão (nunca frouxidão — `AP-QA-008`): o `(?![-\w])` final impede que
 * `bg-error-bg` case como `bg-error`, e que um `text-errors` inventado case como
 * `text-error`. O teste tem controle positivo E negativo para cada uma dessas formas.
 */
export const REGEX_CALL_SITE_DE_ERRO =
  '\\b(text|bg|border|ring|fill|stroke|outline|decoration|accent|caret|divide|placeholder|shadow)-(error|error-fg|error-bg|alert-error)(?![-\\w])'

/**
 * Prefixo do utilitário → papel de contraste. Conjunto fechado: prefixo novo lança.
 *
 * ⚠️ 123/FE-FIX4 (achado `F-7`) — **este mapa DECIDE O PISO WCAG** de todos os call
 * sites derivados: `texto` mede contra 4,5:1, `borda` contra 3:1. Ele era privado e não
 * tinha um único teste próprio, então a expectativa do invariante derivado saía da
 * mesma função que ele mede — a tautologia de `AP-QA-029`, uma camada acima. A mutação
 * do QA (`text: 'texto'` → `'borda'`) derrubava o piso de 27 pares `arquivo::classe`
 * de 4,5:1 para 3:1 com **0 testes vermelhos**.
 *
 * Por isso ele é **exportado**: `alertTokenContrast.test.ts` trava a identidade do mapa
 * e o papel de cada prefixo com literais escritos à mão, e prova o piso em EFEITO com
 * um call site fabricado. Trocar o papel de um prefixo reprova nas duas camadas.
 */
export const PAPEL_POR_PREFIXO: Record<string, Exclude<PapelDeCallSite, 'superficie'>> = {
  text: 'texto',
  bg: 'fundo-solido',
  border: 'borda',
  ring: 'borda',
  outline: 'borda',
  divide: 'borda',
  decoration: 'borda',
  accent: 'fundo-solido',
  caret: 'borda',
  placeholder: 'texto',
  fill: 'texto',
  stroke: 'borda',
  shadow: 'borda',
}

/** Classe utilitária (ex.: `bg-alert-error`) → variável CSS (ex.: `--color-alert-error`). */
export function tokenDaClasse(classe: string): string {
  const sufixo = classe.slice(classe.indexOf('-') + 1)
  return `--color-${sufixo}`
}

/** Classe utilitária → papel de contraste, derivado do prefixo (e do tipo do token). */
export function papelDaClasse(classe: string): PapelDeCallSite {
  const prefixo = classe.slice(0, classe.indexOf('-'))
  const sufixo = classe.slice(prefixo.length + 1)
  const papel = PAPEL_POR_PREFIXO[prefixo]
  if (papel === undefined) {
    throw new Error(
      `Prefixo de utilitário desconhecido em "${classe}". Acrescente-o a PAPEL_POR_PREFIXO ` +
        'com o piso WCAG correspondente — nunca deixe um call site sem papel.',
    )
  }
  const ehSuperficie = (TOKENS_DE_SUPERFICIE_DE_ERRO as readonly string[]).includes(sufixo)
  if (papel === 'fundo-solido' && ehSuperficie) return 'superficie'
  return papel
}

/** Superfície clara sobre a qual a app pinta texto de erro. */
export type SuperficieClara = {
  token: string
  /** Hex espelhado do CSS — o teste confere contra o arquivo real. */
  hex: string
  onde: string
}

/**
 * As superfícies claras da app. Todo call site de TEXTO da família de erro é medido
 * contra **todas** elas — super-aproximação deliberada: não há mapa call site →
 * superfície que se mantenha honesto sem virar enumeração à mão.
 */
export const SUPERFICIES_CLARAS: SuperficieClara[] = [
  { token: '--color-card', hex: '#ffffff', onde: 'fundo de card, modal e tabela' },
  { token: '--color-background', hex: '#f0f4f7', onde: 'fundo geral da página' },
  { token: '--color-error-bg', hex: '#ffe0e0', onde: 'badge/toast de erro do app' },
  { token: '--color-alert-error', hex: '#ffe0e0', onde: 'badge/alerta de erro do DS' },
]

/* ────────────────────────────────────────────────────────────────────────────────────
 * O PISO WCAG de cada papel (123/FE-FIX4, fecha `F-7`)
 * ──────────────────────────────────────────────────────────────────────────────────── */

/** WCAG 1.4.3 — texto normal sobre o fundo. É o piso dos achados `A-2` e `F-1`. */
export const PISO_WCAG_TEXTO = 4.5

/** WCAG 1.4.11 — componentes de interface e objetos gráficos (bordas, ícones). */
export const PISO_WCAG_NAO_TEXTUAL = 3

/**
 * Papel → piso WCAG. Separado de `papelDaClasse` de propósito: é ESTE número que o
 * invariante derivado usa como expectativa, e expectativa produzida pela coisa medida
 * precisa de teste próprio (`F-7`).
 *
 * `fundo-solido` usa o piso de TEXTO porque a medição dele é "branco **sobre** o
 * token" — o que está sendo julgado ali é texto, não o fundo.
 */
export function pisoDoPapel(papel: PapelDeCallSite): number {
  switch (papel) {
    case 'texto':
      return PISO_WCAG_TEXTO
    case 'fundo-solido':
      return PISO_WCAG_TEXTO
    case 'borda':
      return PISO_WCAG_NAO_TEXTUAL
    case 'superficie':
      throw new Error(
        'Superfície não tem piso próprio: ela é o FUNDO das medições, e é auditada por ' +
          'estar em SUPERFICIES_CLARAS. Peça o piso do papel de quem pinta sobre ela.',
      )
  }
}

/** O mínimo que `reprovacoesDaClasse` precisa saber de uma superfície. */
export type SuperficieMedida = { token: string; hex: string }

/**
 * Todas as reprovações WCAG de um call site, contra o piso do PAPEL dele.
 * Devolve lista vazia quando passa — e a lista é a mensagem de falha do teste.
 *
 * Vive na produção (e não dentro do teste) para poder ser exercitada com um call site
 * **fabricado**: `reprovacoesDaClasse('text-error', '#ff0000', …)` tem de reprovar
 * (4,00:1 < 4,5:1). É esse o controle positivo que faltava no `F-7` — sem ele,
 * "nenhum call site reprovado" era indistinguível de "piso desligado".
 */
export function reprovacoesDaClasse(
  classe: string,
  hex: string,
  superficies: readonly SuperficieMedida[],
): string[] {
  const papel = papelDaClasse(classe)

  if (papel === 'superficie') {
    const token = tokenDaClasse(classe)
    return superficies.some((s) => s.token === token)
      ? []
      : [`"${classe}" pinta um fundo (${token}) que não está em SUPERFICIES_CLARAS`]
  }

  const piso = pisoDoPapel(papel)

  if (papel === 'fundo-solido') {
    const razao = contrastRatio('#ffffff', hex)
    return razao < piso
      ? [`${classe} (branco sobre ${hex}) = ${razao.toFixed(2)} < ${piso}`]
      : []
  }

  const reprovadas: string[] = []
  for (const superficie of superficies) {
    const razao = contrastRatio(hex, superficie.hex)
    if (razao < piso) {
      reprovadas.push(
        `${classe} (${hex}) sobre ${superficie.token} (${superficie.hex}) = ` +
          `${razao.toFixed(2)} < ${piso}`,
      )
    }
  }
  return reprovadas
}

/** Um arquivo de produção que pinta com a família de tokens de erro. */
export type CallSiteDeErro = {
  /** Caminho POSIX a partir da raiz do repositório. */
  arquivo: string
  /** Classes da família de erro que este arquivo usa — ordenadas e sem repetição. */
  classes: string[]
  /** Por que este arquivo pinta com o token de erro. */
  porque: string
}

/**
 * O que a varredura DEVE encontrar. É o lado **literal** da asserção de identidade —
 * o outro lado é derivado da fonte em runtime pelo teste.
 *
 * Acrescentar um `text-error*` novo em qualquer arquivo de produção **reprova** até
 * que a entrada apareça aqui, com o `porque` escrito. Migrar um call site de um token
 * da família para outro (a mutação `QMA2d`) também reprova: a classe muda, e a
 * identidade é por `arquivo::classe`.
 */
export const CALL_SITES_DE_ERRO: CallSiteDeErro[] = [
  {
    arquivo: 'node_modules/@migrate/design-system/dist/index.js',
    classes: ['bg-alert-error', 'bg-error', 'border-error', 'text-error'],
    porque:
      'componentes COMPILADOS do design system: mensagem de validação inline e asterisco ' +
      'de obrigatório (Input/Select), borda do campo inválido, Badge soft/solid tone="error", ' +
      'acento do Alert e ícone do ErrorState. É o raio do achado F-1.',
  },
  {
    arquivo: 'src/components/ui/Badge.tsx',
    classes: ['bg-error-bg', 'text-error-fg'],
    porque: 'badge "Cancelado" do app (BADGE_MAP) — texto de erro sobre o fundo de erro.',
  },
  {
    arquivo: 'src/components/ui/Button.tsx',
    classes: ['bg-error'],
    porque:
      'variante `danger` (ConfirmDialog, exclusões): fundo sólido do token funcional do DS ' +
      'com texto branco. Único call site de `--color-error` fora do bundle do DS.',
  },
  {
    arquivo: 'src/components/ui/Combobox.tsx',
    classes: ['border-error-fg', 'text-error-fg'],
    porque: 'asterisco de obrigatório, borda do campo inválido e mensagem de erro do combobox.',
  },
  {
    arquivo: 'src/components/ui/MultiSelectCombobox.tsx',
    classes: ['border-error-fg', 'text-error-fg'],
    porque: 'borda do campo inválido e mensagem de erro do combobox múltiplo.',
  },
  {
    arquivo: 'src/components/ui/Toast.tsx',
    classes: ['bg-error-bg', 'border-error-fg', 'text-error-fg'],
    porque: 'toast do tipo `error`: texto e borda de erro sobre o fundo de erro.',
  },
  {
    arquivo: 'src/features/dashboards/shared/components/KpiCard.tsx',
    classes: ['text-error-fg'],
    porque: 'subtexto do KPI quando a variação é negativa (`subtextVariant="negative"`).',
  },
  {
    arquivo: 'src/features/reports/plan-consumption/columns.ts',
    classes: ['text-error-fg'],
    porque: 'coluna de consumo em faixa crítica (>= 95%) do relatório Consumo de Planos.',
  },
  {
    arquivo: 'src/features/reports/shared/components/PeriodFilter.tsx',
    classes: ['text-error-fg'],
    porque: 'mensagem de erro do filtro de período.',
  },
  {
    arquivo: 'src/features/service-categories/columns.tsx',
    classes: ['text-error-fg'],
    porque: 'ação "excluir" da tabela de categorias (ação destrutiva em texto).',
  },
  {
    arquivo: 'src/features/service-categories/components/EditCategoryModal.tsx',
    classes: ['text-error-fg'],
    porque:
      'erro de API do modal de renomear. A mensagem de VALIDAÇÃO do mesmo modal não está ' +
      'aqui: ela vem do `Input` do DS (`text-error`) — foi exatamente essa distinção que ' +
      'produziu o achado F-1.',
  },
  {
    arquivo: 'src/features/sincronizador/components/LogsTable.tsx',
    classes: ['bg-error-bg', 'text-error-fg'],
    porque: 'badge de status "Erro" e a mensagem de erro truncada da linha de log.',
  },
  {
    arquivo: 'src/features/sincronizador/components/ManutencaoRegistros.tsx',
    classes: ['text-error-fg'],
    porque: 'botão "Desativar" (ação destrutiva em texto) sobre o fundo geral da página.',
  },
  {
    arquivo: 'src/features/support-plans/components/SupportPlanFormModal.tsx',
    classes: ['text-error-fg'],
    porque:
      'erro de API do formulário de plano de suporte (124/F1) — inclui a mensagem do ' +
      '`422 PLAN_RENAME_UNSAFE`. Mesmo caso do irmão `EditCategoryModal`: a mensagem de ' +
      'VALIDAÇÃO dos campos vem do `Input` do DS (`text-error`) e por isso não está aqui. ' +
      'O aviso PREVENTIVO de rename inseguro, do mesmo arquivo, NÃO usa a família de erro: ' +
      'é `text-foreground` sobre `bg-warning-bg` (13.36:1), porque `text-warning-fg` sobre ' +
      'esse fundo mede 3.00:1 e reprova AA (AP-FRONTEND-018).',
  },
  {
    arquivo: 'src/features/business-calendar/components/CalendarFormModal.tsx',
    classes: ['text-error-fg'],
    porque:
      'erro de API do formulário de calendário comercial (124/F2) — inclui o ' +
      '`409 CALENDAR_LAST_DEFAULT`. A mensagem de VALIDAÇÃO dos campos vem do `Input` do ' +
      'DS (`text-error`) e por isso não está aqui.',
  },
  {
    arquivo: 'src/features/business-calendar/components/HolidayFormModal.tsx',
    classes: ['text-error-fg'],
    porque: 'erro de API do formulário de feriado (124/F3), sobre a superfície do modal.',
  },
  {
    arquivo: 'src/features/business-calendar/components/HolidayImportModal.tsx',
    classes: ['text-error-fg'],
    porque:
      'importação de feriados (124/F3): erro de arquivo, situação de cada linha inválida na ' +
      'tabela de pré-visualização e o relatório linha a linha do `422 IMPORT_INVALID_ROWS`. ' +
      'O aviso de arquivo com DD/MM misturado NÃO usa a família de erro: é `text-foreground` ' +
      'sobre `bg-warning-bg` (13.36:1), porque `text-warning-fg` ali mede 3.00:1 e reprova AA ' +
      '(AP-FRONTEND-018).',
  },
  {
    arquivo: 'src/features/business-calendar/components/ScheduleSection.tsx',
    classes: ['text-error-fg'],
    porque:
      'grade de expediente (124/F2): resumo das janelas inválidas antes do envio (DD-5) e o ' +
      '`422 SCHEDULE_WINDOW_OVERLAP` traduzido por janela. O erro de CADA campo de hora vem ' +
      'do `Input` do DS (`text-error`), não daqui.',
  },
  {
    arquivo: 'src/features/ticket-detail/components/CancelTimeEntryDialog.tsx',
    classes: ['bg-error-fg', 'border-error-fg', 'text-error-fg'],
    porque:
      'erro do campo de motivo, erro de API e o botão "Confirmar descarte" (único fundo ' +
      'sólido de `--color-error-fg` no app). É o call site da mutação QMA2d do QA.',
  },
  {
    arquivo: 'src/features/ticket-detail/components/TimeEntryCard.tsx',
    classes: ['text-error-fg'],
    porque: 'ação "descartar apontamento" do card (ação destrutiva em texto).',
  },
  {
    arquivo: 'src/features/ticket-detail/components/TimeEntryModal.tsx',
    classes: ['text-error-fg'],
    porque: 'erros de validação e de API do modal de apontamento (7 ocorrências).',
  },
]

/**
 * Arquivos de produção deixados FORA da varredura — allowlist **nominal**, item por
 * item, com justificativa ao lado (`rules/security.md` § Invariante: exclusão nunca
 * é padrão de nome).
 *
 * Arquivos de teste não estão aqui porque não são exclusão de conteúdo: o universo da
 * varredura é o **código de produção**, e "arquivo de teste" é definido pelo próprio
 * runner (`**\/*.{test,spec}.?(c|m)[jt]s?(x)`, o `include` default do Vitest 4, já que
 * `vitest.config.ts` não o sobrescreve). Um arquivo de produção não pode adquirir esse
 * nome sem deixar de ser carregado pela app.
 */
export const EXCLUSOES_NOMINAIS_DA_VARREDURA = [
  {
    arquivo: 'src/utils/alertTokenContrast.ts',
    porque:
      'é ESTE inventário. As classes aparecem na prosa que as documenta e na lista ' +
      'esperada acima, nunca em JSX — incluí-lo faria o inventário exigir uma entrada ' +
      'para si mesmo a cada linha de documentação.',
  },
]
