import { describe, expect, it, vi } from 'vitest'
import {
  ESTADOS_DA_COMPETENCIA,
  ROTULO_DO_ESTADO,
  fonteDosNumerosDoEstado,
  motivoIndisponivel,
  normalizarEstado,
  type EstadoNormalizado,
} from './estadoDaCompetencia'

describe('ESTADOS_DA_COMPETENCIA — identidade do vocabulário do servidor', () => {
  it('é exatamente o enum do backend, nominalmente (não a contagem)', () => {
    // 🔴 `AP-API-002`. Cardinalidade passaria com um estado entrando e outro saindo — e o
    // que some em silêncio é sempre o que ninguém lembra (`Historica`, o C-6).
    // Fonte: `Suporte.Domain/Enums/EstadoCompetenciaValor.cs` + `analise-backend.md` §7.4.
    expect([...ESTADOS_DA_COMPETENCIA]).toEqual([
      'historica',
      'corrente',
      'futura',
      'aberta',
      'fechada',
      'reaberta',
      'refechada',
    ])
  })

  it('todo estado do conjunto tem rótulo, e o fail-closed também', () => {
    // Sem esta trava, um estado novo entraria na lista e a tela renderizaria `undefined`.
    for (const estado of ESTADOS_DA_COMPETENCIA) {
      expect(ROTULO_DO_ESTADO[estado]).toBeTruthy()
    }
    expect(ROTULO_DO_ESTADO.desconhecido).toBe('Estado não reconhecido')
  })
})

describe('normalizarEstado — fail-closed', () => {
  it('devolve o próprio valor para cada um dos sete', () => {
    for (const estado of ESTADOS_DA_COMPETENCIA) {
      expect(normalizarEstado(estado)).toBe(estado)
    }
  })

  it('`null` EXPLÍCITO e ausente caem em "desconhecido" — o guard é `== null`', () => {
    // 🔴 `AP-FRONTEND-028`: um teste só com `undefined` passaria também numa implementação
    // `=== undefined` e não discriminaria. O caso `null` é o que fica vermelho.
    expect(normalizarEstado(null)).toBe('desconhecido')
    expect(normalizarEstado(undefined)).toBe('desconhecido')
  })

  it('valor desconhecido do servidor NÃO vira um estado real', () => {
    // Vermelho se alguém trocar o ramo final por `'aberta'`/`'fechada'` "para a tela não
    // ficar vazia": seria afirmar o estado de um mês que decide fatura.
    const espiao = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(normalizarEstado('mosaico')).toBe('desconhecido')
    expect(normalizarEstado('')).toBe('desconhecido')
    expect(normalizarEstado(42)).toBe('desconhecido')
    expect(normalizarEstado({ estado: 'fechada' })).toBe('desconhecido')
    espiao.mockRestore()
  })

  it('tolera caixa e espaços — é o MESMO token, não outro valor', () => {
    // Cobre um `JsonStringEnumConverter` que serialize o nome do enum em PascalCase.
    expect(normalizarEstado('Historica')).toBe('historica')
    expect(normalizarEstado('  FECHADA ')).toBe('fechada')
  })
})

describe('fonteDosNumerosDoEstado (D12)', () => {
  it('só fechada e refechada usam snapshot; desconhecido não afirma nada', () => {
    // A tabela inteira, para que um estado novo não caia num `default` por acidente.
    const esperado: Record<EstadoNormalizado, string> = {
      historica: 'aovivo',
      corrente: 'aovivo',
      futura: 'aovivo',
      aberta: 'aovivo',
      reaberta: 'aovivo',
      fechada: 'snapshot',
      refechada: 'snapshot',
      desconhecido: 'desconhecida',
    }
    for (const [estado, fonte] of Object.entries(esperado)) {
      expect(fonteDosNumerosDoEstado(estado as EstadoNormalizado)).toBe(fonte)
    }
  })
})

describe('motivoIndisponivel — quais ações cada estado oferece', () => {
  /** `null` = disponível. A matriz inteira, escrita à mão, estado por estado. */
  const MATRIZ: Record<EstadoNormalizado, { fechar: boolean; reabrir: boolean; comparar: boolean }> =
    {
      // C-6: histórica não fecha retroativamente e não tem snapshot para comparar.
      historica: { fechar: false, reabrir: false, comparar: false },
      // 422 COMPETENCIA_NAO_ENCERRADA.
      corrente: { fechar: false, reabrir: false, comparar: false },
      futura: { fechar: false, reabrir: false, comparar: false },
      aberta: { fechar: true, reabrir: false, comparar: false },
      fechada: { fechar: false, reabrir: true, comparar: true },
      // Refechar é a MESMA rota `/close`, e é o que fecha o ciclo do C-8.
      reaberta: { fechar: true, reabrir: false, comparar: false },
      refechada: { fechar: false, reabrir: true, comparar: true },
      // Fail-closed: nenhuma ação sobre um estado que o painel não entende.
      desconhecido: { fechar: false, reabrir: false, comparar: false },
    }

  it('a disponibilidade bate com a matriz, ação por ação', () => {
    for (const [estado, esperado] of Object.entries(MATRIZ)) {
      const e = estado as EstadoNormalizado
      expect(motivoIndisponivel('fechar', e) === null, `fechar/${estado}`).toBe(esperado.fechar)
      expect(motivoIndisponivel('reabrir', e) === null, `reabrir/${estado}`).toBe(esperado.reabrir)
      expect(motivoIndisponivel('comparar', e) === null, `comparar/${estado}`).toBe(
        esperado.comparar,
      )
    }
  })

  it('toda indisponibilidade vem com motivo LEGÍVEL — nunca string vazia', () => {
    // Botão bloqueado sem motivo é o defeito clássico: o usuário não descobre o que fazer.
    for (const estado of Object.keys(MATRIZ) as EstadoNormalizado[]) {
      for (const acao of ['fechar', 'reabrir', 'comparar'] as const) {
        const motivo = motivoIndisponivel(acao, estado)
        if (motivo !== null) expect(motivo.length).toBeGreaterThan(20)
      }
    }
  })

  it('os motivos dizem a REGRA, não só "indisponível"', () => {
    // Literais escritos à mão: se alguém trocar por uma mensagem genérica, cai aqui.
    expect(motivoIndisponivel('fechar', 'corrente')).toContain('já encerrada')
    expect(motivoIndisponivel('fechar', 'historica')).toContain('congelamento')
    expect(motivoIndisponivel('reabrir', 'aberta')).toContain('fechada')
    expect(motivoIndisponivel('comparar', 'corrente')).toContain('snapshot')
    expect(motivoIndisponivel('comparar', 'desconhecido')).toContain('não reconhece')
  })
})
