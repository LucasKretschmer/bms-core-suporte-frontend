# suporte-frontend

Frontend do **Módulo Suporte** — Timer Migrate. Aplicação **standalone** (login próprio, sem iframe BMS Core), com design system próprio.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | React + Vite + TypeScript |
| Estilo | Tailwind CSS v4 (design system próprio) |
| Navegação | TanStack Router (file-based routing) |
| Dados/Cache | TanStack Query + Axios |
| Tabelas | TanStack Table |
| Formulários | React Hook Form + Zod |
| Gráficos | Recharts |
| Datas | date-fns |
| Testes | Vitest + Testing Library |

---

## Funcionalidades

- **Autenticação:** login próprio (e-mail/senha). Access token (JWT) mantido **em memória**; sessão persistida via **refresh token em cookie httpOnly** — ao recarregar (F5) a sessão é reidratada por `/auth/refresh`. Logout revoga a sessão no backend.
- **Dashboards** (Suporte e Onboarding): KPIs com drill-down, gráficos (movimentação, status, categoria, SLA, saúde dos planos), atualização ao vivo (SSE) e **modo apresentação** (painel fullscreen com rotação de equipes).
- **Relatórios:** Consumo de Planos, Apontamentos por Ticket, Relatório do Cliente (com PDF), Produtividade por Analista — com filtros, ordenação/paginação server-side e exportação CSV/Excel.
- **Drill-down de relatórios:** Consumo de Planos → tickets do cliente → **detalhe/logs do ticket** (cards de apontamento, timeline de trabalho/pausa) com breadcrumbs.
- **Apontamentos:** criar/editar/excluir apontamento manual (multi-bloco, cálculo de pausa).
- **Administração:** Categorias do Atendimento, Equipes e Atendentes, Configurações/Regras por equipe.
- **Sincronizador HubSpot:** tela de monitoramento (status, logs, disparo manual, manutenção de registros).

> Acesso a telas e ações é controlado por papel (Atendente/Coordenador/Gerente/Admin) — apenas como UX; o **backend é a fonte de verdade**.

---

## Estrutura

```
src/
├── components/ui/        # Primitivos (Button, Input, Modal, DataTable, Badge, ConfirmDialog...)
├── components/layout/    # Sidebar, Header, Breadcrumb, PageWrapper, AppLayout
├── features/             # Um módulo por domínio
│   ├── auth/             # Login
│   ├── dashboards/       # Suporte, Onboarding, painel, shared (KPIs/gráficos/SSE)
│   ├── reports/          # consumo-planos, apontamentos, cliente, produtividade
│   ├── client-tickets/   # Tickets de um cliente (drill-down)
│   ├── ticket-detail/    # Detalhe/logs do ticket + modal de apontamento
│   ├── service-categories/, teams/, business-rules/   # Administração
│   └── sincronizador/    # Monitoramento da integração HubSpot
├── routes/               # TanStack Router (file-based) — _auth (protegidas), login
├── contexts/             # AuthContext (sessão)
├── hooks/, services/, utils/, types/
├── router.ts, queryClient.ts
```

---

## Como rodar (dev local)

Requer o **backend** rodando (ver `bms-core-suporte-backend`) — por padrão em `http://localhost:5035`.

```bash
# 1. Variáveis de ambiente
cp .env.example .env        # ajuste VITE_API_URL se necessário

# 2. Instalar dependências
npm install

# 3. Subir o dev server (Vite)
npm run dev                 # http://localhost:5173
```

### Outros scripts

```bash
npm run build      # tsc -b && vite build
npm run lint       # ESLint
npm test           # Vitest (run)
npm run test:watch # Vitest (watch)
```

---

## Variáveis de ambiente

Copie `.env.example` para `.env`. Prefixo `VITE_` (são **públicas** — nunca colocar segredo).

| Variável | Descrição |
|----------|-----------|
| `VITE_API_URL` | URL base da API backend (dev: `http://localhost:5035`) |
| `VITE_APP_NAME` | Nome exibido da aplicação |

---

## Convenções

- Tipagem explícita — sem `any`.
- Toda área com dados assíncronos trata **loading / erro / vazio**.
- Instância Axios centralizada em `services/api.ts` (Bearer + refresh automático no 401).
- Token **nunca** em localStorage/sessionStorage (só preferências de UI são persistidas).
