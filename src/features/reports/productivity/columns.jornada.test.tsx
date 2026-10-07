import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataTable } from '../../../components/ui/DataTable/DataTable'
import { productivityColumns } from './columns'
import { CLASSE_LINHA_ACIMA_DO_LIMITE } from './productivityFormat'
import type { ProductivityReportItemDto } from '../shared/types/reports'

const completo: ProductivityReportItemDto = {
  userId: 1,
  nome: 'João Silva',
  equipe: 'Equipe A',
  nAtendimentos: 42,
  totalSegundos: 7200,
  ahtSegundos: 600,
  mediaPausas: 1.5,
  ticketsAtendidos: 12,
  mediaTicketsUltimos3Meses: 10.5,
  mediaResolvidosPorDia: 1.25,
  mediaSegundosPorTicket: 1800,
  diasUteis: 5,
  horasUteisSegundos: 144000,
  mediaOciosoSegundosPorDia: 3600,
  extrapolouJornada: false,
}

function renderTabela(rows: ProductivityReportItemDto[]) {
  return render(
    <DataTable
      tableId="t"
      columns={productivityColumns}
      data={rows}
      rowClassName={(row) => (row.extrapolouJornada ? CLASSE_LINHA_ACIMA_DO_LIMITE : undefined)}
    />,
  )
}

describe('destaque de jornada extrapolada', () => {
  it('extrapolouJornada=true: linha com token de erro, texto e tooltip apontado x úteis', () => {
    renderTabela([{ ...completo, extrapolouJornada: true, totalSegundos: 180000 }])

    const selo = screen.getByText('Acima da jornada')
    expect(selo.closest('tr')).toHaveClass('bg-error-bg')
    expect(selo.closest('[title]')).toHaveAttribute('title', 'Apontado 50h 0m de 40h 0m úteis')
  })

  it('extrapolouJornada=false: sem destaque nem texto', () => {
    renderTabela([completo])

    expect(screen.queryByText('Acima da jornada')).not.toBeInTheDocument()
    expect(screen.getByText('João Silva').closest('tr')).not.toHaveClass('bg-error-bg')
  })
})
