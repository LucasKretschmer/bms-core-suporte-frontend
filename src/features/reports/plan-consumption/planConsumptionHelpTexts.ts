/**
 * 127/FE-AJUDA — textos do **botão de ajuda `(?)`** da tela de Consumo de Planos.
 *
 * ## Por que este módulo continua existindo depois da 132
 *
 * Até a 132 este arquivo derivava um **indicador de conferência** (quatro estados,
 * glifo e nome acessível próprios) porque o `(?)` recolhia, além da nota de
 * competência, o **card de exceções de faturamento**. A 132/D7 removeu as exceções:
 * com `TimeEntry.InicioEm` como competência (D1), a hora é faturada no mês em que foi
 * **apontada** — chamado aberto ou fechado —, logo não existe mais "chamado fora de
 * qualquer fatura" para conferir. Sem o card, não há o que indicar: o indicador, o
 * selo e a região `role="status"` saíram junto com ele.
 *
 * O módulo sobrevive por um motivo só, e é o que o mantém necessário: **o nome
 * acessível do gatilho é uma afirmação sobre o comportamento do sistema, logo é
 * código, não copy** (`AP-FRONTEND-022`). Literal inline no JSX é o que faz um texto
 * assim envelhecer sem que ninguém perceba — foi exatamente o que aconteceu com o
 * rótulo antigo (abaixo).
 *
 * ## 🔴 O rótulo mudou de AFIRMAÇÃO, de propósito
 *
 * O rótulo visível era `'Ajuda e conferência'` e o nome acessível terminava em
 * *"…exigem conferência"*. Mantê-los prometeria ao usuário uma **conferência que
 * deixou de existir** na tela — no mês em que a regra de competência mudou, que é
 * justamente quando ele vai ler o `(?)` para entender o número. O texto novo afirma
 * apenas o que o `(?)` ainda faz: explicar **como o período é contado**.
 *
 * O nome acessível **contém** o rótulo visível (WCAG 2.5.3 — Label in Name): quem usa
 * comando de voz fala "Ajuda" e o alvo casa.
 */

/** Rótulo visível do gatilho. O nome acessível sempre o CONTÉM (WCAG 2.5.3). */
export const TEXTO_AJUDA_ROTULO = 'Ajuda'

/**
 * Nome acessível do gatilho — o que o leitor de tela lê **sem o usuário abrir**.
 *
 * Não afirma prazo, limite nem contagem: descreve o conteúdo que o disclosure revela.
 * Nada aqui é derivado de requisição, então não há estado de carga nem de falha para
 * distinguir (era o que o indicador da 127 fazia, e o que a 132/D7 tornou sem sujeito).
 */
export const TEXTO_AJUDA_NOME_ACESSIVEL = `${TEXTO_AJUDA_ROTULO}: como o período é contado nesta tela`
