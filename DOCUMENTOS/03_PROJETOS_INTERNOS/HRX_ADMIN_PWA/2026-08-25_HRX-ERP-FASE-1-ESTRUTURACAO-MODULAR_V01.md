# HRX Solutions — ERP Modular — Fase 1

**Documento:** Auditoria, arquitetura de rotas e relatório de implementação  
**Versão:** 1.0  
**Data:** 25/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch de trabalho:** `agent/erp-modular-routing-foundation`  
**PR de homologação:** `#86`  
**Status:** implementação concluída na branch; gates automatizados aprovados; sem merge/deploy em produção.

## 1. Objetivo

Estruturar a fundação do HRX Admin para operar como ERP modular sem substituir a aplicação existente, sem criar um segundo shell administrativo e sem alterar regras de negócio, banco, RLS, MFA/AAL2 ou identidade visual.

A Fase 1 cobre arquitetura de módulos, URLs, roteamento, contratos entre shell e views, navegação desktop/mobile, deep linking, preparação para subrotas e regressão da estrutura existente.

## 2. Baseline auditada

Baseline inicial: `main @ 83a5330b4ea4fa43ae236262c6f8da7ec2cdd5e0`.

A cadeia autenticada encontrada está correta e foi preservada:

```text
AdminAuthRouter
└── AdminMfaGate
    └── AdminApp
        └── AdminUnifiedRoot
            └── DesktopShell OU PwaShell
                └── main.hrx-unified-content
                    └── view ativa
```

O `AdminMfaGate` só libera os filhos quando a sessão alcança AAL2. `AdminApp` monta apenas `AdminUnifiedRoot`. `AdminUnifiedRoot` seleciona um único shell de acordo com a classe de viewport.

## 3. Arquitetura anterior

### 3.1 Registro de navegação

Os metadados de navegação estavam hardcoded em `AdminUnifiedRoot.tsx` através de um array local, enquanto `adminNavigation.ts` mantinha separadamente destinos, hashes, aliases e paths.

Isso criava mais de uma fonte de verdade para módulo, rótulo, ícone, rota e posição de navegação.

### 3.2 Troca de views

As views eram importadas com `lazy()` diretamente em `AdminUnifiedRoot.tsx` e selecionadas por lógica condicional centralizada.

Além disso, algumas views ainda mantinham um segundo estado de ativação interno (`open`/`onAdminNavigate`) e, em um caso, consultavam `window.location.hash`. Isso significava que o shell podia selecionar corretamente um módulo pela URL enquanto a própria view decidia não renderizar.

### 3.3 URL

`resolveAdminDestination()` conhecia pathnames como `/admin/clientes` e `/admin/financeiro`, porém `navigateAdmin()` não navegava para esses paths. Ele preservava o pathname corrente e adicionava hashes como `#admin/clientes`.

Consequência: a aplicação reconhecia paths diretos quando o documento conseguia carregar, mas a navegação interna não tratava o pathname como fonte canônica do estado.

### 3.4 Deep links no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` materializava documentos SPA somente para:

- `/admin/orcamentos`;
- `/admin/financeiro`.

As demais rotas conhecidas pelo TypeScript não possuíam `index.html` próprio no artifact do Pages. Um refresh ou acesso direto poderia retornar 404 antes da inicialização do React.

### 3.5 Mobile/PWA

O shell mobile/PWA já possuía geometria consolidada em `admin-unified-shell.css`, fruto da correção estrutural do dock iOS. Essa geometria foi preservada e não recebeu novos overrides nesta fase.

A composição lógica do dock, porém, estava divergente do modelo definido para o ERP:

**Antes:** Início · Orçamentos · Projetos · Docs · Perfil  
**Depois:** Início · Orçamentos · Clientes · Financeiro · Mais

O menu `Mais` passou a concentrar Painéis, Atividades, Fiscal, Documentos, Suspensões e Configurações.

## 4. Problemas identificados

1. URL não era a fonte canônica da navegação interna.
2. Metadados dos módulos estavam distribuídos entre `AdminUnifiedRoot.tsx` e `adminNavigation.ts`.
3. Lazy imports e resolução de views estavam acoplados ao shell.
4. Testes existentes comprovavam presença de strings de rota, mas não impediam regressão para navegação por hash.
5. O artifact do GitHub Pages não oferecia entrada direta para todos os módulos.
6. O manifesto PWA iniciava em Orçamentos e o atalho de Painéis ainda utilizava hash.
7. A composição do dock não refletia o modelo definido para o ERP.
8. O nome visual `Projetos` divergia do módulo canônico `Painéis`.
9. `AdminClientsPage` e `AdminFiscalPage` mantinham `open=false` e dependiam de evento de navegação, quebrando acesso direto/deep link mesmo quando o shell resolvia corretamente a URL.
10. `AdminExecutiveDashboard` ainda utilizava `window.location.hash`/`onAdminNavigate` para decidir se deveria aparecer.
11. `AdminSuspensionsPage` e `AdminDocumentsPage` mantinham resíduos da antiga API de ativação de rota.

