import { describe, expect, it, vi } from 'vitest'
import {
  dataCurta,
  dataPorExtenso,
  diaLocalSaoPaulo,
  ehDiaRetroativo,
  faixaAceitaDeFeriado,
  somarAnos,
} from './localDay'

/**
 * O dia local de São Paulo — a régua do aviso de retroatividade (DD-2) e da faixa de
 * ±10 anos da importação.
 */
describe('localDay — dia civil em America/Sao_Paulo', () => {
  it('usa o fuso de SP, não o relógio da máquina', () => {
    // 2026-09-07T02:00Z é 06/09 às 23:00 em São Paulo (UTC−3). Um `toISOString()` ou um
    // `format()` do date-fns em runner UTC diriam "2026-09-07" — um dia a mais.
    expect(diaLocalSaoPaulo(new Date('2026-09-07T02:00:00Z'))).toBe('2026-09-06')
    // E a virada acontece às 03:00Z, não à meia-noite UTC.
    expect(diaLocalSaoPaulo(new Date('2026-09-07T03:00:00Z'))).toBe('2026-09-07')
  })

  it('devolve sempre AAAA-MM-DD com dois dígitos', () => {
    expect(diaLocalSaoPaulo(new Date('2026-01-05T15:00:00Z'))).toBe('2026-01-05')
  })

  /**
   * 124/`P-6` — este bloco travava `ehDiaPassado`: *"ontem sim, hoje NÃO, amanhã não"*.
   * Foi **reescrito afirmando a correção**, não apagado: a fronteira passou a ser
   * `<= hoje`, porque um chamado fechado hoje às 09h já tem indicador apurado e cadastrar
   * hoje como feriado às 15h o altera — dano idêntico ao do caso passado.
   *
   * ## Por que a asserção de HOJE é a que importa
   *
   * Este predicado é a **segunda** fonte de verdade sobre "o que é retroativo": a primeira
   * é `avisoRetroativo`, do servidor (`HolidayService.CalcularImpactoAsync`). Ele existe
   * porque a tela precisa decidir **sem rede** se há o que perguntar — data futura não
   * gera requisição nenhuma. Duas fontes só são seguras se coincidirem na fronteira, e é
   * exatamente a fronteira que estes asserts fixam: **hoje ⇒ `true`, hoje + 1 ⇒ `false`**.
   *
   * O que faz cada assert ficar vermelho:
   * - `hoje ⇒ true`: voltar a comparação para `iso < hoje` (o defeito que `P-6` corrige);
   * - `hoje + 1 ⇒ false`: afrouxar para `iso <= amanhã`, que pediria confirmação em data
   *   futura e faria a tela consultar impacto para dia que não tem chamado fechado.
   */
  it('ehDiaRetroativo: a fronteira é HOJE — ontem sim, HOJE SIM, hoje + 1 não', () => {
    const hoje = '2026-09-06'
    expect(ehDiaRetroativo('2026-09-05', hoje)).toBe(true)
    expect(ehDiaRetroativo('2026-09-06', hoje)).toBe(true)
    expect(ehDiaRetroativo('2026-09-07', hoje)).toBe(false)
  })

  it('ehDiaRetroativo: hoje + 1 é falso mesmo na virada do mês e do ano', () => {
    // Comparação lexicográfica: sem estes casos, um bug de "somar 1 ao dia" passaria.
    expect(ehDiaRetroativo('2026-10-01', '2026-09-30')).toBe(false)
    expect(ehDiaRetroativo('2026-09-30', '2026-09-30')).toBe(true)
    expect(ehDiaRetroativo('2027-01-01', '2026-12-31')).toBe(false)
    expect(ehDiaRetroativo('2026-12-31', '2026-12-31')).toBe(true)
  })

  it('ehDiaRetroativo ignora texto que não é data civil', () => {
    expect(ehDiaRetroativo('06/09/2026', '2026-09-06')).toBe(false)
    expect(ehDiaRetroativo('', '2026-09-06')).toBe(false)
  })

  it('ehDiaRetroativo: sem o 2º argumento, "hoje" é o dia de SÃO PAULO, não o do runner', () => {
    // 2026-09-07T02:00Z é 06/09 às 23:00 em SP. Um "hoje" tirado do UTC diria 07/09 e
    // trataria 07/09 como retroativo — pedindo confirmação para uma data FUTURA em SP.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T02:00:00Z'))
    try {
      expect(ehDiaRetroativo('2026-09-06')).toBe(true)
      expect(ehDiaRetroativo('2026-09-07')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('faixa aceita é hoje ±10 anos — o mesmo do HolidayService', () => {
    expect(faixaAceitaDeFeriado('2026-09-06')).toEqual({
      minimo: '2016-09-06',
      maximo: '2036-09-06',
    })
    expect(somarAnos('2026-02-29', -10)).toBe('2016-02-29')
  })

  it('dataPorExtenso é o que torna a ambiguidade DD/MM × MM/DD visível', () => {
    expect(dataPorExtenso('2026-04-03')).toBe('3 de abril de 2026')
    expect(dataPorExtenso('2026-03-04')).toBe('4 de março de 2026')
    expect(dataPorExtenso('2026-12-25')).toBe('25 de dezembro de 2026')
  })

  it('dataCurta formata para leitura brasileira sem passar por Date', () => {
    expect(dataCurta('2026-04-03')).toBe('03/04/2026')
    expect(dataCurta('texto')).toBe('texto')
  })
})
