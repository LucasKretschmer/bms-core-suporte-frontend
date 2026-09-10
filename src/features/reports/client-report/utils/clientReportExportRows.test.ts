/**
 * 123/FAT-1 — export CSV/Excel do Relatório do Cliente: a coluna "Concluído em".
 *
 * Este arquivo existe porque o mapeamento vivia DENTRO de `index.tsx`, numa tela que não tem
 * teste de página — era o único dos quatro lugares do campo que nenhum teste alcançava
 * (AP-FRONTEND-028: "o export entra no checklist de teste do campo, sempre").
 *
 * O que deixa cada asserção VERMELHA:
 *  · trocar o guard `== null` por `=== undefined` → linha com `fechadoEmChamado: null`
 *    passa a escrever "Invalid Date" na planilha que o gestor encaminha;
 *  · usar `?? '—'` sobre o resultado de `formatDate` em vez de guardar antes → mesmo efeito;
 *  · remover a coluna do array → o assert de identidade/ordem dos cabeçalhos cai;
 *  · deixar `fechadoEmChamado` fora do mapeamento embora presente na lista de colunas → a
 *    célula sairia vazia no arquivo, e o assert de valor cai;
 *  · qualquer campo de categoria do HubSpot entrando no export → assert de privacidade.
 */

import { describe, expect, it } from 'vitest'
import {
  CLIENT_REPORT_EXPORT_COLUMNS,
  itemToExportRow,
} from './clientReportExportRows'
import type { ClientReportItemDto } from '../../shared/types/reports'

function item(overrides: Partial<ClientReportItemDto> = {}): ClientReportItemDto {
  return {
    timeEntryId: 1,
    origem: 'ticket',
    ticketId: 100,
    hubspotTicketId: '100',
    projetoId: null,
    projetoNome: null,
    stage: null,
    assunto: 'Assunto',
    equipeAtribuida: 'Suporte',
    solicitante: { nome: 'João', email: 'j@x.com' },
    atendente: 'Ana',
    donoChamado: 'Dono',
    categorizacaoAtendimento: 'Consultoria',
    servico: 'Suporte Técnico',
    servicoSecundario: 'Configuração',
    faturamento: 'Faturado',
    aberturaDosChamado: '2026-07-10T12:00:00Z',
    dataApontamento: '2026-07-20T13:00:00Z',
    totalSegundos: 7200,
    ...overrides,
  }
}

describe('CLIENT_REPORT_EXPORT_COLUMNS', () => {
  it('os cabeçalhos são nominalmente estes, nesta ordem', () => {
    // Identidade + ordem: a planilha tem de se ler como a tela, e "Concluído em" fica
    // imediatamente depois de "Data do apontamento" porque é a leitura das duas juntas que
    // explica a competência da linha. Cardinalidade passaria com uma entrando e outra saindo.
    expect(CLIENT_REPORT_EXPORT_COLUMNS.map((c) => c.header)).toEqual([
      'Origem',
      'Ticket / Projeto',
      'Nome do ticket',
      'Equipe',
      'Serviço',
      'Serviço - Secundário',
      'Solicitante',
      'Atendente',
      'Categorização do atendimento',
      'Faturamento',
      'Abertura do chamado',
      'Data do apontamento',
      'Concluído em',
      'Tempo',
    ])
  })

  it('toda coluna declarada tem chave preenchida pelo mapeamento (e vice-versa)', () => {
    // Coluna sem chave no mapeamento sai como célula VAZIA no arquivo, em silêncio; chave
    // mapeada sem coluna é dado computado que ninguém vê. Os dois lados reprovam aqui.
    const chavesDasColunas = new Set(CLIENT_REPORT_EXPORT_COLUMNS.map((c) => c.key))
    const chavesDaLinha = new Set(Object.keys(itemToExportRow(item())))
    expect(chavesDaLinha).toEqual(chavesDasColunas)
  })

  it('PRIVACIDADE: nenhuma coluna expõe categoria do HubSpot', () => {
    const proibido = [/categoria$/i, /problema/i, /invoicy/i]
    const infratores = CLIENT_REPORT_EXPORT_COLUMNS.filter(
      (c) => proibido.some((p) => p.test(c.key)) || proibido.some((p) => p.test(c.header)),
    )
    expect(infratores).toEqual([])
    // Controle positivo do detector — senão uma regex quebrada deixaria o assert vacuamente
    // verde. "Categorização do atendimento" é a ServiceCategory INTERNA e é permitida
    // (`/categoria$/` não casa "Categorização"), então o controle usa um nome fabricado.
    expect(proibido.some((p) => p.test('Problema - Invoicy'))).toBe(true)
  })
})

