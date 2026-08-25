# HRX Solutions — ERP Modular — Fase 2

**Documento:** Auditoria e relatório de implementação — Contexto de Rotas e Subrotas  
**Versão:** 1.0  
**Data:** 25/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch:** `agent/erp-route-context-subroutes`  
**PR:** `#87`  
**Baseline:** `main @ d6001ebb3169e33ed43dc8c14b9ed1dce75e2cd9`  
**Status:** implementação concluída na branch e gates automatizados aprovados; aguardando integração controlada.

## 1. Objetivo

Evoluir a fundação modular publicada na Fase 1 para um contrato real de subrotas, parâmetros, títulos e contexto de rota, sem implementar novas regras de negócio e sem criar um novo shell administrativo.

Esta Fase 2 pertence à iniciativa **HRX ERP** iniciada em 25/08/2026 e não altera a numeração histórica do roadmap mestre anterior.

## 2. Estado auditado

A Fase 1 estava integrada e publicada. A cadeia encontrada e preservada é:

```text
AdminAuthRouter
→ AdminMfaGate
→ AdminApp
→ AdminUnifiedRoot
→ DesktopShell OU PwaShell
→ main.hrx-unified-content
→ view ativa
```

`adminModules.ts` já era a fonte canônica dos dez módulos e `adminNavigation.ts` já utilizava pathname/History API. O resolver da Fase 1 tolerava qualquer pathname abaixo de um módulo por prefixo, mas sem semântica própria de subrota.

## 3. Lacunas encontradas

1. `resolveAdminModuleFromPath()` identificava apenas o módulo pai; não existia subrota nomeada nem extração de parâmetros.
2. `AdminUnifiedRoot` mantinha somente `AdminDestination`, perdendo metadados específicos do pathname atual.
3. `navigateAdmin()` navegava apenas para a raiz do módulo e não existia API canônica para detalhes/edições.
4. As views não recebiam contexto de rota; implementações futuras poderiam voltar a consultar `window.location` diretamente.
5. Título do documento e topbar derivavam apenas do módulo pai.
6. GitHub Pages materializava entradas físicas apenas para rotas administrativas conhecidas; deep links dinâmicos não possuíam documento físico correspondente.
7. O campo `permissions` existia no registro, porém todos os módulos utilizavam `[]` e não havia fonte autoritativa de papéis/capacidades por módulo.
8. O backend validava administrador HRX e AAL2 nas operações sensíveis, mas não expunha matriz granular de módulos. Filtrar módulos apenas no cliente seria segurança aparente.

## 4. Decisões arquiteturais

### 4.1 Subrotas como contrato estrutural

Foram registrados os padrões estruturais iniciais:

- `/admin/clientes/:clienteId`;
- `/admin/orcamentos/:orcamentoId`;
- `/admin/orcamentos/:orcamentoId/editar`;
- `/admin/financeiro/receber`;
- `/admin/financeiro/pagar`.

Esses padrões fornecem metadados e parâmetros. Eles **não criam novas telas de negócio** nesta fase. Enquanto uma view específica não existir, o componente do módulo pai permanece montado.

Subpaths não registrados continuam pertencendo ao módulo pai e preservam o pathname completo, mantendo compatibilidade com a fundação da Fase 1.

### 4.2 Contexto canônico

Foi criado `AdminRouteContext.tsx`, que disponibiliza à view ativa um `AdminResolvedRoute` com:

- módulo pai;
- pathname normalizado;
- subrota correspondente, quando registrada;
- parâmetros extraídos e decodificados;
- título atual;
- título curto;
- breadcrumbs semânticos.

Views futuras podem usar `useAdminRoute()` em vez de fazer parsing direto de `window.location`.

### 4.3 Navegação

`navigateAdmin(destination)` foi preservado para sidebar, dock, notificações e compatibilidade dos módulos existentes.

Foi adicionada `navigateAdminPath(pathname)`, que:

- aceita pathnames administrativos completos válidos;
- preserva query string;
- usa History API;
- mantém o módulo pai como destino de navegação global;
- registra o pathname no state do histórico;
- rejeita pathnames fora da árvore administrativa conhecida.

Também foi adicionado `onAdminRouteChange()`, que entrega a rota resolvida completa ao shell.

### 4.4 Resolução e construção de URLs

`adminModules.ts` passou a expor:

- `resolveAdminRouteFromPath()`;
- `buildAdminSubroutePath()`;
- tipos `AdminSubroute`, `AdminSubrouteId`, `AdminBreadcrumb` e `AdminResolvedRoute`.

O builder valida a existência da subrota, exige parâmetros obrigatórios e aplica `encodeURIComponent` aos valores dinâmicos.

### 4.5 Shell e títulos

`AdminUnifiedRoot` passou a manter a rota completa, não apenas o ID do módulo.

O componente ativo continua vindo do mesmo registro canônico:

```text
route.module.component
```

A view lazy é envolvida por `AdminRouteProvider`, dentro do mesmo `main.hrx-unified-content`.

O módulo pai continua controlando o estado ativo da sidebar/dock. Quando a subrota é registrada, topbar e `document.title` podem exibir seu título sem criar novo shell ou nova view paralela.

### 4.6 Deep links dinâmicos no GitHub Pages

As entradas explícitas das rotas principais foram preservadas.

O artifact do Pages também passa a gerar:

```text
dist/404.html
```

como fallback SPA derivado do build. Assim, um pathname administrativo dinâmico pode inicializar o React mesmo sem diretório físico específico.

O `404.html` permanece genérico; os metadados específicos do PWA continuam sendo injetados apenas nas entradas administrativas conhecidas.

### 4.7 Permissões

