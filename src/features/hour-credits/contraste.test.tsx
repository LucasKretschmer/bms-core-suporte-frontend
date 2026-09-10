import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  classesDoTexto,
  fundoDoTexto,
  razaoDoTexto,
  reprovacoesAA,
  varrer,
} from '../../test/medidor-de-contraste'
import { PISO_AA } from '../../utils/contrasteDeTexto'
import { buildHourCreditColumns } from './columns'
import { CreditoStatusBadge } from './components/CreditoStatusBadge'
import type { HourCreditDto } from './types/hourCredit'

/**
 * 132/F5 — contraste das DUAS pílulas novas desta unidade, medido **no DOM renderizado**
 * contra o CSS real do app (`rules/frontend.md` § Contraste: "meça todo par antes de
 * entregar; nunca presuma que o par semântico do DS passa").
 *
 * ⚠️ `AP-FRONTEND-030`: `classesDoTexto`/`fundoDoTexto` devolvem `[]` **em silêncio**
 * quando não encontram o nó (o medidor trunca o texto procurado em 60 caracteres), e a
 * asserção passaria **por vacuidade**. Por isso cada bloco abaixo chama também
 * `razaoDoTexto`, que **lança** quando nada foi medido — é ela que transforma
 * "não encontrei" em vermelho. Os trechos são curtos de propósito.
 */

const linha: HourCreditDto = {
  id: 1,
  clientId: 42,
  clienteNome: 'Acme',
  horas: 2,
  competencia: '2026-09',
  status: 'estornado',
  origem: 'manual',
  motivoId: 3,
  motivoNome: 'Estorno de Credito Problema - Invoicy',
  criadoEm: '2026-09-08T12:00:00Z',
  divergenteDoSnapshot: true,
}

describe('contraste — pílula de status do crédito', () => {
  it('`Estornado` (text-error-fg sobre bg-error-bg) atende AA sobre o card', () => {
    const { container } = render(
      <div className="bg-card">
        <CreditoStatusBadge status="estornado" />
      </div>,
    )
    const { medidas, pulados } = varrer(container.firstElementChild as Element)

    // A companheira que LANÇA se o nó não for encontrado — sem ela, as duas asserções
    // seguintes mediriam zero elementos e concluiriam que está tudo certo.
    const razao = razaoDoTexto(medidas, 'Estornado')
    expect(razao).toBeGreaterThanOrEqual(PISO_AA)
    // Prova QUAL classe e QUAL fundo o DOM realmente renderizou (não o que se supôs).
    expect(classesDoTexto(medidas, 'Estornado')).toContain('text-error-fg')
    expect(fundoDoTexto(medidas, 'Estornado').length).toBeGreaterThan(0)
    expect(reprovacoesAA(medidas)).toEqual([])
    // Nada pode ter sido PULADO em silêncio: nó pulado é nó não medido.
    expect(pulados).toEqual([])
  })

  it('o fallback neutro do status desconhecido também atende AA', () => {
    const { container } = render(
      <div className="bg-card">
        <CreditoStatusBadge status="mosaico" />
      </div>,
    )
    const { medidas, pulados } = varrer(container.firstElementChild as Element)
    expect(razaoDoTexto(medidas, 'mosaico')).toBeGreaterThanOrEqual(PISO_AA)
    expect(reprovacoesAA(medidas)).toEqual([])
    // Nada pode ter sido PULADO em silêncio: nó pulado é nó não medido.
    expect(pulados).toEqual([])
  })
})

describe('contraste — pílula "Divergente" (C-8)', () => {
  it('text-warning-fg sobre bg-warning-bg atende AA sobre o card', () => {
    // O par `warning` já reprovou AA neste repo (3,00:1, `AP-FRONTEND-018`) e só passou a
    // atender depois de o token ser escurecido para #a85800 na 125. Reusar o par sem medir
    // é exatamente o erro registrado — por isso a medição fica aqui, e não na confiança.
    const coluna = buildHourCreditColumns({ onEdit: vi.fn(), onDelete: vi.fn() }).find(
      (c) => c.key === 'divergente',
    )
    if (!coluna) throw new Error('coluna "divergente" não existe')

    const { container } = render(<div className="bg-card">{coluna.accessor(linha)}</div>)
    const { medidas, pulados } = varrer(container.firstElementChild as Element)

    expect(razaoDoTexto(medidas, 'Divergente')).toBeGreaterThanOrEqual(PISO_AA)
    expect(classesDoTexto(medidas, 'Divergente')).toContain('text-warning-fg')
    expect(reprovacoesAA(medidas)).toEqual([])
    // Nada pode ter sido PULADO em silêncio: nó pulado é nó não medido.
    expect(pulados).toEqual([])
  })
})