## 5. Restrições preservadas

A Fase 1 não alterou:

- `AdminAuthRouter`;
- `AdminMfaGate`;
- MFA/TOTP/AAL2;
- Supabase/RLS;
- schema ou dados de produção;
- regras financeiras, fiscais ou comerciais;
- identidade Liquid Glass;
- geometria CSS homologada do shell/dock;
- service worker;
- dados de produção.

As alterações em views de negócio ficaram limitadas ao contrato estrutural de montagem/ativação por rota, removendo apenas o segundo estado de roteamento interno.

## 6. Arquitetura implementada

Foi criado `src/quotes/adminModules.ts` como registro canônico dos módulos administrativos.

Cada módulo passa a centralizar:

- identificador interno compatível;
- pathname canônico;
- título e título curto;
- ícone;
- grupo de navegação;
- ordem no desktop;
- posição no mobile (`primary` ou `more`);
- contrato de permissões preparado para evolução;
- componente lazy;
- aliases legados quando necessários.

O fluxo de navegação final ficou:

```text
pathname / hash legado de entrada
        ↓
adminNavigation.ts
        ↓
resolveAdminModuleFromPath()
        ↓
AdminUnifiedRoot
        ↓
DesktopShell OU PwaShell
        ↓
main.hrx-unified-content
        ↓
ActiveView lazy do módulo
```

O router, shell, sidebar, dock, menu Mais e títulos globais passam a consumir a mesma definição modular sempre que aplicável.

## 7. Mapa de rotas implementado

| Módulo | ID compatível | Rota canônica |
|---|---|---|
| Visão Geral | `executive` | `/admin` |
| Orçamentos | `quotes` | `/admin/orcamentos` |
| Clientes | `clients` | `/admin/clientes` |
| Financeiro | `finance` | `/admin/financeiro` |
| Fiscal | `fiscal` | `/admin/fiscal` |
| Suspensões | `suspensions` | `/admin/suspensoes` |
| Atividades | `activities` | `/admin/atividades` |
| Central de Documentos | `documents` | `/admin/documentos` |
| Painéis | `panels` | `/admin/paineis` |
| Configurações | `settings` | `/admin/configuracoes` |

A resolução por prefixo foi preparada e validada para permitir evolução futura, por exemplo:

- `/admin/clientes/:clienteId`;
- `/admin/orcamentos/:orcamentoId`;
- `/admin/orcamentos/:orcamentoId/editar`;
- `/admin/financeiro/receber`;
- `/admin/financeiro/pagar`.

Essas subrotas específicas ainda não possuem telas próprias nesta fase; a fundação apenas preserva o pathname e resolve o módulo pai.

## 8. Compatibilidade e histórico

Os IDs internos atuais (`executive`, `quotes`, `clients`, `finance` etc.) foram preservados para evitar regressão nos módulos existentes.

Hashes legados `#admin/...` continuam reconhecidos como aliases de entrada durante a migração, porém são canonicalizados para pathnames reais. Novas navegações não criam hashes.

A navegação utiliza History API e responde a `popstate`, permitindo:

- back/forward;
- refresh;
- URL compartilhável;
- acesso direto;
- PWA/deep links;
- preservação de query string onde aplicável.

## 9. Deep linking e PWA

O workflow do GitHub Pages passou a materializar entradas SPA para todas as rotas administrativas canônicas necessárias ao refresh e acesso direto.

O manifesto PWA passou a iniciar em `/admin/`, mantendo o mesmo `id` instalado para reduzir risco de o navegador interpretar a alteração como um novo aplicativo.

A geometria do dock iOS foi mantida. Nenhum novo CSS override foi adicionado para compensar roteamento ou shell incorreto.

## 10. Correções estruturais descobertas durante os testes

O primeiro Playwright pós-migração passou 35/37 testes. As duas falhas não eram seletores incorretos: expuseram um defeito estrutural real em Clientes.

`AdminClientsPage` era selecionada pelo router, mas retornava `null` porque mantinha `open=false` até receber `onAdminNavigate`. O mesmo padrão estava presente em Fiscal.

A correção foi ampliada para impedir recorrência:

- Clientes deixou de controlar a própria ativação de rota;
- Fiscal deixou de controlar a própria ativação de rota;
- Visão Geral deixou de consultar hash/estado `open` para decidir se renderiza;
- Suspensões teve estado/import residual de rota removido;
- Documentos teve dependência residual da antiga API removida;
- o teste de arquitetura agora falha se uma view interna voltar a usar `onAdminNavigate`, `window.location.hash` ou estado `open/setOpen` como controle de ativação.

O resultado é um contrato mais rígido: **quem decide qual módulo está ativo é o router/shell; a view não implementa um segundo router interno.**

## 11. Arquivos alterados

Arquivos de produção/estrutura:

- `.github/workflows/deploy-pages.yml`
- `public/admin/manifest.webmanifest`
- `src/quotes/adminModules.ts` — novo registro canônico
- `src/quotes/adminNavigation.ts`
- `src/quotes/AdminUnifiedRoot.tsx`
- `src/quotes/AdminClientsPage.tsx`
- `src/quotes/AdminFiscalPage.tsx`
- `src/quotes/AdminExecutiveDashboard.tsx`
- `src/quotes/AdminSuspensionsPage.tsx`
- `src/quotes/AdminDocumentsPage.tsx`

Testes atualizados/reforçados:

- `tests/admin-architecture.test.mjs`
- `tests/admin-canonical-routes.test.mjs`
- `tests/admin-experience.test.mjs`
- `tests/admin-finance.test.mjs`
- `tests/admin-fiscal-sync.test.mjs`
- `tests/admin-mobile-floating-nav.test.mjs`
- `tests/admin-mobile-settings-shortcut.test.mjs`
- `tests/admin-personal-finance-isolation.test.mjs`
- `tests/admin-pwa-shell.test.mjs`
- `tests/browser/admin-real-app.spec.ts`
- `tests/browser/admin-shell.spec.ts`

Documento desta atividade:

- `DOCUMENTOS/03_PROJETOS_INTERNOS/HRX_ADMIN_PWA/2026-08-25_HRX-ERP-FASE-1-ESTRUTURACAO-MODULAR_V01.md`

## 12. Baseline e testes finais

Baseline antes da Fase 1:

- `npm run test:pwa`: **77/77**;
- `npm run build`: **aprovado**;
- `npm run test:browser`: **35/35**.

Gate final da Fase 1 no head de implementação `43d5e026003eb861466864da0da81a16a24cec73`:

- `Validate HRX site`: **success**;
- `HRX Admin PWA Quality Gate`: **success**;
- `npm run test:pwa`: **79/79 aprovados, 0 falhas**;
- `npm run build`: **aprovado** (`tsc -b && vite build`);
- módulos lazy gerados individualmente no bundle;
- `npm run test:browser`: **37/37 aprovados**;
- acessibilidade do fixture canônico: sem violações serious/critical no teste Axe;
- testes de viewport cobrem phone, tablet, desktop e landscape;
- testes de PWA cobrem geometria do dock, safe area, modal, CSS lazy e troca de módulos;
- testes do aplicativo real cobrem pathname, query string, histórico, hash legado, deep link, subrota futura e unicidade do shell.

### Cenários estruturais comprovados

- `/admin` e módulos canônicos resolvem por pathname;
- hashes legados são canonicalizados;
- back/forward funciona via histórico do navegador;
- uma view lazy não cria segundo shell;
- views administrativas permanecem dentro de `hrx-unified-content`;
- subrota futura é resolvida pelo módulo pai sem colapsar o pathname;
- dock PWA mantém a geometria homologada após carregamento lazy;
- desktop e PWA compartilham o mesmo registro de módulos;
- nenhuma view de negócio controla sua própria ativação de rota.

## 13. Resultado da Fase 1

A fundação modular foi concluída na branch de homologação.

O HRX Admin permanece visualmente a mesma aplicação e mantém exatamente uma raiz administrativa autenticada e um shell ativo por viewport, porém agora possui:

- registro modular canônico;
- pathnames reais como fonte de verdade;
- deep links compatíveis com refresh;
- navegação desktop/mobile derivada da mesma fonte;
- componentes lazy desacoplados do shell;
- compatibilidade temporária com aliases antigos;
- suporte estrutural para subrotas futuras;
- proteção automatizada contra retorno a shells/routers internos nas views.

Não houve merge na `main` nem publicação em produção como parte desta fase de implementação/homologação.

## 14. Riscos e pendências para Fase 2

1. **Permissões por módulo:** o registro já possui campo/contrato preparado, mas a política fina de autorização por módulo deve ser definida e aplicada quando houver papéis diferentes de acesso.
2. **Subrotas reais:** a infraestrutura aceita prefixos, porém páginas de detalhe/edição ainda precisarão de resolução específica de parâmetros, estados de erro e breadcrumbs próprios.
3. **Breadcrumbs:** podem ser derivados do registro canônico quando a Fase 2 introduzir hierarquia interna de páginas.
4. **Depreciação dos hashes:** aliases legados devem permanecer durante a janela de migração e podem ser removidos somente após comprovação de que não existem atalhos/bookmarks dependentes deles.
5. **Rotas do Pages:** hoje a materialização é explícita no workflow. Em uma evolução posterior, pode ser gerada automaticamente a partir de metadados de build/registro para reduzir risco de drift.
6. **Títulos de subrotas:** o título global já deriva do módulo pai; detalhes específicos de entidades precisarão de metadados adicionais quando as subrotas forem implementadas.
7. **Homologação antes de produção:** apesar dos gates automatizados aprovados, o PR permanece draft e deve ser revisado antes de qualquer merge/deploy.

## 15. Gate de integração

Estado ao encerrar este relatório:

- Branch: `agent/erp-modular-routing-foundation`;
- PR: `#86`;
- implementação: concluída;
- testes automatizados: aprovados;
- produção: não alterada;
- merge: não realizado.

A integração na `main` deve ocorrer somente após a decisão explícita de publicação/homologação.
