import type { ImportHolidayItem } from '../types/calendar'
import { MAX_ITENS_IMPORTACAO, MAX_NOME_FERIADO } from '../types/calendar'
import { dataPorExtenso, diaLocalSaoPaulo, faixaAceitaDeFeriado } from './localDay'

/**
 * 124/F3 — **o parser de CSV/XLSX que roda no NAVEGADOR** (A-8 / AUTO-124-5).
 *
 * ## Por que o arquivo não sobe para o servidor
 *
 * `arquitetura.md` §4 ponto 6, verificado: o backend **não tem nenhum `IFormFile`**, e
 * introduzir upload traria junto todo o normativo de `rules/security.md` § Upload (magic
 * bytes, rename com GUID, cap de corpo, bucket isolado) para ler ~15 datas descartáveis.
 * O frontend já tinha `exceljs` no bundle (usado no export de relatórios) — e é ele que
 * esta unidade reusa, sem dependência nova.
 *
 * O contrato real, então, é o **JSON** (`ImportHolidaysDto`), validado no backend como
 * qualquer outro POST. Um atacante com `curl` enfrenta exatamente a mesma validação: o
 * parser daqui é ergonomia, nunca a guarda.
 *
 * **Contrapartida honesta e mitigada:** arquivo grande trava a aba do usuário, não o
 * servidor. Por isso `MAX_TAMANHO_ARQUIVO_BYTES` e `MAX_ITENS_IMPORTACAO` são checados
 * **antes** de qualquer parse pesado.
 *
 * ## As duas fases, e por que são separadas
 *
 * 1. `lerArquivoDeFeriados(File)` — I/O: decide CSV × XLSX, extrai a matriz de células,
 *    acha as colunas. Só esta metade precisa de `File`/`exceljs`.
 * 2. `resolverLinhas(linhas, ordem, hoje)` — **pura**: decide, linha a linha, se a data
 *    é válida, ambígua ou recusada. É onde vivem todas as classes de linha inválida, e
 *    é testável sem nenhum arquivo.
 *
 * ## Ambiguidade `03/04` — resolvida pelo usuário, com o olho nela
 *
 * §4 ponto 6: *"o parser detecta ambiguidade (dia ≤ 12 **e** mês ≤ 12) e a
 * pré-visualização mostra um seletor `DD/MM` × `MM/DD` em cima da tabela, aplicado a
 * todas as linhas de uma vez, com a interpretação renderizada por extenso. Sem escolha,
 * o botão de importar fica desabilitado."* A escolha é **uma só para o arquivo inteiro**:
 * interpretar linha a linha produziria um arquivo com duas convenções e ninguém
 * perceberia.
 *
 * 🔴 **A escolha é EXIGIDA, nunca inferida, quando há ambiguidade** (QA `D-7`). A primeira
 * versão inferia a ordem de uma linha inequívoca do mesmo arquivo (`25/12/2026` decidindo
 * `03/04/2026`) e liberava a importação sem o usuário decidir nada — que é exatamente o
 * palpite que a spec proíbe. A inferência **continua valendo** para o arquivo em que
 * NENHUMA linha é ambígua: ali cada data tem uma leitura só, e "inferir" é apenas ler.
 *
 * ## Codificação — `Proclamação` que chega `Proclama<FFFD><FFFD>o` é dado errado (QA `D-5`)
 *
 * O CSV padrão do Excel pt-BR em Windows é **Windows-1252**, não UTF-8. Decodificar à força
 * como UTF-8 troca cada byte alto por `U+FFFD` e a linha **passava marcada como "Pronta"** —
 * gravar lixo é pior que recusar, porque o usuário confirma sem ver o problema. Agora:
 *
 * 1. o CSV é decodificado com `TextDecoder('utf-8', { fatal: true })`; byte inválido
 *    **recusa o arquivo inteiro**, antes de qualquer pré-visualização, dizendo como salvar;
 * 2. qualquer célula que ainda chegue com `U+FFFD` (planilha já corrompida na origem, XLSX
 *    com texto quebrado) torna **a linha inválida** — e, por `AUTO-124-9`, o lote inteiro é
 *    recusado com a razão dita linha a linha.
 *
 * Nenhum dos dois caminhos **converte** o arquivo: adivinhar a codificação é a mesma classe
 * de erro que adivinhar a ordem da data.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Limites da leitura no navegador
// ─────────────────────────────────────────────────────────────────────────────

/** 2 MB. Um arquivo de feriados tem dezenas de linhas; acima disso é engano ou ataque. */
export const MAX_TAMANHO_ARQUIVO_BYTES = 2 * 1024 * 1024

