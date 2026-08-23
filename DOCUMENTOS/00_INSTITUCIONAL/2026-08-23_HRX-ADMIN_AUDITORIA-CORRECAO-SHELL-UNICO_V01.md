# HRX SOLUTIONS — AUDITORIA E CORREÇÃO DO HRX ADMIN
## Shell único, Desktop e PWA

**Versão:** 1.0  
**Data:** 23/08/2026  
**Área:** Administrativo / Arquitetura de Interface  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`

## 1. Motivo da reauditoria

A revisão visual do HRX Admin identificou comportamento incompatível com a arquitetura aprovada: uma nova experiência Liquid Glass havia sido montada sobre a aplicação administrativa anterior. O efeito não era apenas estético. Existiam shells completos concorrentes na mesma árvore React.

## 2. Causa raiz confirmada

O `AdminApp` montava simultaneamente componentes que possuíam chrome próprio de aplicação:

- `AdminQuotes` — sidebar, topbar, workspace e navegação mobile próprios;
- `AdminExperienceLayer` — sidebar, topbar, dashboard e navegação mobile próprios;
- páginas Fiscal e Suspensões como siblings permanentes;
- bridges auxiliares baseados em DOM/portal.

O CSS reforçava a colisão porque tanto o shell comercial quanto o Liquid Glass podiam controlar toda a viewport com posicionamento fullscreen.

O QA anterior também continha uma falha de contrato: testes verificavam a presença simultânea desses componentes no `AdminApp`, transformando a sobreposição em comportamento esperado e permitindo falso positivo no CI.

## 3. Correção aplicada

Foi criada uma única raiz administrativa canônica:

`AdminAuthRouter → AdminMfaGate → AdminApp → AdminUnifiedRoot`

O `AdminApp` não monta mais aplicativos completos em paralelo.

### Desktop

O `DesktopShell` é responsável exclusivamente por:

- sidebar principal;
- topbar;
- notificações;
- perfil;
- workspace administrativo.

### PWA / mobile

O `PwaShell` é uma experiência distinta e mutuamente exclusiva do Desktop, com:

- cabeçalho próprio;
- logo HRX;
- ações compactas;
- navegação inferior própria;
- menu secundário para áreas menos frequentes;
- safe areas de iOS;
- fluxo vertical sem sidebar desktop comprimida.

A seleção do shell é feita no limite mobile definido pela aplicação. Apenas um shell é montado por vez.

## 4. Módulos preservados

A refatoração não alterou banco de dados, autenticação ou regras comerciais. Foram preservados:

- Supabase Auth;
- MFA/AAL2;
- RLS;
- bucket privado `hrx-documents`;
- Orçamentos e Propostas Comerciais;
- geração/versionamento de PDF;
- Fiscal;
- Suspensões;
- Clientes;
- Central de Documentos;
- dados reais;
- regras de cálculo e aprovação.

Orçamentos, Fiscal e Suspensões passam a ser tratados como destinos/views dentro da raiz administrativa, e não como aplicativos fullscreen irmãos do shell principal.

## 5. Compatibilidade temporária controlada

Alguns módulos existentes ainda possuem markup de shell próprio em seus componentes históricos. Durante esta refatoração, esses elementos internos foram neutralizados dentro do workspace canônico para não controlar viewport, sidebar, topbar ou navegação principal.

Isso permite preservar a lógica comercial já homologada sem manter duas aplicações visíveis ou concorrentes. A regra arquitetural passa a ser: apenas `AdminUnifiedRoot` controla o chrome administrativo.

## 6. QA corrigido

Os testes foram alterados para proibir a regressão estrutural.

O novo contrato verifica:

- `AdminApp` monta somente `AdminUnifiedRoot`;
- não há `AdminQuotes`, `AdminFiscalPage`, `AdminSuspensionsPage` ou `AdminExperienceLayer` como siblings no `AdminApp`;
- Desktop e PWA possuem shells distintos;
- somente um shell é selecionado por vez;
- módulos comerciais são roteados como conteúdo;
- shells internos históricos ficam neutralizados no workspace;
- criação manual de orçamento continua disponível;
- Fiscal continua sincronizado;
- PWA mantém viewport, safe area e navegação adequada;
- autenticação, MFA, Storage e personalização continuam vinculados ao fluxo real.

## 7. Evidência de CI

**Pull Request:** #56 — `refactor(admin): elimina sobreposição e unifica shell Desktop/PWA`  
**Workflow:** `Validate HRX site`  
**Run:** #494  

Resultado do head funcional antes deste registro documental:

- `npm run test:pwa`: **PASS**;
- `npm run build`: **PASS**;
- instalação de dependências: **PASS**;
- vulnerabilidades reportadas pelo `npm install`: **0**.

O primeiro gate da refatoração encontrou três contratos de teste ainda vinculados à arquitetura antiga. Eles foram corrigidos antes da aprovação do run #494; nenhum bypass ou skip foi usado para obter o PASS.

## 8. Arquivos principais da correção

- `src/quotes/AdminUnifiedRoot.tsx`;
- `src/quotes/AdminApp.tsx`;
- `src/quotes/admin-unified-shell.css`;
- `src/quotes/admin-unified-chrome.css`;
- `tests/admin-architecture.test.mjs`;
- `tests/admin-experience.test.mjs`;
- `tests/admin-fiscal-sync.test.mjs`;
- `tests/admin-mobile-floating-nav.test.mjs`;
- `tests/admin-mobile-settings-shortcut.test.mjs`;
- `tests/admin-pwa-shell.test.mjs`;
- `tests/admin-responsive-personalization.test.mjs`;
- `tests/mobile-create-quote.test.mjs`.

## 9. Critério de conclusão

A correção estrutural é considerada pronta para integração quando o head final do PR, incluindo este documento, repetir com sucesso:

1. `test:pwa`;
2. build de produção.

A homologação visual autenticada em navegador real continua sendo uma etapa operacional separada. Ela não deve ser substituída por inspeção estática e depende de sessão administrativa real com MFA/AAL2 em navegador interativo.

## 10. Regra permanente de arquitetura

O HRX Admin não pode voltar a montar múltiplos shells administrativos simultaneamente.

**Desktop:** um `DesktopShell`.  
**PWA:** um `PwaShell`.  
**Regra:** exatamente um deles ativo por vez, compartilhando dados e regras de negócio sem compartilhar chrome concorrente.
