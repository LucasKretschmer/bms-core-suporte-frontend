/**
 * 125/FE-A11Y-1 (`F3`) — **a trava que impede a volta**: nenhum primitivo de UI
 * compartilhado (`src/components/ui/**`) pode renderizar texto abaixo do piso AA
 * (4,5:1).
 *
 * ## Por que ESTE recorte
 *
 * O defeito que originou a demanda 125 não foi uma tela errada: foi um **primitivo
 * compartilhado** errado. A mensagem do `EmptyState` renderizava a 1,84:1 e alcançava
 * 16 arquivos de uma vez — e passou por três unidades da demanda 124 porque cada tela
 * revisava a classe que **passava** ao componente, não a que o componente **renderiza**.
 * Contraste de tela é medido pelo teste de cada tela (125/FE-A11Y-2 fez isso para as
 * 35 ocorrências de `text-foreground/50`); o que faltava era a trava do **multiplicador**.
 *
 * ## Como cada exigência do despacho é cumprida
 *
 * 1. **Mede o que o elemento RENDERIZA.** A varredura parte da árvore montada por
 *    `render()` e lê a classe **do DOM**, subindo a herança de cor e de fundo como o
 *    navegador faz (`utils/contrasteDeTexto.ts`). Nenhuma asserção olha para a
 *    prop que o teste passou. O caso `EmptyState (className hostil)` prova a distinção:
 *    ele passa `className="text-primary/30"` ao wrapper e o resultado continua AA,
 *    porque a mensagem é renderizada **dentro** do componente.
 * 2. **Controle positivo, na mesma execução.** `describe('controle positivo')` obriga o
 *    medidor a REPROVAR os pares ruins documentados no PRD (1,84 · 3,04 · 2,95, e os
 *    valores HISTÓRICOS 3,00 e 2,83 escritos à mão) e a APROVAR os bons (5,47, e os
 *    pares 5,00 / 4,72 já corrigidos, lidos da cascata). Um medidor que morre — que
 *    passa a não medir nada e a devolver "0 reprovações" — deixa esse bloco vermelho.
 *    Os dois pares corrigidos por 125/FE-A11Y-3 aparecem nos DOIS lados de propósito:
 *    o valor velho, literal, prova detecção; o token, lido do CSS, prova a correção.
 * 3. **Campo do que foi pulado.** `varredura.pulados` é asserido como vazio em TODOS os
 *    casos. Foi assim que um medidor da 124 devolveu "0 reprovações" medindo 3 de 10
 *    textos: descartava em silêncio o que não entendia. Aqui, o que não é medido
 *    **reprova nomeando o texto e o motivo**.
 * 4. **`text-*` é namespace compartilhado no Tailwind v4.** Quem desambigua é o `TEMA`
 *    (`--text-card` = tamanho vs. `--color-card` = cor), derivado da cascata real; o
 *    bloco `controle positivo` trava o caso concreto (`text-card` num `<h2>` de modal
 *    **não** pode ser lido como "branco sobre branco").
 * 5. **Conjunto varrido DERIVADO, não mantido à mão.** O universo é lido do disco:
 *    todo `.tsx` sob `src/components/ui/**` que não seja teste. `CASOS` é comparado com
 *    ele por **identidade** (nos dois sentidos) — primitivo novo nasce DENTRO da
 *    varredura e reprova até ganhar caso de render; primitivo removido também reprova.
 * 6. **Allowlist nominal, item por item, com justificativa ao lado.** Duas listas, as
 *    duas por nome literal e com o motivo escrito: `SEM_TEXTO_PROPRIO` (arquivos que não
 *    renderizam texto por natureza) e `DEBITO_CONHECIDO` (reprovação medida que já
 *    existia e cuja correção está fora desta unidade). `DEBITO_CONHECIDO` é assertado por
 *    **identidade**: uma reprovação nova reprova o teste, e uma reprovação **corrigida**
 *    também — obrigando a remover a entrada em vez de deixar a dívida documentada para
 *    sempre.
 */