/** Extensões aceitas — o `accept` do input espelha esta lista. */
export const EXTENSOES_ACEITAS = ['.csv', '.txt', '.xlsx'] as const

/**
 * `U+FFFD REPLACEMENT CHARACTER` — o que um decodificador põe no lugar de um byte que não
 * soube ler. Ele **nunca** aparece em texto legítimo digitado pelo usuário; encontrá-lo é
 * prova de que a codificação do arquivo não é a que foi usada para lê-lo.
 */
export const CARACTERE_DE_SUBSTITUICAO = '�'

/** `true` quando o texto carrega marca de decodificação perdida (QA `D-5`). */
export function temTextoCorrompido(texto: string): boolean {
  return texto.includes(CARACTERE_DE_SUBSTITUICAO)
}

/**
 * Mensagem única da falha de codificação — a mesma no erro de arquivo e no erro de linha,
 * porque a ação do usuário é a mesma nos dois casos.
 */
export const COMO_CORRIGIR_CODIFICACAO =
  'Salve a planilha como "CSV UTF-8 (delimitado por vírgula)" ou envie o arquivo .xlsx.'

/** Cabeçalhos reconhecidos para a coluna de data (§4 ponto 6). */
export const CABECALHOS_DE_DATA = ['data', 'date', 'dia']

/** Cabeçalhos reconhecidos para a coluna de nome. */
export const CABECALHOS_DE_NOME = ['nome', 'name', 'descricao', 'feriado']

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

/** Uma linha do arquivo antes de qualquer interpretação de data. */
export type LinhaBruta = {
  /** Número da linha **no arquivo** (1-based, contando o cabeçalho) — é o que o
   * usuário procura na planilha para corrigir. */
  linhaNoArquivo: number
  dataBruta: string
  nomeBruto: string
}

export type ArquivoLido = {
  nomeDoArquivo: string
  /** Cabeçalhos encontrados, como estavam escritos — usados na mensagem de erro. */
  colunas: string[]
  linhas: LinhaBruta[]
}

export type ResultadoDaLeitura =
  | { ok: true; arquivo: ArquivoLido }
  | { ok: false; erro: string }

/** Ordem escolhida para datas com barra. */
export type OrdemDeData = 'dmy' | 'mdy'

export type LinhaResolvida = LinhaBruta & {
  /** `AAAA-MM-DD` quando a linha é válida; `null` caso contrário. */
  data: string | null
  nome: string
  /** Mensagem em português, acionável. `null` quando a linha está boa. */
  erro: string | null
  /** `true` quando a data só é decidível pela escolha `DD/MM` × `MM/DD`. */
  ambigua: boolean
}

