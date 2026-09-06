import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { Modal } from '../../../components/ui/Modal'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useHolidayImpacts } from '../hooks/useBusinessCalendar'
import type { ImportHolidaysResultDto } from '../types/calendar'
import { MAX_ITENS_IMPORTACAO } from '../types/calendar'
import {
  errosDeImportacao,
  getCalendarErrorCode,
  getCalendarErrorMessage,
  CALENDAR_ERROR_CODES,
  type ErroDeItemImportado,
} from '../utils/calendarErrorMessage'
import {
  EXTENSOES_ACEITAS,
  interpretacaoPorExtenso,
  lerArquivoDeFeriados,
  resolverLinhas,
  type ArquivoLido,
  type LinhaResolvida,
  type OrdemDeData,
} from '../utils/holidayImportParser'
import {
  datasParaConsultarNoLote,
  datasRetroativas,
  estadoDoImpacto,
  impactoBloqueiaConfirmacao,
  listaDeDatasResumida,
  textoConfirmacaoRetroativaEmLote,
  tituloConfirmacaoRetroativaEmLote,
} from '../utils/retroactiveWarning'

type HolidayImportModalProps = {
  /** Calendário de destino — usado na rota de pré-contagem de impacto (DD-2). */
  calendarId: number
  isOpen: boolean
  onClose: () => void
  /**
   * Executa a importação. `dryRun: true` **não grava** — é a pré-visualização
   * obrigatória. Rejeita em caso de falha (use `mutateAsync`): é a rejeição que traz o
   * `422 IMPORT_INVALID_ROWS` com os `details[]` linha a linha.
   */
  onImportar: (
    itens: { data: string; nome: string }[],
    dryRun: boolean,
  ) => Promise<ImportHolidaysResultDto>
  /** Chamado depois de uma importação REAL bem-sucedida. */
  onImportado: (resultado: ImportHolidaysResultDto) => void
}

/**
 * 124/F3 — importação de feriados por CSV/XLSX, **parseada no navegador** (A-8).
 *
 * ## O fluxo, e por que ele tem três passos e não um
 *
 * 1. **Escolher arquivo** → o parser roda aqui (`utils/holidayImportParser.ts`). Erro de
 *    arquivo (coluna faltando, > 500 linhas, formato) aparece **antes** de qualquer
 *    request.
 * 2. **Simular** (`dryRun=true`) → o servidor devolve `criados/atualizados/inalterados`
 *    **sem gravar**. É obrigatório: o botão de confirmar só liga depois de uma simulação
 *    bem-sucedida, e **qualquer** mudança (arquivo novo, troca da ordem de data) desliga
 *    de novo.
 * 3. **Confirmar** → grava.
 *
 * `AUTO-124-9` decidiu **recusa total**: uma linha inválida derruba o lote inteiro. Sem
 * a pré-visualização, essa recusa seria hostil — o usuário só descobriria o problema
 * depois de tentar. É a pré-visualização que paga o custo de ergonomia da recusa.
 *
 * ## O `422` chega **linha a linha**, e é assim que ele é exibido
 *
 * `details[]` vem como `{ field: "itens[3].data", message: "…" }`. O índice é o do array
 * enviado, não o número da linha do arquivo — a tradução acontece aqui, porque só a tela
 * sabe de que linha cada item veio. Um toast dizendo "importação inválida" jogaria fora
 * exatamente a informação necessária para corrigir a planilha.
 *
 * ## Ambiguidade `03/04`
 *
 * Um seletor `DD/MM` × `MM/DD` **acima** da tabela, aplicado ao arquivo inteiro, com a
 * interpretação renderizada **por extenso** em cada linha. Sem escolha, a importação
 * fica desabilitada (§4 ponto 6) — e a escolha **não é pré-selecionada por inferência**
 * quando o arquivo tem data ambígua (QA `D-7`): ordem adivinhada é dado errado gravado
 * em silêncio.
 *
 * ## 🔴 DD-2 no LOTE — o caminho que grava mais é o que precisa avisar mais
 *
 * Este modal grava até {@link MAX_ITENS_IMPORTACAO} datas de uma vez. Ele ficou **sem
 * nenhuma** confirmação de retroatividade enquanto o cadastro de **um** feriado já
 * bloqueava com a contagem na frente do usuário (QA `D-1`) — guarda paga no caminho
 * pequeno e ignorada no grande é guarda não paga.
 *
 * Agora "Confirmar importação" **não grava**: abre um `alertdialog` que nomeia as datas
 * passadas, traz a **soma dos chamados já fechados** vinda da rota de pré-contagem
 * (`GET .../holidays/impacto?data=`) e fica **travado enquanto a consulta não volta** —
 * "ainda não sei" e "nenhum" são respostas diferentes. As peças são as mesmas do caminho
 * de um feriado (`utils/retroactiveWarning.ts`), o que impede as duas telas de divergirem.
 *
 * O teto de consultas e o porquê da apresentação agregada estão em
 * {@link MAX_DATAS_CONSULTADAS_NO_LOTE}.
 */