import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PISO_AA, comAlfa } from './contrasteDeTexto'
import { contrastRatio } from './colorContrast'
import { TEMA, TOKENS, razaoDoTexto, varrer } from '../test/medidor-de-contraste'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Combobox } from '../components/ui/Combobox'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { DataTable } from '../components/ui/DataTable/DataTable'
import type { ColumnDef } from '../components/ui/DataTable/types'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { ExternalLinkIcon } from '../components/ui/ExternalLinkIcon'
import { FullPageLoader } from '../components/ui/FullPageLoader'
import { InfoIcon } from '../components/ui/InfoIcon'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { MultiSelectCombobox } from '../components/ui/MultiSelectCombobox'
import { Pagination } from '../components/ui/Pagination'
import { Skeleton } from '../components/ui/Skeleton'
import { Switch } from '../components/ui/Switch'
import { Tabs } from '../components/ui/Tabs'
import { ToastProvider } from '../components/ui/Toast'

/** Diretório dos primitivos compartilhados — a fonte do universo varrido. */
const RAIZ_DOS_PRIMITIVOS = 'src/components/ui'

/**
 * As superfícies sobre as quais um primitivo aparece de fato. Não é lista de gosto:
 * `--color-card` é o fundo de card/modal e `--color-background` é o fundo da página
 * (`body`), e a mesma classe muda de veredicto entre as duas (`text-foreground/60`
 * mede 4,04:1 numa e 3,88:1 na outra). Os hexes vêm dos tokens, nunca digitados.
 */
const SUPERFICIES = ['bg-card', 'bg-background'] as const

/** Todo `.tsx` de produção sob `src/components/ui/**`, recursivo. */
function primitivosDoDisco(diretorio: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(resolve(process.cwd(), diretorio), { withFileTypes: true })) {
    const caminho = `${diretorio}/${entrada.name}`
    if (entrada.isDirectory()) {
      achados.push(...primitivosDoDisco(caminho))
      continue
    }
    if (entrada.name.endsWith('.tsx') && !entrada.name.includes('.test.')) achados.push(caminho)
  }
  return achados.sort()
}

const naoFaz = (): void => undefined

/**
 * Primitivos que **não renderizam texto próprio** — allowlist NOMINAL, com o motivo ao
 * lado. Cada entrada é uma afirmação verificável, e ela é verificada: o bloco
 * "sem texto próprio" renderiza cada um e exige que a varredura devolva **zero
 * medidas**. Se algum deles passar a renderizar texto, a entrada fica falsa e o teste
 * reprova — a lista não é uma isenção, é uma afirmação sob teste.
 */
const SEM_TEXTO_PROPRIO: Record<string, { motivo: string; elemento: React.ReactElement }> = {
  'src/components/ui/ExternalLinkIcon.tsx': {
    motivo:
      'SVG decorativo (`aria-hidden`), sem nó de texto — o significado vem do link que ' +
      'o acompanha. Contraste de TEXTO não se aplica (WCAG 1.4.3 fala de texto).',
    elemento: <ExternalLinkIcon />,
  },
  'src/components/ui/Skeleton.tsx': {
    motivo:
      'Barras de carregamento (`aria-busy`, cada barra `aria-hidden`), nenhum nó de ' +
      'texto — o rótulo "Carregando…" é `aria-label`, que leitor de tela lê e ninguém vê.',
    elemento: <Skeleton lines={2} />,
  },
  'src/components/ui/Switch.tsx': {
    motivo:
      'Renderiza só o trilho e o botão do interruptor; o rótulo vai em `aria-label` ' +
      '(`hideLabel` é `true` por padrão) e o texto visível, quando existe, é do call ' +
      'site — nenhum nó de texto nasce aqui.',
    elemento: <Switch checked label="Somente ativos" onChange={naoFaz} />,
  },
}

