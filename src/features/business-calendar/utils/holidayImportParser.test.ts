import { describe, expect, it } from 'vitest'
import {
  celulaParaTexto,
  classificarData,
  decodificarUtf8Estrito,
  detectarSeparador,
  ehAmbigua,
  interpretacaoPorExtenso,
  lerArquivoDeFeriados,
  lerCsv,
  montarArquivo,
  normalizarCabecalho,
  ordemForcada,
  planilhaParaRegistros,
  resolverLinhas,
  temTextoCorrompido,
  type LinhaBruta,
} from './holidayImportParser'

const HOJE = '2026-09-06'

function linha(numero: number, dataBruta: string, nomeBruto: string): LinhaBruta {
  return { linhaNoArquivo: numero, dataBruta, nomeBruto }
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura do CSV e detecção de colunas (erro de ARQUIVO)
// ─────────────────────────────────────────────────────────────────────────────

describe('holidayImportParser — leitura de CSV', () => {
  it('detecta o separador da primeira linha', () => {
    expect(detectarSeparador('data;nome')).toBe(';')
    expect(detectarSeparador('data,nome')).toBe(',')
    expect(detectarSeparador('data\tnome')).toBe('\t')
  })

  it('lê linhas com aspas, separador dentro do campo e BOM', () => {
    const csv = '﻿data,nome\n2026-12-25,"Natal, feriado nacional"\n'
    const registros = lerCsv(csv)
    expect(registros).toEqual([
      { numero: 1, celulas: ['data', 'nome'] },
      { numero: 2, celulas: ['2026-12-25', 'Natal, feriado nacional'] },
    ])
  })

  it('preserva o NÚMERO da linha do arquivo, pulando linhas em branco', () => {
    const csv = 'data;nome\n\n2026-12-25;Natal\n'
    expect(lerCsv(csv).map((r) => r.numero)).toEqual([1, 3])
  })

  it('normaliza cabeçalho sem acento e sem caixa', () => {
    expect(normalizarCabecalho(' Descrição ')).toBe('descricao')
    expect(normalizarCabecalho('DATA')).toBe('data')
  })

  it('aceita os cabeçalhos alternativos previstos', () => {
    const resultado = montarArquivo(lerCsv('Dia;Descrição\n2026-12-25;Natal\n'), 'f.csv')
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.arquivo.linhas).toEqual([linha(2, '2026-12-25', 'Natal')])
    }
  })

  it('coluna de data faltando é erro ANTES de qualquer envio, com as colunas encontradas', () => {
    const resultado = montarArquivo(lerCsv('quando;titulo\n25/12/2026;Natal\n'), 'f.csv')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.erro).toContain('não tem coluna de data')
      expect(resultado.erro).toContain('quando, titulo')
    }
  })

  it('coluna de nome faltando também é erro de arquivo', () => {
    const resultado = montarArquivo(lerCsv('data;titulo\n2026-12-25;Natal\n'), 'f.csv')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('não tem coluna de nome')
  })

  it('arquivo só com cabeçalho é recusado', () => {
    const resultado = montarArquivo(lerCsv('data;nome\n'), 'f.csv')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('nenhuma linha de feriado')
  })

  it('mais de 500 linhas é recusado na pré-visualização, com o número recebido', () => {
    const linhas = Array.from({ length: 501 }, (_, i) => `2026-01-01;Feriado ${i}`).join('\n')
    const resultado = montarArquivo(lerCsv(`data;nome\n${linhas}\n`), 'f.csv')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.erro).toContain('501')
      expect(resultado.erro).toContain('500')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Classes de LINHA inválida (o coração da pré-visualização)
// ─────────────────────────────────────────────────────────────────────────────

describe('holidayImportParser — classes de linha inválida', () => {
  it('linha boa vira item do wire, e só ela', () => {
    const resultado = resolverLinhas([linha(2, '2026-12-25', 'Natal')], null, HOJE)
    expect(resultado.totalDeErros).toBe(0)
    expect(resultado.validas).toEqual([{ data: '2026-12-25', nome: 'Natal' }])
  })

  it('data vazia', () => {
    const [item] = resolverLinhas([linha(2, '', 'Natal')], null, HOJE).linhas
    expect(item.erro).toBe('Informe a data do feriado.')
    expect(item.data).toBeNull()
  })

  it('formato não reconhecido — e o texto original aparece na mensagem', () => {
    const [item] = resolverLinhas([linha(2, '25 de dezembro', 'Natal')], null, HOJE).linhas
    expect(item.erro).toContain('formato não reconhecido')
    expect(item.erro).toContain('25 de dezembro')
  })

  it('ano com 2 dígitos é recusado em vez de adivinhado', () => {
    const [item] = resolverLinhas([linha(2, '25/12/26', 'Natal')], null, HOJE).linhas
    expect(item.erro).toContain('4 dígitos')
  })

  it('data que não existe no calendário', () => {
    const [item] = resolverLinhas([linha(2, '2026-02-31', 'Nada')], null, HOJE).linhas
    expect(item.erro).toContain('Data inexistente')
  })

  it('fora da faixa de ±10 anos, com os limites na mensagem', () => {
    const [item] = resolverLinhas([linha(2, '1900-01-01', 'Antigo')], null, HOJE).linhas
    expect(item.erro).toContain('fora da faixa aceita')
    expect(item.erro).toContain('2016-09-06')
    expect(item.erro).toContain('2036-09-06')
  })

  it('nome vazio', () => {
    const [item] = resolverLinhas([linha(2, '2026-12-25', '   ')], null, HOJE).linhas
    expect(item.erro).toBe('O nome do feriado é obrigatório.')
  })

  it('nome com mais de 120 caracteres', () => {
    const [item] = resolverLinhas([linha(2, '2026-12-25', 'x'.repeat(121))], null, HOJE).linhas
    expect(item.erro).toContain('120 caracteres')
  })

  it('data repetida no arquivo aponta a PRIMEIRA linha', () => {
    const resultado = resolverLinhas(
      [linha(2, '2026-12-25', 'Natal'), linha(7, '2026-12-25', 'Natal (bis)')],
      null,
      HOJE,
    )
    expect(resultado.linhas[0].erro).toBeNull()
    expect(resultado.linhas[1].erro).toContain('também na linha 2')
    expect(resultado.validas).toHaveLength(1)
  })

  it('uma linha ruim NÃO derruba as boas do relatório — mas o total de erros denuncia', () => {
    const resultado = resolverLinhas(
      [linha(2, '2026-12-25', 'Natal'), linha(3, 'xx', 'Ruim')],
      null,
      HOJE,
    )
    expect(resultado.totalDeErros).toBe(1)
    expect(resultado.validas).toHaveLength(1)
    // Companheira positiva: a linha boa continua marcada como boa.
    expect(resultado.linhas[0].erro).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ambiguidade DD/MM × MM/DD
// ─────────────────────────────────────────────────────────────────────────────

describe('holidayImportParser — ambiguidade de data', () => {
  it('classifica ISO, barra e formato solto', () => {
    expect(classificarData('2026-12-25').tipo).toBe('iso')
    expect(classificarData('03/04/2026').tipo).toBe('barra')
    expect(classificarData('ontem').tipo).toBe('naoReconhecida')
    expect(classificarData('  ').tipo).toBe('vazia')
  })

  it('ambígua é dia ≤ 12 E mês ≤ 12 — a definição de §4 ponto 6', () => {
    expect(ehAmbigua(classificarData('03/04/2026'))).toBe(true)
    expect(ehAmbigua(classificarData('25/12/2026'))).toBe(false)
    expect(ehAmbigua(classificarData('2026-03-04'))).toBe(false)
  })

  it('uma linha com dia > 12 FORÇA a ordem do arquivo', () => {
    expect(ordemForcada(classificarData('25/12/2026'))).toBe('dmy')
    expect(ordemForcada(classificarData('12/25/2026'))).toBe('mdy')
    expect(ordemForcada(classificarData('03/04/2026'))).toBeNull()
  })

  it('sem ordem escolhida, a linha ambígua fica bloqueada — nada é adivinhado', () => {
    const resultado = resolverLinhas([linha(2, '03/04/2026', 'Feriado')], null, HOJE)
    expect(resultado.temDataComBarra).toBe(true)
    expect(resultado.ordemInferida).toBeNull()
    expect(resultado.linhas[0].ambigua).toBe(true)
    expect(resultado.linhas[0].erro).toContain('Escolha DD/MM ou MM/DD')
    expect(resultado.validas).toEqual([])
  })

  it('a escolha muda a interpretação de TODAS as linhas, e ela é visível por extenso', () => {
    const dmy = resolverLinhas([linha(2, '03/04/2026', 'Feriado')], 'dmy', HOJE)
    expect(dmy.validas).toEqual([{ data: '2026-04-03', nome: 'Feriado' }])
    expect(interpretacaoPorExtenso(dmy.linhas[0])).toBe('3 de abril de 2026')

    const mdy = resolverLinhas([linha(2, '03/04/2026', 'Feriado')], 'mdy', HOJE)
    expect(mdy.validas).toEqual([{ data: '2026-03-04', nome: 'Feriado' }])
    expect(interpretacaoPorExtenso(mdy.linhas[0])).toBe('4 de março de 2026')
  })

  /**
   * 🔴 Este teste TRAVAVA o defeito `D-7` — afirmava que a ordem inferida resolvia a linha
   * ambígua sozinha, que é exatamente o palpite que a §4 ponto 6 proíbe. Reescrito para
   * afirmar a correção (`rules/tests.md` § "teste que documenta bug é reescrito, nunca
   * apagado").
   */
  it('ordem inferida NÃO resolve a ambígua: com ambiguidade, a escolha é exigida', () => {
    const resultado = resolverLinhas(
      [linha(2, '25/12/2026', 'Natal'), linha(3, '03/04/2026', 'Outro')],
      null,
      HOJE,
    )
    // A inferência continua existindo como informação...
    expect(resultado.ordemInferida).toBe('dmy')
    // ...mas não decide nada: o arquivo tem data ambígua e nada é interpretado sem escolha.
    expect(resultado.temAmbiguidade).toBe(true)
    expect(resultado.exigeEscolhaDeOrdem).toBe(true)
    expect(resultado.validas).toEqual([])
    expect(resultado.linhas[1].erro).toContain('Escolha DD/MM ou MM/DD')

    // Companheira positiva NA MESMA execução: com a escolha feita, tudo resolve.
    const comEscolha = resolverLinhas(
      [linha(2, '25/12/2026', 'Natal'), linha(3, '03/04/2026', 'Outro')],
      'dmy',
      HOJE,
    )
    expect(comEscolha.validas).toEqual([
      { data: '2026-12-25', nome: 'Natal' },
      { data: '2026-04-03', nome: 'Outro' },
    ])
  })

  it('SEM ambiguidade a inferência continua valendo — não há o que escolher', () => {
    // `25/12/2026` tem uma leitura só. Exigir clique aqui seria fricção sem proteção.
    const resultado = resolverLinhas([linha(2, '25/12/2026', 'Natal')], null, HOJE)
    expect(resultado.temAmbiguidade).toBe(false)
    expect(resultado.exigeEscolhaDeOrdem).toBe(false)
    expect(resultado.validas).toEqual([{ data: '2026-12-25', nome: 'Natal' }])
  })

  it('a linha NÃO ambígua bloqueada por falta de escolha não recebe a mensagem de ambiguidade', () => {
    // Mesmo arquivo do teste acima: a linha 2 é inequívoca, mas fica presa à escolha do
    // arquivo. Dizer a ela "pode ser dia/mês ou mês/dia" seria a mesma falsidade de `D-6`.
    const resultado = resolverLinhas(
      [linha(2, '25/12/2026', 'Natal'), linha(3, '03/04/2026', 'Outro')],
      null,
      HOJE,
    )
    expect(resultado.linhas[0].erro).toContain('vale para o arquivo inteiro')
    expect(resultado.linhas[0].erro).not.toContain('pode ser dia/mês ou mês/dia')
    // Companheira positiva: a linha realmente ambígua recebe, sim, essa explicação.
    expect(resultado.linhas[1].erro).toContain('pode ser dia/mês ou mês/dia')
  })

  it('arquivo que mistura DD/MM e MM/DD é sinalizado, não "resolvido" na marra', () => {
    const resultado = resolverLinhas(
      [linha(2, '25/12/2026', 'Natal'), linha(3, '12/25/2026', 'Natal americano')],
      null,
      HOJE,
    )
    expect(resultado.conflitoDeOrdem).toBe(true)
    expect(resultado.ordemInferida).toBeNull()
  })

  it('escolha errada não vira data silenciosa: 25/12 lido como MM/DD é recusado', () => {
    const resultado = resolverLinhas([linha(2, '25/12/2026', 'Natal')], 'mdy', HOJE)
    expect(resultado.linhas[0].erro).toContain('Data inexistente')
    expect(resultado.linhas[0].erro).toContain('MM/DD')
  })

  it('ISO no arquivo não depende de escolha nenhuma', () => {
    const resultado = resolverLinhas([linha(2, '2026-12-25', 'Natal')], null, HOJE)
    expect(resultado.temDataComBarra).toBe(false)
    expect(resultado.exigeEscolhaDeOrdem).toBe(false)
    expect(resultado.validas).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// QA `D-6` — data impossível nas DUAS leituras não é "ambígua"
// ─────────────────────────────────────────────────────────────────────────────

describe('holidayImportParser — data impossível nas duas leituras (D-6)', () => {
  it('31/13/2026 é INEXISTENTE, não "pode ser dia/mês ou mês/dia"', () => {
    const resultado = resolverLinhas([linha(2, '31/13/2026', 'Nada')], null, HOJE)
    const [item] = resultado.linhas

    expect(item.erro).toContain('Data inexistente')
    expect(item.erro).toContain('31/13/2026')
    // A frase antiga era FALSA (não existe mês 13) e mandava o usuário a uma ação que
    // não resolve: escolher qualquer ordem deixa a linha inválida do mesmo jeito.
    expect(item.erro).not.toContain('pode ser dia/mês ou mês/dia')
    expect(item.data).toBeNull()
  })

  it('a mensagem não muda se o usuário escolher uma ordem — porque a escolha não resolve', () => {
    for (const ordem of ['dmy', 'mdy'] as const) {
      const [item] = resolverLinhas([linha(2, '31/13/2026', 'Nada')], ordem, HOJE).linhas
      expect(item.erro).toContain('Data inexistente')
    }
  })

  it('data impossível NÃO obriga a escolher ordem — o seletor não é exibido por ela', () => {
    const resultado = resolverLinhas([linha(2, '31/13/2026', 'Nada')], null, HOJE)
    expect(resultado.temAmbiguidade).toBe(false)
    expect(resultado.exigeEscolhaDeOrdem).toBe(false)
  })

  it('companheira positiva: 03/04/2026 CONTINUA recebendo a explicação de ambiguidade', () => {
    // Sem este par, o teste acima passaria com a mensagem de ambiguidade apagada do código.
    const [item] = resolverLinhas([linha(2, '03/04/2026', 'Feriado')], null, HOJE).linhas
    expect(item.erro).toContain('pode ser dia/mês ou mês/dia')
  })

  it('data válida em UMA leitura só continua sendo recusada pela leitura escolhida', () => {
    // `25/12` existe como DD/MM e não como MM/DD: com a escolha errada, a recusa nomeia a
    // leitura aplicada — comportamento preservado da versão anterior.
    const [item] = resolverLinhas([linha(2, '25/12/2026', 'Natal')], 'mdy', HOJE).linhas
    expect(item.erro).toContain('Data inexistente')
    expect(item.erro).toContain('MM/DD')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// QA `D-5` — codificação
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `Proclamação da República` em Windows-1252 (o padrão do Excel pt-BR no Windows).
 *
 * O retorno é `Uint8Array<ArrayBuffer>` (e não o `Uint8Array` solto, que o TS 5.7+ infere
 * como `Uint8Array<ArrayBufferLike>`): só a forma concreta satisfaz `BlobPart` no
 * construtor de `File`. QA `N-3` — o `npm run build` não pega isto, porque
 * `tsconfig.app.json` exclui os arquivos de teste.
 */
function csvLatin1(): Uint8Array<ArrayBuffer> {
  const latin1 = (texto: string): number[] => [...texto].map((c) => c.charCodeAt(0))
  return new Uint8Array([
    ...latin1('data;nome\n2026-11-15;Proclama'),
    0xe7, // ç
    0xe3, // ã
    ...latin1('o da Rep'),
    0xfa, // ú
    ...latin1('blica\n'),
  ])
}

/** O nome como a leitura errada o entrega — três `U+FFFD` no lugar dos acentos. */
const NOME_CORROMPIDO = 'Proclama\ufffd\ufffdo da Rep\ufffdblica'

describe('holidayImportParser — codificação do arquivo (D-5)', () => {
  it('decodificador estrito devolve null para bytes que não são UTF-8', () => {
    const bytes = csvLatin1()
    expect(decodificarUtf8Estrito(bytes.buffer as ArrayBuffer)).toBeNull()
    // Companheira positiva na mesma execução: UTF-8 legítimo com acento passa inteiro.
    const utf8 = new TextEncoder().encode('Proclamação da República')
    expect(decodificarUtf8Estrito(utf8.buffer as ArrayBuffer)).toBe('Proclamação da República')
  })

  it('CSV em Windows-1252 é RECUSADO como arquivo, com a instrução de como salvar', async () => {
    const arquivo = new File([csvLatin1()], 'feriados.csv', { type: 'text/csv' })
    const resultado = await lerArquivoDeFeriados(arquivo)

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.erro).toContain('UTF-8')
      expect(resultado.erro).toContain('.xlsx')
    }
  })

  it('CSV UTF-8 com o MESMO texto acentuado é aceito — a recusa é da codificação, não do acento', async () => {
    const arquivo = new File(
      ['data;nome\n2026-11-15;Proclamação da República\n'],
      'f.csv',
      { type: 'text/csv' },
    )
    const resultado = await lerArquivoDeFeriados(arquivo)

    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.arquivo.linhas[0].nomeBruto).toBe('Proclamação da República')
    }
  })

  it('célula que chega com U+FFFD torna a LINHA inválida — nunca "Pronta"', () => {
    expect(temTextoCorrompido(NOME_CORROMPIDO)).toBe(true)

    const resultado = resolverLinhas([linha(2, '2026-11-15', NOME_CORROMPIDO)], null, HOJE)
    expect(resultado.linhas[0].erro).toContain('Texto ilegível')
    expect(resultado.linhas[0].data).toBeNull()
    // AUTO-124-9: linha inválida derruba o lote inteiro.
    expect(resultado.validas).toEqual([])
    expect(resultado.totalDeErros).toBe(1)
  })

  it('companheira positiva: o mesmo nome íntegro passa sem erro nenhum', () => {
    expect(temTextoCorrompido('Proclamação da República')).toBe(false)
    const resultado = resolverLinhas(
      [linha(2, '2026-11-15', 'Proclamação da República')],
      null,
      HOJE,
    )
    expect(resultado.linhas[0].erro).toBeNull()
    expect(resultado.validas).toEqual([
      { data: '2026-11-15', nome: 'Proclamação da República' },
    ])
  })

  it('U+FFFD na coluna de DATA também invalida a linha', () => {
    const resultado = resolverLinhas([linha(2, '2026-11-\ufffd5', 'Natal')], null, HOJE)
    expect(resultado.linhas[0].erro).toContain('Texto ilegível')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Células de planilha
// ─────────────────────────────────────────────────────────────────────────────

describe('holidayImportParser — células de planilha', () => {
  it('data de planilha é lida em UTC — sem deslocar o dia para trás', () => {
    expect(celulaParaTexto(new Date(Date.UTC(2026, 11, 25)))).toBe('2026-12-25')
  })

  it('texto, número, fórmula e rich text viram texto', () => {
    expect(celulaParaTexto('  Natal ')).toBe('Natal')
    expect(celulaParaTexto(45_678)).toBe('45678')
    expect(celulaParaTexto({ formula: 'A1', result: 'Natal' })).toBe('Natal')
    expect(celulaParaTexto({ richText: [{ text: 'Cor' }, { text: 'pus' }] })).toBe('Corpus')
    expect(celulaParaTexto(null)).toBe('')
    expect(celulaParaTexto(undefined)).toBe('')
  })

  it('aba do exceljs vira registros com o número real da linha', () => {
    const linhas = [
      { number: 1, celulas: ['data', 'nome'] },
      { number: 2, celulas: ['', ''] },
      { number: 3, celulas: ['2026-12-25', 'Natal'] },
    ]
    const aba = {
      eachRow: (cb: (l: { number: number; cellCount: number; getCell: (i: number) => { value: unknown } }) => void) => {
        for (const l of linhas) {
          cb({
            number: l.number,
            cellCount: l.celulas.length,
            getCell: (i: number) => ({ value: l.celulas[i - 1] }),
          })
        }
      },
    }
    expect(planilhaParaRegistros(aba)).toEqual([
      { numero: 1, celulas: ['data', 'nome'] },
      { numero: 3, celulas: ['2026-12-25', 'Natal'] },
    ])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Leitura do File
// ─────────────────────────────────────────────────────────────────────────────

describe('holidayImportParser — leitura do arquivo escolhido', () => {
  it('lê um CSV de verdade ponta a ponta', async () => {
    const arquivo = new File(['data;nome\n2026-12-25;Natal\n'], 'feriados.csv', {
      type: 'text/csv',
    })
    const resultado = await lerArquivoDeFeriados(arquivo)
    expect(resultado.ok).toBe(true)
    if (resultado.ok) {
      expect(resultado.arquivo.nomeDoArquivo).toBe('feriados.csv')
      expect(resultado.arquivo.linhas).toHaveLength(1)
    }
  })

  it('recusa extensão não suportada sem lançar', async () => {
    const arquivo = new File(['x'], 'feriados.pdf', { type: 'application/pdf' })
    const resultado = await lerArquivoDeFeriados(arquivo)
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('Formato não suportado')
  })

  it('recusa arquivo grande ANTES de parsear — a aba do usuário é o recurso protegido', async () => {
    const arquivo = new File(['x'], 'grande.csv', { type: 'text/csv' })
    Object.defineProperty(arquivo, 'size', { value: 5 * 1024 * 1024 })
    const resultado = await lerArquivoDeFeriados(arquivo)
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erro).toContain('MB')
  })
})