export function HolidayImportModal({
  calendarId,
  isOpen,
  onClose,
  onImportar,
  onImportado,
}: HolidayImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)
  const [arquivo, setArquivo] = useState<ArquivoLido | null>(null)
  const [erroDeArquivo, setErroDeArquivo] = useState<string | null>(null)
  const [ordem, setOrdem] = useState<OrdemDeData | null>(null)
  const [simulacao, setSimulacao] = useState<ImportHolidaysResultDto | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [errosDoServidor, setErrosDoServidor] = useState<ErroDeItemImportado[]>([])
  const [outrosErros, setOutrosErros] = useState<string[]>([])
  const [confirmandoRetroativo, setConfirmandoRetroativo] = useState(false)

  const resolucao = useMemo(
    () => (arquivo === null ? null : resolverLinhas(arquivo.linhas, ordem)),
    [arquivo, ordem],
  )

  /**
   * As linhas que viram itens no wire, **na mesma ordem** de `resolucao.validas` — as
   * duas listas saem do mesmo `filter` sobre o mesmo array, então o índice `N` de
   * `details[itens[N]]` casa com `linhasValidas[N]` por construção, não por combinação.
   */
  const linhasValidas: LinhaResolvida[] = useMemo(
    () => (resolucao === null ? [] : resolucao.linhas.filter((l) => l.erro === null && l.data !== null)),
    [resolucao],
  )

  const errosPorLinha = useMemo(() => {
    const mapa = new Map<number, string[]>()
    for (const erro of errosDoServidor) {
      const linha = linhasValidas[erro.indice]
      const chave = linha?.linhaNoArquivo ?? -1
      const atuais = mapa.get(chave) ?? []
      atuais.push(`${erro.campo}: ${erro.mensagem}`)
      mapa.set(chave, atuais)
    }
    return mapa
  }, [errosDoServidor, linhasValidas])

  /**
   * As datas do lote que estão no passado — **exatas e sem rede**: é a lista local, e ela
   * nunca é truncada. É este número que garante que o usuário vê o tamanho do efeito
   * mesmo quando o teto de consultas corta a contagem por data.
   */
  const retroativasDoLote = useMemo(
    () => (resolucao === null ? [] : datasRetroativas(resolucao.validas.map((v) => v.data))),
    [resolucao],
  )

  // Só consulta quando o diálogo está aberto — o mesmo desenho do caminho de um feriado:
  // olhar a pré-visualização e desistir não deve custar requisição nenhuma.
  const datasConsultadas = confirmandoRetroativo
    ? datasParaConsultarNoLote(retroativasDoLote)
    : []
  const estadoDoImpactoDoLote = estadoDoImpacto(useHolidayImpacts(calendarId, datasConsultadas))

  function limparResultado() {
    setSimulacao(null)
    setApiError(null)
    setErrosDoServidor([])
    setOutrosErros([])
  }

  function fechar() {
    setArquivo(null)
    setErroDeArquivo(null)
    setOrdem(null)
    setConfirmandoRetroativo(false)
    limparResultado()
    onClose()
  }

  async function escolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const selecionado = evento.target.files?.[0]
    // Permite reescolher o MESMO arquivo depois de corrigi-lo: sem isto o `change`
    // não dispara e o usuário acha que a tela travou.
    evento.target.value = ''
    if (selecionado === undefined) return

    limparResultado()
    setArquivo(null)
    setErroDeArquivo(null)
    setLendo(true)

    const resultado = await lerArquivoDeFeriados(selecionado)
    setLendo(false)

    if (!resultado.ok) {
      setErroDeArquivo(resultado.erro)
      return
    }

    setArquivo(resultado.arquivo)
    // 🔴 QA `D-7`: a ordem inferida NÃO é pré-selecionada. Havendo ambiguidade, a spec
    // (§4 ponto 6) exige a escolha explícita, e pré-marcar o rádio pelo palpite do parser
    // fazia a importação nascer habilitada sem o usuário decidir nada. Sem ambiguidade, a
    // inferência continua acontecendo dentro de `resolverLinhas` — lá cada data com barra
    // tem uma leitura só, e não há o que escolher.
    setOrdem(null)
  }

  function trocarOrdem(nova: OrdemDeData) {
    setOrdem(nova)
    // Trocar a interpretação das datas invalida a simulação: os itens mudaram.
    limparResultado()
  }

  /**
   * 🔴 QA `N-4` — **`Escape` no `alertdialog` volta para o modal, não para fora dele.**
   *
   * `Modal` (`components/ui/Modal.tsx:149`) e `ConfirmDialog`
   * (`components/ui/ConfirmDialog.tsx:93`) registram, os dois, um `keydown` de `Escape` no
   * **`document`, em fase de bolha**. Com os dois abertos, uma tecla fecha os dois: o
   * usuário queria desistir da confirmação e perdia arquivo, pré-visualização e simulação
   * — tudo de novo do zero.
   *
   * Este listener é de **captura** no `document`: ele roda antes dos dois (fase diferente,
   * mesmo nó), fecha **só** a confirmação e chama `stopPropagation`, que impede a fase de
   * bolha inteira — nenhum dos dois handlers chega a ver a tecla.
   *
   * Por que aqui e não no `ConfirmDialog`: o componente é compartilhado
   * (`components/ui/`), está fora do escopo desta unidade e mudar o `Escape` dele afetaria
   * todos os consumidores. Quem conhece o aninhamento é quem o criou — este modal.
   */
  useEffect(() => {
    if (!confirmandoRetroativo) return

    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return
      evento.stopPropagation()
      setConfirmandoRetroativo(false)
    }

    document.addEventListener('keydown', aoTeclar, true)
    return () => document.removeEventListener('keydown', aoTeclar, true)
  }, [confirmandoRetroativo])

  /**
   * O clique em "Confirmar importação" **não grava** quando há data passada no lote: abre
   * a confirmação de DD-2. É aqui que o caminho em lote passa a pagar a mesma guarda do
   * caminho de um feriado (QA `D-1`).
   */
  function aoConfirmar() {
    if (retroativasDoLote.length > 0) {
      setConfirmandoRetroativo(true)
      return
    }
    void executar(false)
  }

  async function executar(dryRun: boolean) {
    if (resolucao === null) return
    setApiError(null)
    setErrosDoServidor([])
    setOutrosErros([])
    setEnviando(true)
    try {
      const resultado = await onImportar(resolucao.validas, dryRun)
      if (dryRun) {
        setSimulacao(resultado)
      } else {
        onImportado(resultado)
        fechar()
      }
    } catch (error) {
      setApiError(getCalendarErrorMessage(error))
      setSimulacao(null)
      if (getCalendarErrorCode(error) === CALENDAR_ERROR_CODES.IMPORT_INVALID_ROWS) {
        const { porItem, outros } = errosDeImportacao(error)
        setErrosDoServidor(porItem)
        setOutrosErros(outros.map((o) => `${o.field}: ${o.message}`))
      } else {
        setOutrosErros(errosDeImportacao(error).outros.map((o) => `${o.field}: ${o.message}`))
      }
    } finally {
      setEnviando(false)
    }
  }

  const temErroLocal = resolucao !== null && resolucao.totalDeErros > 0
  const semItens = resolucao !== null && resolucao.validas.length === 0
  // A escolha é exigida quando há AMBIGUIDADE (ou conflito de ordens), não sempre que
  // existe barra: num arquivo só com `25/12/2026` não há nada a decidir (QA `D-7`).
  const precisaEscolherOrdem =
    resolucao !== null && resolucao.exigeEscolhaDeOrdem && ordem === null
  const podeSimular =
    resolucao !== null && !temErroLocal && !semItens && !precisaEscolherOrdem && !enviando
  const podeConfirmar = simulacao !== null && simulacao.dryRun && !enviando

  return (
    <>
      <Modal isOpen={isOpen} onClose={fechar} size="xl" title="Importar feriados">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/70">
            A planilha é lida <strong>no seu navegador</strong> — o arquivo não é enviado ao
            servidor, só as datas já interpretadas. Colunas necessárias: <code>data</code> e{' '}
            <code>nome</code>. Máximo de {MAX_ITENS_IMPORTACAO} feriados por importação.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              id="importar-feriados-arquivo"
              accept={EXTENSOES_ACEITAS.join(',')}
              className="text-sm text-foreground file:mr-3 file:rounded-control file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:text-foreground hover:file:shadow-hover"
              aria-label="Escolher planilha de feriados"
              onChange={(evento) => void escolherArquivo(evento)}
            />
            {arquivo !== null && (
              <span className="text-sm text-foreground/70">
                {arquivo.nomeDoArquivo} — {arquivo.linhas.length} linha(s)
              </span>
            )}
          </div>

          {lendo && <Skeleton lines={3} />}

          {erroDeArquivo !== null && (
            <p className="text-sm text-error-fg" role="alert">
              {erroDeArquivo}
            </p>
          )}

          {resolucao !== null && resolucao.conflitoDeOrdem && (
            <p className="rounded-control border border-border bg-warning-bg px-3 py-2 text-sm text-foreground">
              O arquivo mistura datas em <strong>DD/MM</strong> e <strong>MM/DD</strong>.
              Padronize a coluna de data na planilha antes de importar — escolher uma ordem
              aqui deixaria parte das linhas errada em silêncio.
            </p>
          )}

          {resolucao !== null && resolucao.exigeEscolhaDeOrdem && (
            <fieldset className="rounded-control border border-border px-3 py-2">
              <legend className="px-1 text-sm font-semibold text-foreground">
                Como ler as datas com barra
              </legend>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                {(
                  [
                    { valor: 'dmy' as const, rotulo: 'DD/MM/AAAA (dia primeiro)' },
                    { valor: 'mdy' as const, rotulo: 'MM/DD/AAAA (mês primeiro)' },
                  ] satisfies { valor: OrdemDeData; rotulo: string }[]
                ).map((opcao) => (
                  <label key={opcao.valor} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="ordem-da-data"
                      value={opcao.valor}
                      checked={ordem === opcao.valor}
                      onChange={() => trocarOrdem(opcao.valor)}
                    />
                    {opcao.rotulo}
                  </label>
                ))}
              </div>
              {precisaEscolherOrdem && (
                <p className="pt-1 text-sm text-foreground">
                  Escolha uma das opções: as datas do arquivo podem ser lidas das duas
                  formas, e a interpretação por extenso de cada linha muda com a escolha.
                </p>
              )}
            </fieldset>
          )}

          {resolucao !== null && (
            <div className="max-h-96 overflow-auto rounded-card border border-border">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  Pré-visualização das linhas do arquivo de feriados
                </caption>
                <thead className="bg-background">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                      Linha
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                      Data no arquivo
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                      Interpretada como
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                      Nome
                    </th>
                    <th scope="col" className="px-3 py-2 font-semibold text-foreground">
                      Situação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resolucao.linhas.map((linha) => {
                    const doServidor = errosPorLinha.get(linha.linhaNoArquivo) ?? []
                    return (
                      <tr key={linha.linhaNoArquivo} className="border-t border-border">
                        <td className="px-3 py-2 text-foreground">{linha.linhaNoArquivo}</td>
                        <td className="px-3 py-2 text-foreground">{linha.dataBruta || '—'}</td>
                        <td className="px-3 py-2 text-foreground">
                          {interpretacaoPorExtenso(linha)}
                        </td>
                        <td className="px-3 py-2 text-foreground">{linha.nome || '—'}</td>
                        <td className="px-3 py-2">
                          {linha.erro !== null ? (
                            <span className="text-error-fg">{linha.erro}</span>
                          ) : doServidor.length > 0 ? (
                            <span className="text-error-fg">{doServidor.join(' · ')}</span>
                          ) : (
                            <span className="text-foreground/70">Pronta</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {temErroLocal && (
            <p className="text-sm text-error-fg" role="alert">
              {resolucao.totalDeErros} linha(s) precisam de correção. A importação é{' '}
              <strong>tudo ou nada</strong>: enquanto houver uma linha inválida, nada é
              gravado — um feriado que ficasse de fora viraria dia útil no cálculo do SLA,
              em silêncio.
            </p>
          )}

          {semItens && !temErroLocal && (
            <p className="text-sm text-foreground" role="status">
              Nenhuma linha aproveitável no arquivo.
            </p>
          )}

          {simulacao !== null && (
            <p
              className="rounded-control border border-border bg-info-bg px-3 py-2 text-sm text-foreground"
              role="status"
            >
              <strong>Simulação (nada foi gravado):</strong> {simulacao.total} linha(s) —{' '}
              {simulacao.criados} nova(s), {simulacao.atualizados} com nome diferente,{' '}
              {simulacao.inalterados} já cadastrada(s) igual. Confirme para gravar.
            </p>
          )}

          {retroativasDoLote.length > 0 && !temErroLocal && (
            <p
              className="rounded-control border border-border bg-warning-bg px-3 py-2 text-sm text-foreground"
              role="status"
            >
              <strong>
                {retroativasDoLote.length === 1
                  ? '1 data deste arquivo é anterior a hoje'
                  : `${retroativasDoLote.length} datas deste arquivo são anteriores a hoje`}
              </strong>{' '}
              ({listaDeDatasResumida(retroativasDoLote)}). Feriado não é versionado: indicadores
              já apurados desses dias mudam de valor. Ao confirmar, a contagem de chamados
              afetados aparece antes da gravação.
            </p>
          )}

          {apiError !== null && (
            <div role="alert" className="flex flex-col gap-1">
              <p className="text-sm text-error-fg">{apiError}</p>
              {outrosErros.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-error-fg">
                  {outrosErros.map((mensagem) => (
                    <li key={mensagem}>{mensagem}</li>
                  ))}
                </ul>
              )}
              {errosDoServidor.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-error-fg">
                  {errosDoServidor.map((erro) => (
                    <li key={`${erro.indice}-${erro.campo}`}>
                      Linha {linhasValidas[erro.indice]?.linhaNoArquivo ?? '?'} ({erro.campo}):{' '}
                      {erro.mensagem}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={fechar} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              disabled={!podeSimular}
              isLoading={enviando && simulacao === null}
              onClick={() => void executar(true)}
            >
              Simular importação
            </Button>
            <Button
              variant="primary"
              disabled={!podeConfirmar}
              onClick={aoConfirmar}
            >
              Confirmar importação
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmandoRetroativo}
        title={tituloConfirmacaoRetroativaEmLote(retroativasDoLote.length)}
        description={textoConfirmacaoRetroativaEmLote(
          resolucao?.validas.length ?? 0,
          retroativasDoLote,
          estadoDoImpactoDoLote,
        )}
        confirmLabel="Importar mesmo assim"
        variant="danger"
        // Travado enquanto a contagem não chega: decidir sem o número é burlar a própria
        // guarda. (Escape e clique no overlay continuam fechando — ninguém fica preso.)
        isLoading={enviando || impactoBloqueiaConfirmacao(estadoDoImpactoDoLote)}
        onClose={() => setConfirmandoRetroativo(false)}
        onConfirm={() => {
          setConfirmandoRetroativo(false)
          void executar(false)
        }}
      />
    </>
  )
}