/** Colunas mínimas para o `DataTable` — o cabeçalho e as células são o texto medido. */
type LinhaDeTeste = { id: number; nome: string }
const COLUNAS_DE_TESTE: ColumnDef<LinhaDeTeste>[] = [
  {
    key: 'nome',
    header: 'Nome',
    accessor: (linha) => linha.nome,
    sortable: true,
    sortKey: 'nome',
    align: 'left',
    headerInfo: 'Nome do registro',
  },
  { key: 'id', header: 'ID', accessor: (linha) => linha.id, align: 'right' },
]

/**
 * Um caso de render. `abrir` roda depois da montagem, para os textos que só existem
 * depois de uma interação (tooltip, lista aberta) — sem isso o primitivo entraria na
 * varredura com zero texto e "passaria" sem ter sido medido.
 */
type CasoDeRender = { elemento: React.ReactElement; abrir?: (raiz: HTMLElement) => void }

/**
 * Os casos de render, por arquivo do universo. As chaves são comparadas por
 * **identidade** com o que existe no disco — primitivo novo sem caso reprova nomeando
 * o arquivo. Cada caso exercita os estados que PINTAM TEXTO (inclusive o de erro),
 * porque é neles que o contraste costuma cair.
 *
 * **Estado `disabled` fica de fora de propósito**: a WCAG 1.4.3 isenta explicitamente
 * componente de interface inativo. Medi-lo reprovaria o `Combobox` desabilitado
 * (2,10:1 — `text-muted` sob `opacity-50`) por um contraste que a norma não exige.
 */
