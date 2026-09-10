/**
 * 134 · U9 — veredito "SEM duração" do drill da família PROJETO.
 *
 * A análise §1.2 concluiu que este drill **não tem** coluna de duração (nenhuma hora,
 * nenhum segundo: as duas colunas de tempo são `iniciadoEm`/`concluidoEm`, que são
 * **instantes**, formatados por `formatDate` — PRD §2.4 distingue duração de instante).
 * Este arquivo **trava** o veredito para que ele não regrida em silêncio.
 *
 * 🔴 Por que o arquivo é separado de `drillColumns.test.ts`: aquele arquivo é da unidade
 * U5 (S7/S8/S9 — as três famílias de drill QUE TÊM duração) nesta mesma demanda. U9 não
 * edita arquivo de outra unidade.
 *
 * 🔴 `expect(...).toEqual([])` é asserção negativa, e asserção negativa é satisfeita pelo
 * vazio (`rules/tests.md` § padrão 1): ela passaria se `projetoDrillColumns()` devolvesse
 * `[]`, se o import quebrasse a lista, ou se o detector estivesse morto. Por isso cada
 * negativa aqui vem acompanhada de DUAS positivas na mesma execução:
 *   (P1) a identidade literal do conjunto completo de colunas — escrita à mão, não
 *        derivada da resposta — que prova que a superfície real foi carregada;
 *   (P2) o mesmo detector aplicado à MESMA lista real com uma coluna marcada, que prova
 *        que ele **discrimina** (devolve não-vazio quando há duração).
 */

import { describe, expect, it } from 'vitest'
import { projetoDrillColumns } from './projetoDrillColumns'
import type { ColumnDef } from '../../../../components/ui/DataTable/types'
import { chavesDeDuracao } from '../../../../test/duracaoExport'
import { buildDrillExportColumns } from '../components/MetricDrillModal'
import type { ProjectRowDto } from '../types/metrics'

/**
 * O discriminador de duração do drill é a **presença** do campo `durationSeconds` no
 * `ColumnDef` (análise §7.3) — não uma lista de chaves mantida à mão. Ler o campo por
 * `unknown` mantém este teste válido antes e depois de U5 acrescentar o campo ao tipo.
 */
function temDuracao(coluna: ColumnDef<ProjectRowDto>): boolean {
  const campo = (coluna as { durationSeconds?: unknown }).durationSeconds
  return typeof campo === 'function'
}

/**
 * A projeção `ColumnDef → ExportColumn` é **importada** de `MetricDrillModal`, não copiada:
 * é a mesma função que a produção executa ao exportar (análise §7.3), e é por ela que o
 * veredito do drill vira (ou não vira) uma coluna `type: 'duration'` no arquivo baixado.
 *
 * 🔴 Aqui havia uma **cópia** com a docstring "A MESMA projeção que o MetricDrillModal
 * aplica" — segunda fonte de verdade, que nasce verde e diverge em silêncio no dia em que
 * a produção mudar. Trocada pelo import em 08/09/2026 (achado da unidade U5). Se um dia a
 * função deixar de ser exportável, **exportá-la sai mais barato que manter a cópia**.
 */

/** Identidade literal do conjunto de colunas — escrita à mão, na ordem em que sai no arquivo. */
const CHAVES_ESPERADAS = [
  'nome',
  'clienteNome',
  'tipo',
  'stage',
  'ownerNome',
  'equipe',
  'iniciadoEm',
  'concluidoEm',
]

describe('projetoDrillColumns — veredito "sem duração" (134 §1.2)', () => {
  it('P1 · a superfície REAL foi carregada: identidade literal das 8 colunas', () => {
    // Vermelho se: uma coluna nascer, sumir ou mudar de chave — inclusive uma coluna de
    // tempo. É esta positiva que impede as negativas abaixo de passarem pelo vazio.
    expect(projetoDrillColumns().map((c) => c.key)).toEqual(CHAVES_ESPERADAS)
  })

  it('P2 · o detector DISCRIMINA: marcar uma coluna real devolve exatamente aquela chave', () => {
    // Controle positivo sobre a lista real. Vermelho se `temDuracao` passar a devolver
    // sempre `false` (o modo de falha que tornaria o `toEqual([])` abaixo inerte).
    const comUmaMarcada = projetoDrillColumns().map((c) =>
      c.key === 'iniciadoEm'
        ? { ...c, durationSeconds: () => 9840 }
        : c,
    )

    expect(comUmaMarcada.filter(temDuracao).map((c) => c.key)).toEqual(['iniciadoEm'])
    expect(chavesDeDuracao(buildDrillExportColumns(comUmaMarcada))).toEqual(['iniciadoEm'])
  })

  it('VEREDITO · nenhuma coluna do drill de projeto é de duração', () => {
    // Vermelho se alguém acrescentar `durationSeconds` a qualquer coluna daqui sem passar
    // pelo inventário da demanda (R8 da análise: a decisão passa a ser explícita).
    expect(projetoDrillColumns().filter(temDuracao).map((c) => c.key)).toEqual([])
  })

  it('VEREDITO · o export do drill de projeto não leva nenhuma coluna `type: "duration"`', () => {
    // O sujeito da frase é a coluna do ARQUIVO, então a asserção é sobre a projeção que o
    // MetricDrillModal entrega ao `exportToCsv`/`exportToXlsx` — não sobre o `ColumnDef` cru.
    const colunasDeExport = buildDrillExportColumns(projetoDrillColumns())

    // Positiva pareada, na mesma execução e com literal à mão: a projeção preserva as 8
    // colunas. Sem ela, `chavesDeDuracao([])` também devolveria `[]`.
    expect(colunasDeExport.map((c) => c.key)).toEqual(CHAVES_ESPERADAS)
    expect(chavesDeDuracao(colunasDeExport)).toEqual([])
  })

  it('as duas colunas de tempo são INSTANTES, não durações (PRD §2.4)', () => {
    // Prova o porquê do veredito, não só o veredito: `iniciadoEm`/`concluidoEm` rendem uma
    // data formatada, nunca "2h 44m". Vermelho se alguém trocar o accessor por uma duração.
    const linha = {
      nome: 'Implantação X',
      clienteNome: 'Cliente Y',
      tipo: 'Onboarding',
      stage: 'Em execução',
      ownerNome: 'Fulano',
      equipe: 'Suporte',
      iniciadoEm: '2026-03-04T10:00:00Z',
      concluidoEm: null,
    } as unknown as ProjectRowDto

    const colunas = projetoDrillColumns()
    const iniciado = colunas.find((c) => c.key === 'iniciadoEm')!
    const concluido = colunas.find((c) => c.key === 'concluidoEm')!

    expect(iniciado.accessor(linha)).toBe('04/03/2026')
    expect(concluido.accessor(linha)).toBe('—')
  })
})
