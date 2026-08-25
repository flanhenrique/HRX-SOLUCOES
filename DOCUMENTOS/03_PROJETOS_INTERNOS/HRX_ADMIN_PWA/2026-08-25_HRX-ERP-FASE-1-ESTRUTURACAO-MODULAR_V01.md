# HRX Solutions — ERP Modular — Fase 1

**Documento:** Auditoria, arquitetura de rotas e relatório de implementação  
**Versão:** 1.0  
**Data:** 25/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch de trabalho:** `agent/erp-modular-routing-foundation`

## 1. Objetivo

Estruturar a fundação do HRX Admin para operar como ERP modular sem substituir a aplicação existente, sem criar um segundo shell administrativo e sem alterar regras de negócio, banco, RLS, MFA/AAL2 ou identidade visual.

A Fase 1 cobre arquitetura de módulos, URLs, roteamento, contratos entre shell e views, navegação desktop/mobile, deep linking, preparação para subrotas e regressão da estrutura existente.

## 2. Baseline auditada

Baseline inicial: `main @ 83a5330b4ea4fa43ae236262c6f8da7ec2cdd5e0`.

A cadeia autenticada encontrada está correta e deve permanecer intacta:

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

Os metadados de navegação estavam hardcoded em `AdminUnifiedRoot.tsx` através de um array local `navItems`, enquanto `adminNavigation.ts` mantinha separadamente:

- tipo `AdminDestination`;
- hashes por destino;
- aliases de hash;
- paths por destino.

Isso criava mais de uma fonte de verdade para módulo, rótulo, ícone, rota e posição de navegação.

### 3.2 Troca de views

As views eram importadas com `lazy()` diretamente em `AdminUnifiedRoot.tsx` e selecionadas por uma cadeia de `if/else` em `RouteContent`.

### 3.3 URL

`resolveAdminDestination()` conhecia pathnames como `/admin/clientes` e `/admin/financeiro`, porém `navigateAdmin()` não navegava para esses paths. Ele preservava o pathname corrente e adicionava hashes como `#admin/clientes`.

Consequência: a aplicação reconhecia paths diretos quando o documento conseguia carregar, mas a navegação interna não tratava o pathname como fonte canônica do estado.

### 3.4 Deep links no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` materializava documentos SPA somente para:

- `/admin/orcamentos`;
- `/admin/financeiro`.

As demais rotas conhecidas pelo TypeScript não possuíam `index.html` próprio no artifact do Pages. Um refresh ou acesso direto poderia retornar 404 antes da inicialização do React.

### 3.5 Mobile/PWA

O shell mobile/PWA já possui geometria consolidada em `admin-unified-shell.css`, fruto da correção estrutural do dock iOS. Essa geometria não faz parte da refatoração de rotas.

A composição lógica do dock, porém, estava divergente do modelo definido para o ERP:

**Antes:** Início · Orçamentos · Projetos · Docs · Perfil  
**Esperado:** Início · Orçamentos · Clientes · Financeiro · Mais

O menu `Mais` existia na topbar, em vez de ocupar a quinta posição do dock.

## 4. Problemas identificados

1. URL não era a fonte canônica da navegação interna.
2. Metadados dos módulos estavam distribuídos entre `AdminUnifiedRoot.tsx` e `adminNavigation.ts`.
3. Lazy imports e resolução de views estavam acoplados ao shell.
4. Testes existentes comprovavam presença de strings de rota, mas não impediam regressão para navegação por hash.
5. O artifact do GitHub Pages não oferecia entrada direta para todos os módulos.
6. O manifesto PWA iniciava em Orçamentos e o atalho de Painéis ainda utilizava hash.
7. A composição do dock não refletia o modelo definido para o ERP.
8. O nome visual `Projetos` divergia do módulo canônico `Painéis`.

## 5. Restrições preservadas

Esta fase não deve alterar:

- `AdminAuthRouter`;
- `AdminMfaGate`;
- MFA/TOTP/AAL2;
- Supabase/RLS;
- schema ou dados de produção;
- regras financeiras, fiscais ou comerciais;
- views de negócio além do contrato de montagem;
- identidade Liquid Glass;
- geometria do shell/dock homologada;
- service worker, salvo evidência técnica posterior de necessidade.

## 6. Arquitetura alvo

Será criado um registro canônico de módulos contendo, no mínimo:

- identificador interno compatível;
- pathname canônico;
- título e título curto;
- ícone;
- grupo de navegação;
- posição no desktop;
- posição no mobile (`primary` ou `more`);
- contrato de permissões preparado para evolução;
- componente lazy;
- aliases legados quando necessários.

O router, o shell, a sidebar, o dock, o menu Mais e os títulos globais passarão a consumir a mesma fonte.

## 7. Mapa de rotas alvo

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

A resolução por prefixo dos módulos deverá permitir evolução futura, por exemplo:

- `/admin/clientes/:clienteId`;
- `/admin/orcamentos/:orcamentoId`;
- `/admin/orcamentos/:orcamentoId/editar`;
- `/admin/financeiro/receber`;
- `/admin/financeiro/pagar`.

Essas subrotas não serão implementadas funcionalmente nesta fase.

## 8. Estratégia de compatibilidade

Os IDs internos atuais (`executive`, `quotes`, `clients`, `finance` etc.) serão preservados para evitar regressão nos módulos existentes.

Hashes legados `#admin/...` continuarão sendo reconhecidos como aliases de entrada durante a migração, mas serão canonicalizados para pathnames reais. Novas navegações não devem criar hashes.

## 9. Arquivos planejados

- `src/quotes/adminModules.ts` — novo registro canônico.
- `src/quotes/adminNavigation.ts` — resolução, History API e compatibilidade.
- `src/quotes/AdminUnifiedRoot.tsx` — consumo do registro e integração shell/view.
- `public/admin/manifest.webmanifest` — start URL e atalhos canônicos.
- `.github/workflows/deploy-pages.yml` — materialização das rotas diretas.
- testes estáticos e Playwright relacionados a arquitetura, rotas e dock.

Nenhuma alteração de CSS global está planejada.

## 10. Baseline de qualidade

A correção imediatamente anterior, PR #85, registrou os seguintes gates antes do merge que originou a baseline atual:

- `npm run test:pwa`: 77/77;
- `npm run build`: aprovado;
- `npm run test:browser`: 35/35.

O PR desta fase será usado para reexecutar os mesmos gates antes da integração e impedir regressão.

## 11. Resultado de implementação

_A preencher após a execução da Fase 1._

## 12. Testes finais

_A preencher após a execução da Fase 1._

## 13. Riscos e pendências para Fase 2

_A preencher após a execução da Fase 1._