const CASOS: Record<string, CasoDeRender[]> = {
  'src/components/ui/Badge.tsx': [
    { elemento: <Badge value="Concluído" /> },
    { elemento: <Badge value="Pausado" /> },
    { elemento: <Badge value="Cancelado" /> },
    { elemento: <Badge value="Em andamento" /> },
    { elemento: <Badge value="Descartado" /> },
    { elemento: <Badge value="Plano de Suporte" /> },
    { elemento: <Badge value="Faturado" /> },
    { elemento: <Badge value="Não faturado" /> },
    { elemento: <Badge value="Projeto" /> },
    { elemento: <Badge value="Ticket" /> },
    { elemento: <Badge value="Valor fora do mapa" /> },
    // 125/`Q-1` — estado visual NOVO: o fallback neutro sobre a superfície recuada, onde a
    // pílula inverte para `bg-card`. Entra na varredura permanente no MESMO commit que o
    // cria; as duas superfícies de `SUPERFICIES` já o medem nos dois fundos.
    { elemento: <Badge value="Valor fora do mapa" variante="recuada" /> },
  ],
  'src/components/ui/Button.tsx': [
    { elemento: <Button>Salvar</Button> },
    { elemento: <Button variant="secondary">Cancelar</Button> },
    { elemento: <Button variant="ghost">Fechar</Button> },
    { elemento: <Button variant="danger">Excluir</Button> },
    { elemento: <Button isLoading>Salvando</Button> },
  ],
  'src/components/ui/Combobox.tsx': [
    {
      elemento: (
        <Combobox
          id="cb"
          label="Cliente"
          value={null}
          options={[{ value: '1', label: 'Alfa' }]}
          onChange={naoFaz}
          placeholder="Selecione um cliente"
          required
        />
      ),
    },
    {
      elemento: (
        <Combobox
          id="cb-erro"
          label="Cliente"
          value="1"
          options={[{ value: '1', label: 'Alfa' }]}
          onChange={naoFaz}
          error="Selecione um cliente."
        />
      ),
    },
    {
      // Aberto: as opções da lista só existem depois do clique no gatilho.
      elemento: (
        <Combobox
          id="cb-aberto"
          label="Cliente"
          value={null}
          options={[
            { value: '1', label: 'Alfa' },
            { value: '2', label: 'Beta' },
          ]}
          onChange={naoFaz}
        />
      ),
      abrir: (raiz) => {
        const gatilho = raiz.querySelector('#cb-aberto')
        if (gatilho !== null) fireEvent.click(gatilho)
      },
    },
  ],
  'src/components/ui/ConfirmDialog.tsx': [
    {
      elemento: (
        <ConfirmDialog
          isOpen
          onClose={naoFaz}
          onConfirm={naoFaz}
          title="Excluir o plano?"
          description="Esta ação não pode ser desfeita."
        />
      ),
    },
    {
      elemento: (
        <ConfirmDialog
          isOpen
          onClose={naoFaz}
          onConfirm={naoFaz}
          variant="danger"
          title="Excluir o plano?"
          description="Esta ação não pode ser desfeita."
        />
      ),
    },
  ],
  'src/components/ui/DataTable/DataTable.tsx': [
    {
      elemento: (
        <DataTable
          tableId="trava-de-contraste"
          columns={COLUNAS_DE_TESTE}
          data={[
            { id: 1, nome: 'Alfa' },
            { id: 2, nome: 'Beta' },
          ]}
          sortState={{ sortBy: 'nome', sortDirection: 'asc' }}
          onSort={naoFaz}
        />
      ),
    },
    { elemento: <DataTable tableId="vazia" columns={COLUNAS_DE_TESTE} data={[]} /> },
  ],
  'src/components/ui/DataTable/SortableHeader.tsx': [
    {
      // Renderizado pelo `DataTable` (cabeçalho ordenável + `headerInfo`), que é como
      // ele aparece na app — não há call site que o monte sozinho.
      elemento: (
        <DataTable
          tableId="cabecalho"
          columns={COLUNAS_DE_TESTE}
          data={[{ id: 1, nome: 'Alfa' }]}
          sortState={{ sortBy: null, sortDirection: 'desc' }}
          onSort={naoFaz}
        />
      ),
    },
  ],
  'src/components/ui/EmptyState.tsx': [
    { elemento: <EmptyState message="Nenhum item encontrado." /> },
    {
      elemento: (
        <EmptyState
          message="Nenhum plano de suporte cadastrado."
          description="Cadastre os planos para definir as horas contratadas e a meta de 1º atendimento."
          action={{ label: 'Criar plano', onClick: naoFaz }}
          announce
        />
      ),
    },
    {
      // 🔴 O caso que prova a exigência 1 do cabeçalho: `className` HOSTIL, com a
      // própria classe de 1,84:1 que o design system usava. Ela cai no `<div>` de fora;
      // a mensagem é renderizada pelo componente e continua AA. Se alguém voltar a
      // delegar a mensagem ao `EmptyState` do DS, a classe do `<p>` interno vence e
      // este caso reprova.
      elemento: (
        <EmptyState
          className="text-primary/30"
          message="Mensagem com className hostil."
          description="Descrição com className hostil."
        >
          <p className="text-sm text-foreground">Conteúdo extra do call site.</p>
        </EmptyState>
      ),
    },
  ],
  'src/components/ui/ErrorState.tsx': [
    { elemento: <ErrorState /> },
    { elemento: <ErrorState message="Não foi possível carregar os planos." onRetry={naoFaz} /> },
  ],
  'src/components/ui/FullPageLoader.tsx': [{ elemento: <FullPageLoader /> }],
  'src/components/ui/InfoIcon.tsx': [
    {
      // O texto do tooltip só existe com foco — sem `abrir`, este primitivo entraria na
      // varredura sem nenhum texto medido.
      elemento: <InfoIcon tooltip="Explicação do indicador." />,
      abrir: (raiz) => {
        const botao = raiz.querySelector('button[aria-label="Explicação do indicador."]')
        if (botao !== null) fireEvent.focus(botao)
      },
    },
  ],
  'src/components/ui/Input.tsx': [
    { elemento: <Input id="in" label="Nome" placeholder="Digite o nome" required /> },
    { elemento: <Input id="in-erro" label="Nome" error="O nome é obrigatório." /> },
  ],
  'src/components/ui/Modal.tsx': [
    {
      elemento: (
        <Modal isOpen onClose={naoFaz} title="Editar plano de suporte">
          <p className="text-sm text-foreground">Conteúdo do modal.</p>
        </Modal>
      ),
    },
  ],
  'src/components/ui/MultiSelectCombobox.tsx': [
    {
      elemento: (
        <MultiSelectCombobox
          id="ms"
          label="Status"
          summaryLabel="Status"
          value={[]}
          options={[{ value: 'a', label: 'Ativo' }]}
          onChange={naoFaz}
          placeholder="Todos os status"
        />
      ),
    },
    {
      elemento: (
        <MultiSelectCombobox
          id="ms-erro"
          label="Status"
          value={['a']}
          options={[{ value: 'a', label: 'Ativo' }]}
          onChange={naoFaz}
          error="Não foi possível carregar os status."
        />
      ),
    },
  ],
  'src/components/ui/Pagination.tsx': [
    {
      elemento: (
        <Pagination
          page={2}
          pageSize={25}
          totalCount={120}
          totalPages={5}
          onPageChange={naoFaz}
          onPageSizeChange={naoFaz}
        />
      ),
    },
  ],
  'src/components/ui/Tabs.tsx': [
    {
      elemento: (
        <Tabs
          baseId="abas"
          label="Seções do relatório"
          value="a"
          onChange={naoFaz}
          items={[
            { id: 'a', label: 'Resumo' },
            { id: 'b', label: 'Detalhes' },
          ]}
        />
      ),
    },
  ],
  'src/components/ui/Toast.tsx': [
    {
      // O provider não pinta nada sozinho; o texto do toast tem teste próprio. Aqui
      // entra o conteúdo que ele embrulha, para que o arquivo esteja no universo e um
      // texto novo no provider passe a ser medido.
      elemento: (
        <ToastProvider>
          <p className="text-sm text-foreground">Aplicação embrulhada pelo provider.</p>
        </ToastProvider>
      ),
    },
  ],
  ...Object.fromEntries(
    Object.entries(SEM_TEXTO_PROPRIO).map(([arquivo, { elemento }]) => [arquivo, [{ elemento }]]),
  ),
}