describe('itemToExportRow — "Concluído em"', () => {
  it('data presente sai em dd/MM/yyyy (fuso de São Paulo, literal à mão)', () => {
    expect(itemToExportRow(item({ fechadoEmChamado: '2026-08-05T14:30:00Z' })))
      .toMatchObject({ fechadoEmChamado: '05/08/2026' })
  })

  it('o caso do relato: apontamento em JULHO com conclusão em AGOSTO, na mesma linha', () => {
    // As duas datas convivem e a planilha passa a EXPLICAR por que a linha está na fatura
    // de agosto — que é a única razão de a coluna existir.
    const linha = itemToExportRow(
      item({
        dataApontamento: '2026-07-20T13:00:00Z',
        fechadoEmChamado: '2026-08-05T14:30:00Z',
      }),
    )
    // Formato do `Intl.DateTimeFormat('pt-BR')` com data+hora: a vírgula é dele.
    expect(linha.dataApontamento).toBe('20/07/2026, 10:00')
    expect(linha.fechadoEmChamado).toBe('05/08/2026')
  })

  it('campo AUSENTE → "—" (linha de projeto: o backend não manda a chave)', () => {
    const linha = itemToExportRow(item({ origem: 'projeto', projetoNome: 'Projeto X' }))
    expect(linha.fechadoEmChamado).toBe('—')
    // Companheira positiva na MESMA linha: sem ela, "não vejo data" seria satisfeito por um
    // mapeamento que não escreve nada.
    expect(linha.origem).toBe('Projeto')
  })

  it('campo `null` → "—" também (a OUTRA forma de ausente no wire)', () => {
    // Com `=== undefined`, este caso chegava a `formatDate(null)`. Um teste só com
    // `undefined` passaria nas duas implementações e não discriminaria.
    const linha = itemToExportRow(item({ fechadoEmChamado: null }))
    expect(linha.fechadoEmChamado).toBe('—')
    // 134/U11 — `tempo` agora é SEGUNDOS crus (coluna `type: 'duration'`), não texto.
    // Segue sendo a companheira positiva desta linha: prova que o mapeamento escreveu.
    expect(linha.tempo).toBe(7200)
  })

  it('data ilegível não vira "Invalid Date" na planilha', () => {
    const linha = itemToExportRow(item({ fechadoEmChamado: 'xx' }))
    expect(String(linha.fechadoEmChamado)).not.toContain('Invalid')
  })
})

/**
 * 134/U11 — a coluna "Tempo" no export virou DURAÇÃO CALCULÁVEL: o mapper para de formatar e
 * entrega segundos crus; quem formata é o `exportTable` (CSV `H:mm:ss`, XLSX serial + `[h]:mm:ss`).
 * A tela e o PDF continuam em `2h 44m` de propósito — nada aqui os cobre.
 */
describe('itemToExportRow — "Tempo" como duração calculável (134/U11)', () => {
  it('9840s sai como o NÚMERO 9840, não como o texto "2h 44m"', () => {
    // VERMELHO se: o mapper voltar a `formatSeconds(item.totalSegundos)` (sai '2h 44m');
    // se alguém "ajudar" convertendo para string (`String(...)`, template literal);
    // se o helper trocar `Math.round` por outra coisa que altere o inteiro.
    const linha = itemToExportRow(item({ totalSegundos: 9840 }))
    expect(linha.tempo).toBe(9840)
    expect(typeof linha.tempo).toBe('number')
  })

  it('0s é VALOR (0), não ausência', () => {
    // VERMELHO se: qualquer ramo do caminho de duração for `if (!v) return null` / `?? ''`
    // (sairia célula vazia = perda de dado na planilha que o gestor encaminha);
    // se o mapper voltar a formatar (sairia '0h 0m').
    // É a companheira positiva do guard de ausência: `0` e "não sei" não podem colapsar.
    const linha = itemToExportRow(item({ totalSegundos: 0 }))
    expect(linha.tempo).toBe(0)
    expect(typeof linha.tempo).toBe('number')
  })

  it('`tempo` é a ÚNICA coluna `duration` do export — identidade nominal, não contagem', () => {
    // Conjunto DERIVADO do array em runtime (não lista mantida à mão): coluna nova nasce
    // dentro da varredura. VERMELHO se: o `type: 'duration'` sair de `tempo` (conjunto vazio);
    // se `type: 'duration'` for posto em qualquer outra coluna (ex.: uma data), o que a
    // escreveria como serial de Excel. Cardinalidade passaria com uma entrando e outra saindo.
    const chavesDuration = new Set(
      CLIENT_REPORT_EXPORT_COLUMNS.filter((c) => c.type === 'duration').map((c) => c.key),
    )
    expect(chavesDuration).toEqual(new Set(['tempo']))
  })

  it('toda coluna `duration` recebe número ou null do mapeamento — nunca texto', () => {
    // Invariante derivado: casa as duas pontas (declaração da coluna × valor do mapper) sem
    // nomear ninguém. VERMELHO se uma coluna marcada `duration` continuar pré-formatada —
    // exatamente o defeito que o FALLBACK RUIDOSO do `exportTable` degrada, e que aqui reprova
    // na origem. Controle positivo abaixo: prova que a varredura visitou alguma coluna.
    const linha = itemToExportRow(item({ totalSegundos: 9840 }))
    const visitadas: string[] = []
    for (const coluna of CLIENT_REPORT_EXPORT_COLUMNS) {
      if (coluna.type !== 'duration') continue
      visitadas.push(coluna.key)
      const valor = linha[coluna.key]
      expect(valor === null || typeof valor === 'number').toBe(true)
    }
    expect(visitadas).toEqual(['tempo'])
  })
})