export type ResolucaoDoArquivo = {
  linhas: LinhaResolvida[]
  /** Ordem deduzida do próprio conteúdo (uma linha com dia > 12 decide o arquivo). */
  ordemInferida: OrdemDeData | null
  /** Há pelo menos uma data com barra. */
  temDataComBarra: boolean
  /** Há pelo menos uma linha com dia ≤ 12 **e** mês ≤ 12 — as duas leituras existem. */
  temAmbiguidade: boolean
  /** O arquivo tem linhas que **forçam** DD/MM e outras que forçam MM/DD. */
  conflitoDeOrdem: boolean
  /**
   * O usuário **precisa escolher** a ordem antes de importar (§4 ponto 6).
   *
   * `true` quando há ambiguidade real (nenhuma inferência a substitui — QA `D-7`) ou quando
   * o arquivo mistura as duas ordens. É esta flag, e não `temDataComBarra`, que a tela usa
   * para exibir o seletor e travar os botões: num arquivo em que toda data com barra é
   * inequívoca (`25/12/2026`) não há nada para o usuário decidir.
   */
  exigeEscolhaDeOrdem: boolean
  /** Linhas prontas para o wire, na ordem do arquivo. */
  validas: ImportHolidayItem[]
  totalDeErros: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalização de texto
// ─────────────────────────────────────────────────────────────────────────────

/** minúsculas, sem acento, sem espaço nas pontas — para casar cabeçalhos. */
export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 1a — CSV
// ─────────────────────────────────────────────────────────────────────────────

type RegistroBruto = { numero: number; celulas: string[] }

/** Escolhe o separador contando ocorrências FORA de aspas na primeira linha útil. */
export function detectarSeparador(primeiraLinha: string): string {
  const candidatos = [';', ',', '\t']
  let melhor = ','
  let melhorContagem = 0
  for (const candidato of candidatos) {
    let contagem = 0
    let emAspas = false
    for (const caractere of primeiraLinha) {
      if (caractere === '"') emAspas = !emAspas
      else if (!emAspas && caractere === candidato) contagem += 1
    }
    if (contagem > melhorContagem) {
      melhor = candidato
      melhorContagem = contagem
    }
  }
  return melhor
}

/**
 * CSV → registros, preservando o **número da linha física** de cada registro.
 * Suporta aspas duplas (inclusive `""` escapado) e quebra de linha dentro de aspas.
 */
export function lerCsv(texto: string): RegistroBruto[] {
  const semBom = texto.replace(/^\ufeff/, '')
  const primeiraLinha = semBom.split(/\r?\n/, 1)[0] ?? ''
  const separador = detectarSeparador(primeiraLinha)

  const registros: RegistroBruto[] = []
  let celulas: string[] = []
  let campo = ''
  let emAspas = false
  let linhaFisica = 1
  let linhaDoRegistro = 1

  function fecharCampo(): void {
    celulas.push(campo)
    campo = ''
  }

  function fecharRegistro(): void {
    fecharCampo()
    const vazio = celulas.every((c) => c.trim().length === 0)
    if (!vazio) registros.push({ numero: linhaDoRegistro, celulas })
    celulas = []
    linhaDoRegistro = linhaFisica + 1
  }

  for (let i = 0; i < semBom.length; i += 1) {
    const caractere = semBom[i]

    if (emAspas) {
      if (caractere === '"') {
        if (semBom[i + 1] === '"') {
          campo += '"'
          i += 1
        } else {
          emAspas = false
        }
      } else {
        if (caractere === '\n') linhaFisica += 1
        campo += caractere
      }
      continue
    }

    if (caractere === '"') {
      emAspas = true
    } else if (caractere === separador) {
      fecharCampo()
    } else if (caractere === '\n') {
      fecharRegistro()
      linhaFisica += 1
    } else if (caractere !== '\r') {
      campo += caractere
    }
  }

  if (campo.length > 0 || celulas.length > 0) fecharRegistro()

  return registros
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 1b — matriz → linhas, com detecção de coluna
// ─────────────────────────────────────────────────────────────────────────────

function indiceDaColuna(cabecalhos: string[], aceitos: string[]): number {
  return cabecalhos.findIndex((c) => aceitos.includes(normalizarCabecalho(c)))
}

/**
 * Registros → `ArquivoLido`, ou o erro de **arquivo** correspondente.
 *
 * Coluna faltando é recusada **aqui**, antes de qualquer envio, com os cabeçalhos
 * encontrados na mensagem — é o texto que §4 ponto 6 exige literalmente.
 */
export function montarArquivo(
  registros: RegistroBruto[],
  nomeDoArquivo: string,
): ResultadoDaLeitura {
  if (registros.length === 0) {
    return { ok: false, erro: 'O arquivo está vazio: nenhuma linha foi encontrada.' }
  }

  const cabecalho = registros[0]
  const colunas = cabecalho.celulas.map((c) => c.trim())
  const listaDeColunas = colunas.filter((c) => c.length > 0).join(', ')

  const iData = indiceDaColuna(colunas, CABECALHOS_DE_DATA)
  if (iData === -1) {
    return {
      ok: false,
      erro:
        'A planilha não tem coluna de data. Colunas encontradas: ' +
        `${listaDeColunas.length > 0 ? listaDeColunas : '(nenhuma)'}. ` +
        `Renomeie a coluna para uma destas: ${CABECALHOS_DE_DATA.join(', ')}.`,
    }
  }

  const iNome = indiceDaColuna(colunas, CABECALHOS_DE_NOME)
  if (iNome === -1) {
    return {
      ok: false,
      erro:
        'A planilha não tem coluna de nome. Colunas encontradas: ' +
        `${listaDeColunas.length > 0 ? listaDeColunas : '(nenhuma)'}. ` +
        `Renomeie a coluna para uma destas: ${CABECALHOS_DE_NOME.join(', ')}.`,
    }
  }

  const linhas: LinhaBruta[] = registros.slice(1).map((registro) => ({
    linhaNoArquivo: registro.numero,
    dataBruta: (registro.celulas[iData] ?? '').trim(),
    nomeBruto: (registro.celulas[iNome] ?? '').trim(),
  }))

  if (linhas.length === 0) {
    return {
      ok: false,
      erro: 'O arquivo tem cabeçalho mas nenhuma linha de feriado.',
    }
  }

  if (linhas.length > MAX_ITENS_IMPORTACAO) {
    return {
      ok: false,
      erro:
        `O arquivo tem ${linhas.length} linhas e a importação aceita no máximo ` +
        `${MAX_ITENS_IMPORTACAO} por vez. Divida o arquivo e importe em partes.`,
    }
  }

  return { ok: true, arquivo: { nomeDoArquivo, colunas, linhas } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 1c — leitura do File (CSV ou XLSX)
// ─────────────────────────────────────────────────────────────────────────────

/** Célula do `exceljs` → texto. Sem `any`: o valor é `unknown` e vai sendo estreitado. */
export function celulaParaTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor.trim()
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (valor instanceof Date) {
    // O `exceljs` devolve data de planilha como instante UTC. Ler os componentes
    // locais aqui deslocaria o dia para trás em `America/Sao_Paulo` — o mesmo
    // off-by-one que `utils/localDay.ts` existe para impedir.
    const ano = valor.getUTCFullYear()
    const mes = String(valor.getUTCMonth() + 1).padStart(2, '0')
    const dia = String(valor.getUTCDate()).padStart(2, '0')
    return `${ano}-${mes}-${dia}`
  }
  if (typeof valor === 'object') {
    const objeto = valor as { text?: unknown; result?: unknown; richText?: unknown }
    if (typeof objeto.text === 'string') return objeto.text.trim()
    if (Array.isArray(objeto.richText)) {
      return objeto.richText
        .map((parte) =>
          typeof parte === 'object' && parte !== null && 'text' in parte
            ? String((parte as { text: unknown }).text)
            : '',
        )
        .join('')
        .trim()
    }
    if (objeto.result !== undefined) return celulaParaTexto(objeto.result)
  }
  return ''
}

type LinhaDePlanilha = { number: number; cellCount: number; getCell: (i: number) => { value: unknown } }
type AbaDePlanilha = { eachRow: (cb: (linha: LinhaDePlanilha) => void) => void }

/** Aba do `exceljs` → registros (mesma forma do CSV), preservando o número da linha. */
export function planilhaParaRegistros(aba: AbaDePlanilha): RegistroBruto[] {
  const registros: RegistroBruto[] = []
  aba.eachRow((linha) => {
    const celulas: string[] = []
    for (let i = 1; i <= linha.cellCount; i += 1) {
      celulas.push(celulaParaTexto(linha.getCell(i).value))
    }
    if (celulas.some((c) => c.trim().length > 0)) {
      registros.push({ numero: linha.number, celulas })
    }
  })
  return registros
}

/**
 * Bytes → texto, **exigindo UTF-8 válido**. `null` quando o arquivo não é UTF-8.
 *
 * `fatal: true` é o ponto todo: sem ele o `TextDecoder` (e o `File.text()`, que é o mesmo
 * decodificador) troca cada byte inválido por `U+FFFD` **em silêncio** — foi assim que
 * `Proclamação da República` virou `Proclama<FFFD><FFFD>o da Rep<FFFD>blica` e a linha foi
 * marcada "Pronta" (QA `D-5`). Aqui o byte inválido **lança**, e a tela recusa o arquivo.
 *
 * Não há tentativa de reler como Windows-1252: adivinhar a codificação é a mesma classe de
 * palpite que adivinhar `DD/MM` × `MM/DD`, e um palpite errado grava nome errado no banco.
 */
export function decodificarUtf8Estrito(bytes: ArrayBuffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function extensaoDe(nome: string): string {
  const ponto = nome.lastIndexOf('.')
  return ponto === -1 ? '' : nome.slice(ponto).toLowerCase()
}

/**
 * Lê o arquivo escolhido pelo usuário. **Nunca lança**: todo problema vira
 * `{ ok: false, erro }` em português, porque essa mensagem vai para a tela.
 */
export async function lerArquivoDeFeriados(arquivo: File): Promise<ResultadoDaLeitura> {
  const extensao = extensaoDe(arquivo.name)

  if (!(EXTENSOES_ACEITAS as readonly string[]).includes(extensao)) {
    return {
      ok: false,
      erro: `Formato não suportado (${extensao || 'sem extensão'}). Envie um arquivo ${EXTENSOES_ACEITAS.join(', ')}.`,
    }
  }

  if (arquivo.size > MAX_TAMANHO_ARQUIVO_BYTES) {
    const mb = (MAX_TAMANHO_ARQUIVO_BYTES / (1024 * 1024)).toFixed(0)
    return { ok: false, erro: `O arquivo passa de ${mb} MB. Envie a planilha só com as colunas de data e nome.` }
  }

  try {
    if (extensao === '.xlsx') {
      // Import lazy — o `exceljs` já está no bundle (export de relatórios) e não deve
      // pesar a rota de configuração enquanto ninguém importa nada.
      const { default: ExcelJS } = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(await arquivo.arrayBuffer())
      const aba = workbook.worksheets[0]
      if (aba === undefined) {
        return { ok: false, erro: 'A planilha não tem nenhuma aba com dados.' }
      }
      return montarArquivo(planilhaParaRegistros(aba as unknown as AbaDePlanilha), arquivo.name)
    }

    const texto = decodificarUtf8Estrito(await arquivo.arrayBuffer())
    if (texto === null) {
      return {
        ok: false,
        erro:
          'O arquivo não está em UTF-8 — provavelmente foi salvo em Windows-1252/Latin-1, ' +
          'o padrão do "CSV (separado por vírgulas)" do Excel em português. Lido assim, todo ' +
          `acento vira caractere ilegível. ${COMO_CORRIGIR_CODIFICACAO}`,
      }
    }
    return montarArquivo(lerCsv(texto), arquivo.name)
  } catch {
    // Sem detalhe técnico na tela (rules/security.md) — e sem `console.log` com o
    // conteúdo do arquivo, que pode ser dado do cliente.
    return {
      ok: false,
      erro: 'Não foi possível ler o arquivo. Verifique se ele é um CSV ou XLSX válido.',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 2 — resolução das linhas (PURA)
// ─────────────────────────────────────────────────────────────────────────────

type DataClassificada =
  | { tipo: 'vazia' }
  | { tipo: 'iso'; ano: number; mes: number; dia: number }
  | { tipo: 'barra'; primeiro: number; segundo: number; ano: number }
  | { tipo: 'anoCurto' }
  | { tipo: 'naoReconhecida' }

/** Classifica o texto da célula sem decidir a ordem — quem decide é `resolverLinhas`. */
export function classificarData(bruto: string): DataClassificada {
  const texto = bruto.trim()
  if (texto.length === 0) return { tipo: 'vazia' }

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(texto)
  if (iso !== null) {
    return { tipo: 'iso', ano: Number(iso[1]), mes: Number(iso[2]), dia: Number(iso[3]) }
  }

  const barra = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(texto)
  if (barra !== null) {
    return {
      tipo: 'barra',
      primeiro: Number(barra[1]),
      segundo: Number(barra[2]),
      ano: Number(barra[3]),
    }
  }

  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2}$/.test(texto)) return { tipo: 'anoCurto' }

  return { tipo: 'naoReconhecida' }
}

/** `true` quando dia e mês são ambos ≤ 12 — a definição de ambiguidade de §4 ponto 6. */
export function ehAmbigua(classificada: DataClassificada): boolean {
  return classificada.tipo === 'barra' && classificada.primeiro <= 12 && classificada.segundo <= 12
}

/** Ordem que a própria linha **força**, quando um dos números passa de 12. */
export function ordemForcada(classificada: DataClassificada): OrdemDeData | null {
  if (classificada.tipo !== 'barra') return null
  const { primeiro, segundo } = classificada
  if (primeiro > 12 && segundo <= 12) return 'dmy'
  if (segundo > 12 && primeiro <= 12) return 'mdy'
  return null
}

/** Monta `AAAA-MM-DD` e recusa data que não existe no calendário (31/02, mês 13). */
function montarIso(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const data = new Date(ano, mes - 1, dia)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    return null
  }
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

/**
 * Decide o arquivo inteiro: interpreta cada data, aplica a `ordem` escolhida às datas
 * com barra e devolve as linhas com erro por linha.
 *
 * As **classes de linha inválida** tratadas aqui — cada uma com um teste próprio:
 *
 * | Classe | Mensagem |
 * |---|---|
 * | data vazia | "Informe a data do feriado." |
 * | formato não reconhecido | "Data em formato não reconhecido: …" |
 * | ano com 2 dígitos | "Escreva o ano com 4 dígitos…" |
 * | data inexistente (31/02, mês 13) | "Data inexistente: …" |
 * | texto corrompido (não-UTF-8) | "Texto ilegível nesta linha …" |
 * | ambígua sem escolha do usuário | "Escolha DD/MM ou MM/DD…" |
 * | fora da faixa de ±10 anos | "Data fora da faixa aceita (… a …)." |
 * | nome vazio | "O nome do feriado é obrigatório." |
 * | nome > 120 caracteres | "O nome do feriado deve ter no máximo 120 caracteres." |
 * | data repetida no arquivo | "Data repetida no arquivo (também na linha N)…" |
 *
 * As mensagens de faixa, nome e repetição espelham as do backend
 * (`HolidayService.ValidarLinhas`) de propósito: a pré-visualização precisa recusar
 * **exatamente** o que o `422` recusaria, senão ela vira uma segunda régua.
 */
export function resolverLinhas(
  linhas: readonly LinhaBruta[],
  ordem: OrdemDeData | null,
  hoje: string = diaLocalSaoPaulo(),
): ResolucaoDoArquivo {
  const { minimo, maximo } = faixaAceitaDeFeriado(hoje)

  let temDataComBarra = false
  let temAmbiguidade = false
  let forcaDmy = false
  let forcaMdy = false

  for (const linha of linhas) {
    const classificada = classificarData(linha.dataBruta)
    if (classificada.tipo === 'barra') temDataComBarra = true
    if (ehAmbigua(classificada)) temAmbiguidade = true
    const forcada = ordemForcada(classificada)
    if (forcada === 'dmy') forcaDmy = true
    if (forcada === 'mdy') forcaMdy = true
  }

  const conflitoDeOrdem = forcaDmy && forcaMdy
  const ordemInferida: OrdemDeData | null =
    conflitoDeOrdem ? null : forcaDmy ? 'dmy' : forcaMdy ? 'mdy' : null
  const exigeEscolhaDeOrdem = temAmbiguidade || conflitoDeOrdem

  /**
   * 🔴 QA `D-7`: **a inferência não substitui a escolha quando há ambiguidade.**
   *
   * `25/12/2026` no mesmo arquivo que `03/04/2026` *sugere* DD/MM, mas sugestão não é
   * decisão: quem cola meia planilha americana na outra metade produz exatamente esse
   * arquivo, e a interpretação errada entra no banco sem ninguém escolher nada. Quando há
   * ambiguidade, `ordemEfetiva` só existe se o usuário **clicar**.
   *
   * Sem nenhuma linha ambígua, a inferência continua: ali cada data com barra tem uma
   * leitura só (um dos números passa de 12), e aplicar essa leitura não é palpite.
   */
  const ordemEfetiva = ordem ?? (exigeEscolhaDeOrdem ? null : ordemInferida)

  const resolvidas: LinhaResolvida[] = []
  const vistas = new Map<string, number>()

  for (const linha of linhas) {
    const classificada = classificarData(linha.dataBruta)
    const ambigua = ehAmbigua(classificada)
    const nome = linha.nomeBruto.trim()

    let data: string | null = null
    let erro: string | null = null

    if (temTextoCorrompido(linha.dataBruta) || temTextoCorrompido(linha.nomeBruto)) {
      // QA `D-5`: a linha vinha marcada "Pronta" e gravaria o nome corrompido. Recusar a
      // linha derruba o lote (AUTO-124-9) — que é o resultado certo: metade dos feriados
      // com nome ilegível é pior que nenhum.
      erro =
        `Texto ilegível nesta linha ("${linha.dataBruta || '—'}" / "${linha.nomeBruto || '—'}"): ` +
        `os acentos não foram decodificados. ${COMO_CORRIGIR_CODIFICACAO}`
    } else {
      switch (classificada.tipo) {
        case 'vazia':
          erro = 'Informe a data do feriado.'
          break
        case 'anoCurto':
          erro = `Escreva o ano com 4 dígitos: "${linha.dataBruta}" é ambíguo demais para ser aceito.`
          break
        case 'naoReconhecida':
          erro = `Data em formato não reconhecido: "${linha.dataBruta}". Use AAAA-MM-DD ou DD/MM/AAAA.`
          break
        case 'iso':
          data = montarIso(classificada.ano, classificada.mes, classificada.dia)
          if (data === null) erro = `Data inexistente: "${linha.dataBruta}".`
          break
        case 'barra': {
          // As DUAS leituras são montadas ANTES de qualquer escolha. É o que separa
          // "impossível" de "ambígua": `31/13/2026` não existe em nenhuma das duas, e
          // dizer que ela "pode ser dia/mês ou mês/dia" era falso e mandava o usuário a
          // uma ação que não resolve nada (QA `D-6`).
          const comoDmy = montarIso(classificada.ano, classificada.segundo, classificada.primeiro)
          const comoMdy = montarIso(classificada.ano, classificada.primeiro, classificada.segundo)

          if (comoDmy === null && comoMdy === null) {
            erro = `Data inexistente: "${linha.dataBruta}" não existe nem como DD/MM nem como MM/DD.`
            break
          }
          if (ordemEfetiva === null) {
            erro = ambigua
              ? 'Escolha DD/MM ou MM/DD acima para interpretar esta data — ' +
                `"${linha.dataBruta}" pode ser dia/mês ou mês/dia.`
              : 'Escolha DD/MM ou MM/DD acima: a escolha vale para o arquivo inteiro, e ' +
                `enquanto não houver uma, "${linha.dataBruta}" não é interpretada.`
            break
          }
          data = ordemEfetiva === 'dmy' ? comoDmy : comoMdy
          if (data === null) {
            erro =
              `Data inexistente: "${linha.dataBruta}" lida como ` +
              `${ordemEfetiva === 'dmy' ? 'DD/MM' : 'MM/DD'}.`
          }
          break
        }
      }
    }

    if (erro === null && data !== null) {
      if (data < minimo || data > maximo) {
        erro = `Data fora da faixa aceita (${minimo} a ${maximo}).`
      } else {
        const primeira = vistas.get(data)
        if (primeira !== undefined) {
          erro = `Data repetida no arquivo (também na linha ${primeira}). Deixe apenas uma linha por data.`
        } else if (nome.length === 0) {
          erro = 'O nome do feriado é obrigatório.'
        } else if (nome.length > MAX_NOME_FERIADO) {
          erro = `O nome do feriado deve ter no máximo ${MAX_NOME_FERIADO} caracteres.`
        } else {
          vistas.set(data, linha.linhaNoArquivo)
        }
      }
    }

    resolvidas.push({
      ...linha,
      nome,
      data: erro === null ? data : null,
      erro,
      ambigua,
    })
  }

  const validas: ImportHolidayItem[] = resolvidas
    .filter((l): l is LinhaResolvida & { data: string } => l.erro === null && l.data !== null)
    .map((l) => ({ data: l.data, nome: l.nome }))

  return {
    linhas: resolvidas,
    ordemInferida,
    temDataComBarra,
    temAmbiguidade,
    conflitoDeOrdem,
    exigeEscolhaDeOrdem,
    validas,
    totalDeErros: resolvidas.filter((l) => l.erro !== null).length,
  }
}

/**
 * Texto de conferência da linha: a data como o sistema a entendeu, **por extenso**.
 * É o que torna a escolha `DD/MM` × `MM/DD` verificável a olho — "2026-04-03" não
 * denuncia nada; "3 de abril de 2026" denuncia.
 */
export function interpretacaoPorExtenso(linha: LinhaResolvida): string {
  return linha.data === null ? '—' : dataPorExtenso(linha.data)
}