/**
 * Reprovações que JÁ EXISTEM e cuja correção está fora do alcance de quem escreveu a
 * entrada — allowlist NOMINAL, uma linha por par, com o número medido e a
 * justificativa. Assertada por identidade: entra uma nova → vermelho; alguém corrige
 * uma → vermelho (obriga a remover daqui, em vez de a dívida virar documentação
 * eterna).
 *
 * 🔴 **Hoje ela está VAZIA, e isso é o ratchet funcionando.** A `125/FE-A11Y-1` abriu
 * duas entradas, as duas medidas no `Badge`:
 *
 * - `text-warning-fg` em "Pausado" = 3,00:1 (`--color-warning-fg` #e07600 sobre
 *   `--color-warning-bg` #fffbef) — o terceiro par da tabela do PRD 125 §1;
 * - `text-badge-origem-ticket-fg` em "Ticket" = 2,83:1 (#e07600 sobre #fff3e0) —
 *   achado novo desta própria trava, que ninguém tinha medido.
 *
 * A `125/FE-A11Y-3` escureceu os dois tokens para `#a85800` em `styles/global.css`
 * (5,00:1 e 4,72:1, medidos no DOM abaixo) e **removeu as duas entradas no mesmo
 * commit**. Manter uma entrada corrigida seria deixar a porta aberta: o `expect` de
 * identidade abaixo passa a aceitar aquela reprovação para sempre, e a próxima entra
 * de graça. Por isso o tipo continua aqui, o objeto continua vazio, e reintroduzir
 * qualquer entrada sem a reprovação correspondente **reprova** o teste
 * "toda dívida conhecida aponta para uma reprovação REAL", logo abaixo.
 */
const DEBITO_CONHECIDO: Record<string, string> = {}

/** Chave estável de uma reprovação, para comparação por identidade. */
function chaveDaReprovacao(arquivo: string, classe: string, texto: string, razao: number): string {
  return `${arquivo} :: ${classe} em "${texto}" = ${razao.toFixed(2)}:1`
}

