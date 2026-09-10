/**
 * 132/F4d — a normalização da fonte e os textos de D12.
 *
 * O que cada asserção existe para deixar VERMELHA:
 *
 *  1. `normalizarFonte` devolvendo `'aovivo'` no ramo desconhecido (o "conserto" natural) →
 *     os dois casos de fail-closed caem;
 *  2. um valor entrando e outro saindo de `FONTES_DO_CONSUMO` → a asserção de **identidade**
 *     cai (cardinalidade passaria, `rules/tests.md`);
 *  3. a precedência dos avisos invertida → o caso do aviso junto com `snapshot` cai;
 *  4. um texto de família afirmando algo verdadeiro só para um dos estados → os detectores de
 *     redação proibida caem, com controle positivo ao lado.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { FONTES_DO_CONSUMO } from '../shared/types/reports'
import {
  TEXTO_ANTERIOR_AO_CONGELAMENTO,
  TEXTO_CREDITO_ZERADO_NAO_MENSAL,
  TEXTO_PERIODO_PERSONALIZADO,
  derivarEstadoDoPeriodo,
  normalizarFonte,
  textoAoVivo,
  textoFechada,
  textoRefechada,
} from './fonteDoPeriodoTextos'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('FONTES_DO_CONSUMO — vocabulário do servidor', () => {
  it('é nominalmente `["snapshot","aovivo"]` — identidade, não cardinalidade', () => {
    // Cardinalidade (`length === 2`) passaria com um token entrando e outro saindo, e o
    // conjunto é o que dá poder a `normalizarFonte` (`rules/security.md`).
    expect([...FONTES_DO_CONSUMO]).toEqual(['snapshot', 'aovivo'])
  })
})

describe('normalizarFonte — fail-closed é `desconhecida`, nunca um dos dois', () => {
  it('os dois tokens conhecidos passam intactos', () => {
    expect(normalizarFonte('snapshot')).toBe('snapshot')
    expect(normalizarFonte('aovivo')).toBe('aovivo')
  })

  it('🔴 token DESCONHECIDO ⇒ `desconhecida` (nunca "aovivo")', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Tratar desconhecido como "ao vivo" afirmaria que o número é atual num mês que pode
    // estar congelado; como "snapshot", afirmaria que é o que foi cobrado. As duas são
    // afirmações sobre dinheiro feitas sem saber.
    expect(normalizarFonte('mosaico')).toBe('desconhecida')
    expect(normalizarFonte('')).toBe('desconhecida')
    expect(normalizarFonte('SNAPSHOT')).toBe('desconhecida')
    expect(erro).toHaveBeenCalled()
  })

  it('🔴 ausência e `null` ⇒ `desconhecida`, e SEM ruído no console', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Backend anterior à 132 é o caso NORMAL hoje (B11 não entregue): não é anomalia, e
    // logar aqui inundaria o console em todo carregamento da tela.
    expect(normalizarFonte(null)).toBe('desconhecida')
    expect(normalizarFonte(undefined)).toBe('desconhecida')
    expect(erro).not.toHaveBeenCalled()
  })
})

describe('derivarEstadoDoPeriodo — precedência declarada', () => {
  it('snapshot ⇒ fechada; aovivo ⇒ aovivo; sem fonte ⇒ desconhecida', () => {
    expect(derivarEstadoDoPeriodo({ fonte: 'snapshot' })).toBe('fechada')
    expect(derivarEstadoDoPeriodo({ fonte: 'aovivo' })).toBe('aovivo')
    expect(derivarEstadoDoPeriodo({})).toBe('desconhecida')
  })

  it('C-7: `avisoPeriodoNaoMensal` vence — é ele que explica o crédito zerado (D20)', () => {
    expect(
      derivarEstadoDoPeriodo({ fonte: 'aovivo', avisoPeriodoNaoMensal: true }),
    ).toBe('periodo-personalizado')
  })

  it('C-6: `avisoAnteriorAoCongelamento` vence sobre a fonte, e perde do não-mensal', () => {
    expect(
      derivarEstadoDoPeriodo({ fonte: 'aovivo', avisoAnteriorAoCongelamento: true }),
    ).toBe('anterior-ao-congelamento')
    // Os dois juntos: o não-mensal ganha, porque é o único que explica o crédito zerado.
    expect(
      derivarEstadoDoPeriodo({
        fonte: 'aovivo',
        avisoPeriodoNaoMensal: true,
        avisoAnteriorAoCongelamento: true,
      }),
    ).toBe('periodo-personalizado')
  })

  it('🔴 combinação IMPOSSÍVEL (snapshot + aviso): o aviso ganha, de propósito', () => {
    // C-7 força o modo ao vivo, logo o backend nunca deveria mandar isto. Se mandar, a tela
    // faz a afirmação MAIS FRACA (aviso) em vez de dizer "foi isto que foi faturado".
    expect(
      derivarEstadoDoPeriodo({ fonte: 'snapshot', avisoPeriodoNaoMensal: true }),
    ).toBe('periodo-personalizado')
  })

  it('`false` explícito nos avisos NÃO ativa o ramo (o guard é `=== true`)', () => {
    expect(
      derivarEstadoDoPeriodo({
        fonte: 'snapshot',
        avisoPeriodoNaoMensal: false,
        avisoAnteriorAoCongelamento: false,
      }),
    ).toBe('fechada')
  })
})

describe('os textos — literais escritos à mão e restrições de família', () => {
  it('C-7 é VERBATIM do despacho', () => {
    expect(TEXTO_PERIODO_PERSONALIZADO).toBe(
      'Período personalizado: números calculados ao vivo, podem divergir do que foi faturado.',
    )
  })

  it('D20: o aviso de período personalizado tem a frase que explica o crédito ZERADO', () => {
    // Sem ela, um recorte de 45 dias mostra o plano sem crédito e o usuário conclui que o
    // crédito desapareceu.
    expect(TEXTO_CREDITO_ZERADO_NAO_MENSAL).toContain('Crédito de horas não é considerado')
    expect(TEXTO_CREDITO_ZERADO_NAO_MENSAL).toContain('não é dividido')
  })

  it('C-6 diz que o número foi RECALCULADO pela regra atual', () => {
    expect(TEXTO_ANTERIOR_AO_CONGELAMENTO).toContain('recalculados pela regra atual')
    expect(TEXTO_ANTERIOR_AO_CONGELAMENTO).toContain('a fatura da época')
  })

  it('mês fechado afirma que o número NÃO muda com recálculo, e nomeia a data', () => {
    expect(textoFechada('Agosto 2026', '31/08/2026')).toBe(
      'Competência Agosto 2026 fechada em 31/08/2026. Os números abaixo são os que foram faturados — não mudam com recálculo.',
    )
    // Sem a data (o backend pode não a mandar) a frase continua gramatical.
    expect(textoFechada('Agosto 2026', null)).toBe(
      'Competência Agosto 2026 fechada. Os números abaixo são os que foram faturados — não mudam com recálculo.',
    )
  })

  it('🔴 AP-API-002: o texto de "ao vivo" é verdadeiro para os TRÊS estados que cobre', () => {
    const texto = textoAoVivo('Setembro 2026')

    // A positiva: o que é verdade para `Corrente`, `Aberta` e `Reaberta` — e para um quarto
    // estado que venha depois.
    expect(texto).toContain('em aberto')
    expect(texto).toContain('calculados agora')
    expect(texto).toContain('sujeitos a mudança')

    // As negativas: as duas redações que seriam FALSAS para `Reaberta` (que já foi fechada)
    // e para `Aberta` (que pode não ser o mês corrente).
    expect(texto).not.toMatch(/ainda não foi fechada/i)
    expect(texto).not.toMatch(/m[êe]s corrente/i)
    expect(texto).not.toMatch(/m[êe]s atual/i)
  })

  it('controle positivo: os detectores de redação de família funcionam', () => {
    // Sem isto, os `not.toMatch` acima seriam indistinguíveis de asserts sobre string vazia.
    const redacaoRuim = 'Competência do mês corrente: ainda não foi fechada.'
    expect(/ainda não foi fechada/i.test(redacaoRuim)).toBe(true)
    expect(/m[êe]s corrente/i.test(redacaoRuim)).toBe(true)
  })

  it('C-8: o refechamento fala de CONTAGEM de fechamentos, não de reabertura', () => {
    // `competenciaVersao > 1` significa "fechada mais de uma vez"; NÃO significa "está
    // reaberta agora" — o envelope não tem esse campo (incerteza declarada em §4.3).
    expect(textoRefechada(2)).toBe('Fechada 2 vezes — a última contagem é a que vale.')
    expect(textoRefechada(2)).not.toMatch(/reabert/i)
  })

  it('nenhum texto deste módulo cita a categoria interna do crédito (D15)', () => {
    const todos = [
      TEXTO_PERIODO_PERSONALIZADO,
      TEXTO_CREDITO_ZERADO_NAO_MENSAL,
      TEXTO_ANTERIOR_AO_CONGELAMENTO,
      textoFechada('Agosto 2026', '31/08/2026'),
      textoAoVivo('Setembro 2026'),
      textoRefechada(2),
    ]
    expect(todos.length).toBeGreaterThan(0)
    expect(todos.filter((t) => t.includes('Problema - Invoicy'))).toEqual([])
  })
})