A Fase 2 **não implementou autorização granular somente no frontend**.

O contrato `permissions` permanece disponível no registro, mas não é usado para esconder ou liberar módulos. Qualquer enforcement futuro deverá possuir fonte autoritativa no backend e controles equivalentes em RLS, RPC ou Edge Functions conforme a operação.

Essa decisão evita criar uma falsa camada de segurança visual que poderia ser contornada por acesso direto à URL ou chamadas de API.

## 5. Arquivos alterados

### Produção/estrutura

- `src/quotes/adminModules.ts`
- `src/quotes/AdminRouteContext.tsx` — novo
- `src/quotes/adminNavigation.ts`
- `src/quotes/AdminUnifiedRoot.tsx`
- `.github/workflows/deploy-pages.yml`

### Testes

- `tests/admin-architecture.test.mjs`
- `tests/admin-canonical-routes.test.mjs`
- `tests/admin-subroutes.test.mjs` — novo
- `tests/admin-fiscal-sync.test.mjs`
- `tests/admin-personal-finance-isolation.test.mjs`
- `tests/admin-pwa-shell.test.mjs`
- `tests/browser/admin-real-app.spec.ts`

### Documentação

- `DOCUMENTOS/03_PROJETOS_INTERNOS/HRX_ADMIN_PWA/2026-08-25_HRX-ERP-FASE-2-CONTEXTO-ROTAS-SUBROTAS_V01.md`

Não foram alterados CSS do shell/dock, `AdminAuthRouter`, `AdminMfaGate`, banco, migrations, RLS, Edge Functions ou regras financeiras, fiscais e comerciais.

## 6. Compatibilidade preservada

- `AdminAuthRouter → AdminMfaGate → AdminApp → AdminUnifiedRoot` intacto;
- exatamente um shell administrativo ativo por viewport;
- sidebar/dock continuam navegando por `AdminDestination`;
- hashes legados continuam sendo aliases de entrada e são canonicalizados;
- query string é preservada;
- back/forward funciona com pathname completo;
- subpath desconhecido sob módulo conhecido continua montando o módulo pai;
- nenhuma view de negócio controla a própria ativação de rota;
- geometria mobile/PWA da Fase 1 não foi alterada.

## 7. Testes realizados

Gate aprovado no head de implementação `9af0fba83c7cc11bf9c822063d827c891bf13eb0`:

- `Validate HRX site`: **success**;
- `HRX Admin PWA Quality Gate`: **success**;
- `npm run test:pwa`: **86/86 aprovados, 0 falhas**;
- `npm run build`: **aprovado** (`tsc -b && vite build`);
- Vite: **128 módulos transformados**;
- `npm run test:browser`: **38/38 aprovados**;
- Playwright executado em aproximadamente 18,3 s;
- fixture canônico continua sem violações Axe `serious` ou `critical`;
- matriz mobile/tablet/desktop/landscape preservada.

### Cenários específicos comprovados

- `/admin/clientes/cliente-demo` mantém Clientes como módulo ativo, preserva a URL e exibe título de subrota `Cliente`;
- `/admin/orcamentos/ORC-DEMO/editar` mantém Orçamentos ativo e exibe `Editar orçamento`;
- back do navegador retorna à subrota anterior com título correto;
- `/admin/clientes/cliente-demo/historico`, ainda não registrada, permanece em Clientes sem inventar uma subrota semântica;
- troca entre views lazy não cria outro shell;
- dock mobile mantém a geometria homologada;
- fallback SPA do Pages é protegido por teste estático;
- permissões granulares client-only são explicitamente rejeitadas pelos testes desta fase.

## 8. Resultado da implementação

A Fase 2 de **Contexto de Rotas e Subrotas** foi concluída tecnicamente na branch de homologação.

O HRX ERP agora possui uma fundação capaz de diferenciar:

```text
módulo pai
≠
subrota registrada
≠
pathname desconhecido porém pertencente ao módulo
```

Isso prepara o sistema para telas futuras de detalhe/edição sem voltar a espalhar parsing de URL, títulos ou estados de navegação pelas views.

Esta fase não deve ser interpretada como implementação funcional das telas de Cliente 360°, detalhe de orçamento, editor por URL ou Contas a Receber/Pagar. Foram implementados os **contratos estruturais** que permitirão essas evoluções posteriores.

## 9. Riscos e próximas etapas

1. **Telas funcionais de subrota:** deverão consumir `useAdminRoute()` e os parâmetros já resolvidos, sem criar roteador interno.
2. **Breadcrumb visual:** os metadados já existem, mas a apresentação visual ainda não foi adicionada porque isso exigiria decisão de UX/layout.
3. **Permissões reais:** definir matriz de papéis/capacidades no backend antes de qualquer filtragem de navegação.
4. **Not found administrativo:** pathnames não registrados continuam no módulo pai por compatibilidade; uma fase futura poderá definir política explícita de 404 interno quando o catálogo de subrotas estiver maduro.
5. **Automação do artifact:** as rotas principais continuam materializadas explicitamente no workflow; o fallback resolve caminhos dinâmicos, mas o catálogo físico ainda pode ser automatizado futuramente.

## 10. Gate de integração

Estado ao concluir este relatório:

- branch: `agent/erp-route-context-subroutes`;
- PR: `#87`;
- implementação: concluída;
- testes estáticos: **86/86**;
- build: **aprovado**;
- Playwright: **38/38**;
- quality gate: **success**;
- produção: ainda não alterada por esta Fase 2;
- merge: ainda não realizado.

O commit final deste relatório deverá repetir os gates antes da integração para garantir que o head efetivamente mesclado seja o mesmo head documentado e validado.