const UNIVERSO = primitivosDoDisco(RAIZ_DOS_PRIMITIVOS)

/**
 * Varre um caso em todas as superfícies e devolve reprovações + pulados.
 *
 * A raiz da varredura é o `document.body`, **não** o container do `render`: `Modal`,
 * `ConfirmDialog` e o balão do `InfoIcon` saem por `createPortal` para fora do
 * container, e varrer só o container mediria **zero texto** neles — passando por
 * "sem reprovações" sem ter medido nada.
 */
function medirCaso(caso: CasoDeRender) {
  const reprovacoes: Array<{ classe: string; texto: string; razao: number }> = []
  const pulados: string[] = []
  let totalDeMedidas = 0

  for (const superficie of SUPERFICIES) {
    const { unmount } = render(<div className={superficie}>{caso.elemento}</div>)
    caso.abrir?.(document.body)
    const varredura = varrer(document.body)
    totalDeMedidas += varredura.medidas.length
    for (const pulo of varredura.pulados) pulados.push(`${pulo.motivo} — em "${pulo.texto}"`)
    for (const medida of varredura.medidas) {
      if (medida.razao < PISO_AA) {
        reprovacoes.push({ classe: medida.classe, texto: medida.texto, razao: medida.razao })
      }
    }
    unmount()
  }
  return { reprovacoes, pulados, totalDeMedidas }
}

describe('universo varrido — derivado do disco, nunca mantido à mão', () => {
  it('encontra os primitivos de UI no disco (varredura vazia passa em qualquer trava)', () => {
    expect(UNIVERSO.length).toBeGreaterThanOrEqual(10)
    expect(UNIVERSO).toContain('src/components/ui/EmptyState.tsx')
  })

  it('todo primitivo do disco tem caso de render — e todo caso existe no disco', () => {
    expect(new Set(Object.keys(CASOS))).toEqual(new Set(UNIVERSO))
  })

  it('toda entrada de `SEM_TEXTO_PROPRIO` está no universo e traz justificativa escrita', () => {
    for (const [arquivo, { motivo }] of Object.entries(SEM_TEXTO_PROPRIO)) {
      expect(UNIVERSO).toContain(arquivo)
      expect(motivo.length).toBeGreaterThan(40)
    }
  })
})

