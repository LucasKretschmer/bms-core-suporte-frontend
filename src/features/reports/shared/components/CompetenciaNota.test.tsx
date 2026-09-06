/**
 * 123/FAT-1 — `CompetenciaNota`, a nota que declara por qual data a tela de fatura recorta.
 *
 * O que deixa cada asserção VERMELHA:
 *  · `incluiProjeto` deixar de ser condicional → a tela de Consumo por Ticket (que não
 *    mistura projeto) passaria a afirmar uma exceção que não se aplica a ela;
 *  · a frase de período deixar de reagir às props → volta o defeito de fundo (a tela não
 *    diz qual recorte está aplicado AGORA);
 *  · a nota virar `<div>` sem rótulo → some do modo de leitura por landmarks/rotor, e é
 *    justamente o bloco explicativo que o usuário precisa achar.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompetenciaNota } from './CompetenciaNota'
import {
  TEXTO_COMPETENCIA_PROJETO,
  TEXTO_COMPETENCIA_REGRA,
  TEXTO_COMPETENCIA_SEM_CONCLUSAO,
  TEXTO_COMPETENCIA_TITULO,
  TEXTO_COMPETENCIA_VS_SAUDE_PLANOS,
} from '../utils/competenciaTexts'

describe('CompetenciaNota', () => {
  it('declara a regra, a consequência e o destino das horas ainda em aberto', () => {
    render(<CompetenciaNota from="2026-07-01" to="2026-07-31" />)

    expect(screen.getByText(TEXTO_COMPETENCIA_REGRA)).toBeInTheDocument()
    expect(screen.getByText(TEXTO_COMPETENCIA_SEM_CONCLUSAO)).toBeInTheDocument()
    expect(
      screen.getByText('Mostrando os chamados concluídos entre 01/07/2026 e 31/07/2026.'),
    ).toBeInTheDocument()
  })

  it('a frase de período reage às props (não é literal fixo)', () => {
    // Datas diferentes, frase diferente: um texto hardcoded passaria no teste acima e
    // cairia aqui.
    render(<CompetenciaNota from="2026-08-01" to="2026-08-31" />)
    expect(
      screen.getByText('Mostrando os chamados concluídos entre 01/08/2026 e 31/08/2026.'),
    ).toBeInTheDocument()
  })

  it('sem `incluiProjeto`, NÃO afirma a exceção de projeto', () => {
    render(<CompetenciaNota from="2026-07-01" to="2026-07-31" />)
    // Companheira positiva obrigatória: a nota está renderizada de verdade. Sem ela,
    // "não vejo o texto de projeto" seria satisfeito por um componente que não rendeu nada.
    expect(screen.getByText(TEXTO_COMPETENCIA_REGRA)).toBeInTheDocument()
    expect(screen.queryByText(TEXTO_COMPETENCIA_PROJETO)).not.toBeInTheDocument()
  })

  it('com `incluiProjeto`, afirma a exceção de projeto', () => {
    render(<CompetenciaNota from="2026-07-01" to="2026-07-31" incluiProjeto />)
    expect(screen.getByText(TEXTO_COMPETENCIA_PROJETO)).toBeInTheDocument()
  })

  it('sem `comparaSaudePlanos`, NÃO fala do gráfico do painel (123/D-14)', () => {
    render(<CompetenciaNota from="2026-07-01" to="2026-07-31" />)
    // Companheira positiva: a nota rendeu de verdade — asserção negativa sozinha é
    // satisfeita pelo vazio.
    expect(screen.getByText(TEXTO_COMPETENCIA_REGRA)).toBeInTheDocument()
    // O Relatório do Cliente não tem contraparte no painel; a frase ali seria ruído.
    expect(screen.queryByText(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS)).not.toBeInTheDocument()
  })

  it('com `comparaSaudePlanos`, explica por que o gráfico do painel mostra outro número', () => {
    render(<CompetenciaNota from="2026-07-01" to="2026-07-31" comparaSaudePlanos />)
    expect(screen.getByText(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS)).toBeInTheDocument()
  })

  it('as duas condicionais são INDEPENDENTES entre si', () => {
    // Vermelho se alguém amarrar `comparaSaudePlanos` a `incluiProjeto` (as duas telas que
    // recebem uma não são as mesmas que recebem a outra).
    render(<CompetenciaNota from="2026-07-01" to="2026-07-31" incluiProjeto />)
    expect(screen.getByText(TEXTO_COMPETENCIA_PROJETO)).toBeInTheDocument()
    expect(screen.queryByText(TEXTO_COMPETENCIA_VS_SAUDE_PLANOS)).not.toBeInTheDocument()
  })

  it('é uma região nomeada e não interativa (a11y)', () => {
    const { container } = render(<CompetenciaNota from={null} to={null} />)

    // `<section aria-label>` = landmark `region`: o bloco é alcançável pelo rotor.
    expect(screen.getByRole('region', { name: TEXTO_COMPETENCIA_TITULO })).toBeInTheDocument()
    // Informativa: nada aqui recebe foco nem abre nada — se um controle for acrescentado,
    // ele precisa entrar na travessia de Tab, e este assert obriga a decisão.
    expect(container.querySelectorAll('button, a, input, [tabindex]')).toHaveLength(0)
  })
})
