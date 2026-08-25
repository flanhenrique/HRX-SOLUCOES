# HRX Solutions — ERP Modular — Fase 2

**Documento:** Auditoria e plano de implementação — Contexto de Rotas e Subrotas  
**Versão:** 1.0  
**Data:** 25/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch:** `agent/erp-route-context-subroutes`  
**Baseline:** `main @ d6001ebb3169e33ed43dc8c14b9ed1dce75e2cd9`

## 1. Objetivo

Evoluir a fundação modular publicada na Fase 1 para um contrato real de subrotas, parâmetros, títulos e contexto de rota, sem implementar novas regras de negócio e sem criar um novo shell administrativo.

Esta Fase 2 pertence à iniciativa **HRX ERP** iniciada em 25/08/2026 e não altera a numeração histórica do roadmap mestre anterior.

## 2. Estado auditado

A Fase 1 está integrada e publicada. A cadeia permanece:

```text
AdminAuthRouter
→ AdminMfaGate
→ AdminApp
→ AdminUnifiedRoot
→ DesktopShell OU PwaShell
→ main.hrx-unified-content
→ view ativa
```

`adminModules.ts` é a fonte canônica dos dez módulos e `adminNavigation.ts` usa pathname/History API. O resolver já tolera qualquer pathname abaixo de um módulo por prefixo.

## 3. Lacunas encontradas

1. `resolveAdminModuleFromPath()` identifica apenas o módulo pai; não existe subrota nomeada nem extração de parâmetros.
2. `AdminUnifiedRoot` mantém apenas `AdminDestination`, portanto perde metadados específicos do pathname atual.
3. `navigateAdmin()` navega apenas para a raiz do módulo e não existe API canônica para navegar para detalhes/edições.
4. As views não recebem contexto de rota. Uma implementação futura tenderia a consultar `window.location` diretamente, recriando acoplamento que a Fase 1 eliminou.
5. Título do documento e topbar derivam apenas do módulo pai.
6. GitHub Pages materializa entradas físicas apenas para rotas administrativas conhecidas. Deep links dinâmicos, como `/admin/clientes/:clienteId`, não possuem documento físico correspondente.
7. O campo `permissions` existe no registro, porém todos os módulos usam `[]` e não há fonte autoritativa de papéis/capacidades por módulo no frontend.
8. O backend atual valida administrador HRX e AAL2 nas operações sensíveis, mas não expõe ainda uma matriz granular de módulos. Filtrar módulos apenas no cliente seria segurança aparente, não autorização real.

## 4. Decisões arquiteturais

### 4.1 Subrotas como contrato estrutural

Serão registrados padrões estruturais iniciais:

- `/admin/clientes/:clienteId`;
- `/admin/orcamentos/:orcamentoId`;
- `/admin/orcamentos/:orcamentoId/editar`;
- `/admin/financeiro/receber`;
- `/admin/financeiro/pagar`.

Esses padrões fornecerão metadados e parâmetros. Eles **não** criarão novas telas de negócio nesta fase. Enquanto uma view específica não existir, o módulo pai continua sendo o componente montado.

### 4.2 Contexto canônico

Será criado um `AdminRouteContext` fornecendo à view ativa:

- módulo pai;
- pathname normalizado;
- subrota correspondente, quando houver;
- parâmetros extraídos;
- título atual;
- breadcrumbs semânticos.

Views futuras deverão consumir esse contexto em vez de consultar `window.location` para roteamento.

### 4.3 Navegação

`navigateAdmin(destination)` permanecerá compatível para sidebar/dock. Será adicionada navegação por pathname administrativo validado para links de detalhe e subrotas.

### 4.4 Deep links dinâmicos no Pages

As entradas explícitas das rotas principais serão preservadas. O artifact também receberá um `404.html` SPA derivado do build para permitir bootstrap do React quando o GitHub Pages receber um pathname administrativo dinâmico ainda sem diretório físico.

### 4.5 Permissões

A Fase 2 não ativará autorização granular baseada apenas no frontend. O contrato `permissions` permanece preparado, mas qualquer enforcement futuro deverá ser apoiado por fonte autoritativa no Supabase e controles equivalentes em RLS/RPC/Edge Functions.

## 5. Arquivos planejados

- `src/quotes/adminModules.ts`
- `src/quotes/AdminRouteContext.tsx` — novo
- `src/quotes/adminNavigation.ts`
- `src/quotes/AdminUnifiedRoot.tsx`
- `.github/workflows/deploy-pages.yml`
- `tests/admin-architecture.test.mjs`
- `tests/admin-canonical-routes.test.mjs`
- `tests/admin-subroutes.test.mjs` — novo
- `tests/browser/admin-real-app.spec.ts`
- este documento

Não estão planejadas alterações em CSS do shell/dock, autenticação, MFA, banco, migrations, RLS ou regras de negócio.

## 6. Critérios de aceite

- rotas principais mantêm comportamento visual atual;
- subrotas reconhecem parâmetros sem parsing local nas views;
- back/forward preserva pathname completo;
- título global acompanha metadados da rota;
- navegação primária continua marcando o módulo pai como ativo;
- deep link dinâmico consegue inicializar a SPA no Pages;
- nenhum segundo shell/router é criado;
- suíte estática, build e Playwright permanecem integralmente verdes.

## 7. Resultado da implementação

_A preencher após execução e validação._