describe('piso AA (4,5:1) em todo texto renderizado pelos primitivos compartilhados', () => {
  for (const arquivo of UNIVERSO) {
    const casos = CASOS[arquivo] ?? []

    it(`${arquivo} — nenhum texto abaixo de ${PISO_AA}:1, nada pulado em silêncio`, () => {
      const reprovacoesMedidas: string[] = []
      const pulados: string[] = []
      let totalDeMedidas = 0

      for (const caso of casos) {
        const resultado = medirCaso(caso)
        totalDeMedidas += resultado.totalDeMedidas
        pulados.push(...resultado.pulados)
        for (const reprovacao of resultado.reprovacoes) {
          reprovacoesMedidas.push(
            chaveDaReprovacao(arquivo, reprovacao.classe, reprovacao.texto, reprovacao.razao),
          )
        }
      }

      // 3. O que o medidor não soube medir aparece — nunca some em silêncio.
      expect(pulados).toEqual([])

      // Alcance: um primitivo que renderiza texto tem de ter sido MEDIDO. Sem isto,
      // "zero reprovações" seria indistinguível de "não mediu nada".
      if (arquivo in SEM_TEXTO_PROPRIO) {
        expect(totalDeMedidas).toBe(0)
      } else {
        expect(totalDeMedidas).toBeGreaterThan(0)
      }

      // 6. Identidade contra a allowlist nominal: reprovação nova E dívida corrigida
      // deixam este assert vermelho.
      const conhecidasDoArquivo = Object.keys(DEBITO_CONHECIDO).filter((chave) =>
        chave.startsWith(`${arquivo} ::`),
      )
      expect(new Set(reprovacoesMedidas)).toEqual(new Set(conhecidasDoArquivo))
    })
  }

  it('toda dívida conhecida aponta para um arquivo do universo e traz justificativa', () => {
    for (const [chave, motivo] of Object.entries(DEBITO_CONHECIDO)) {
      const arquivo = chave.split(' :: ')[0]
      expect(UNIVERSO).toContain(arquivo)
      expect(motivo.length).toBeGreaterThan(80)
    }
  })

  // 125/FE-A11Y-3 — a trava DO RATCHET. Sem ela, `DEBITO_CONHECIDO` é uma porta:
  // basta escrever a chave de uma reprovação já corrigida para que ela volte a ser
  // aceita em silêncio, e a entrada seguinte entre de graça. Aqui cada entrada é
  // obrigada a corresponder a uma reprovação REALMENTE MEDIDA agora — dívida que não
  // se reproduz no DOM não pode continuar na lista.
  it('nenhuma entrada de `DEBITO_CONHECIDO` sobrevive à própria correção', () => {
    const medidasReais = new Set<string>()
    for (const arquivo of UNIVERSO) {
      for (const caso of CASOS[arquivo] ?? []) {
        for (const r of medirCaso(caso).reprovacoes) {
          medidasReais.add(chaveDaReprovacao(arquivo, r.classe, r.texto, r.razao))
        }
      }
    }
    const fantasmas = Object.keys(DEBITO_CONHECIDO).filter((c) => !medidasReais.has(c))
    expect(
      fantasmas,
      'Estas entradas de `DEBITO_CONHECIDO` não correspondem a nenhuma reprovação ' +
        'medida: ou o par foi CORRIGIDO (então remova a entrada — é o ratchet) ou a ' +
        'chave está errada (então ela não trava nada e aceita reprovação alheia).',
    ).toEqual([])

    // Companheira positiva NA MESMA EXECUÇÃO: uma entrada fabricada (dívida que não
    // existe mais) precisa ser DETECTADA por este mesmo filtro. Sem ela, `fantasmas`
    // vazio seria indistinguível de um filtro inerte — que é exatamente o estado em que
    // este teste ficaria se alguém trocasse o `!medidasReais.has(...)` por outra coisa.
    const allowlistFabricada = {
      ...DEBITO_CONHECIDO,
      'src/components/ui/Badge.tsx :: text-warning-fg em "Pausado" = 3.00:1':
        'A dívida que a 125/FE-A11Y-3 corrigiu, reintroduzida aqui de propósito.',
    }
    expect(Object.keys(allowlistFabricada).filter((c) => !medidasReais.has(c))).toEqual([
      'src/components/ui/Badge.tsx :: text-warning-fg em "Pausado" = 3.00:1',
    ])
  })
})

describe('controle positivo — o medidor é obrigado a reprovar o ruim e aprovar o bom', () => {
  /** Compõe um texto com opacidade sobre um fundo, como o navegador faz. */
  function razao(token: string, alfa: number, fundo: string): number {
    const hexFundo = TOKENS[`--color-${fundo}`]
    return contrastRatio(comAlfa(TOKENS[`--color-${token}`], hexFundo, alfa), hexFundo)
  }

  it.each([
    ['EmptyState do DS — text-primary/30 sobre o card', 'primary', 0.3, 'card', '1.84'],
    ['text-foreground/50 sobre o card', 'foreground', 0.5, 'card', '3.04'],
    ['text-foreground/50 sobre a página', 'foreground', 0.5, 'background', '2.95'],
  ])('REPROVA %s', (_nome, token, alfa, fundo, esperado) => {
    const medido = razao(token, alfa as number, fundo)
    expect(medido.toFixed(2)).toBe(esperado)
    expect(medido).toBeLessThan(PISO_AA)
  })

  // 125/FE-A11Y-3 — teste INVERTIDO (não apagado). Ele afirmava que
  // `text-warning-fg` sobre `bg-warning-bg` media 3,00:1 e REPROVAVA. O token foi
  // escurecido de #e07600 para #a85800 em `styles/global.css` e o par agora passa. O
  // par velho continua aqui como controle positivo, com o hex escrito à mão: é ele que
  // prova que o cálculo discrimina, e ele não pode vir da cascata (viraria verde junto).
  it('APROVA o par `text-warning-fg`/`bg-warning-bg` DEPOIS de corrigido (5,00:1)', () => {
    const medido = contrastRatio(TOKENS['--color-warning-fg'], TOKENS['--color-warning-bg'])
    expect(medido.toFixed(2)).toBe('5.00')
    expect(medido).toBeGreaterThanOrEqual(PISO_AA)

    // Companheira negativa com o valor HISTÓRICO: prova que o detector ainda reprova.
    const antigo = contrastRatio('#e07600', TOKENS['--color-warning-bg'])
    expect(antigo.toFixed(2)).toBe('3.00')
    expect(antigo).toBeLessThan(PISO_AA)
  })

  // 125/FE-A11Y-3 — o achado NOVO da própria trava (`P-2`), agora corrigido.
  it('APROVA `text-badge-origem-ticket-fg` DEPOIS de corrigido (4,72:1)', () => {
    const medido = contrastRatio(
      TOKENS['--color-badge-origem-ticket-fg'],
      TOKENS['--color-badge-origem-ticket-bg'],
    )
    expect(medido.toFixed(2)).toBe('4.72')
    expect(medido).toBeGreaterThanOrEqual(PISO_AA)

    // Companheira negativa: o valor histórico (#e07600) continua reprovando.
    const antigo = contrastRatio('#e07600', TOKENS['--color-badge-origem-ticket-bg'])
    expect(antigo.toFixed(2)).toBe('2.83')
    expect(antigo).toBeLessThan(PISO_AA)

    // O par IRMÃO "Projeto" foi remedido junto (a pendência exigia decidir os dois):
    // já passava, então NÃO foi alterado — os dois badges de origem atendem AA.
    const projeto = contrastRatio(
      TOKENS['--color-badge-origem-projeto-fg'],
      TOKENS['--color-badge-origem-projeto-bg'],
    )
    expect(projeto.toFixed(2)).toBe('7.81')
    expect(projeto).toBeGreaterThanOrEqual(PISO_AA)
  })

  it('APROVA `text-foreground/70` sobre o card (5,47:1) — o medidor não reprova tudo', () => {
    const medido = razao('foreground', 0.7, 'card')
    expect(medido.toFixed(2)).toBe('5.47')
    expect(medido).toBeGreaterThanOrEqual(PISO_AA)
  })

  it('mede o par ruim NO DOM, não só na aritmética — e o classifica como reprovação', () => {
    const { container } = render(
      <div className="bg-card">
        <p className="text-xs italic text-primary/30">mensagem quase invisível</p>
      </div>,
    )
    const varredura = varrer(container.firstElementChild as Element)
    expect(varredura.pulados).toEqual([])
    expect(razaoDoTexto(varredura.medidas, 'mensagem quase invisível').toFixed(2)).toBe('1.84')
  })

  it('`text-card` é TAMANHO de fonte, não cor — não vira "branco sobre branco"', () => {
    // Armadilha 2 do PRD: `text-*` é namespace compartilhado no Tailwind v4 e o DS usa os
    // dois lados (`--text-card` = 16px, `--color-card` = #ffffff). Uma versão anterior do
    // medidor acusava 1,00:1 em todo título de modal por causa disto.
    expect(TEMA.tamanhosDeTexto.has('card')).toBe(true)
    expect(TOKENS['--color-card']).toBe('#ffffff')

    const { container } = render(
      <div className="bg-card">
        <h2 className="text-card font-semibold">Título do modal</h2>
      </div>,
    )
    const varredura = varrer(container.firstElementChild as Element)
    expect(varredura.pulados).toEqual([])
    // Herda a cor do body (`--color-foreground`), não a cor "card".
    expect(razaoDoTexto(varredura.medidas, 'Título do modal')).toBeGreaterThanOrEqual(PISO_AA)
  })
})
