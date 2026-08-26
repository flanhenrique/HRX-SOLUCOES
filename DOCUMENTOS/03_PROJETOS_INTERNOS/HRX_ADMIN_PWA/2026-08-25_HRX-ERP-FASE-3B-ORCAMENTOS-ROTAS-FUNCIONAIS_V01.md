# HRX Solutions — ERP Modular — Fase 3B

**Documento:** Relatório técnico — Orçamentos com rotas funcionais  
**Versão:** 1.1  
**Auditoria iniciada:** 25/08/2026  
**Implementação validada:** 26/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch:** `agent/erp-functional-quote-routes`  
**PR:** #89  
**Baseline:** `main @ 14b136ee552f44605a8282828515cc40eaea80f6`  
**Head funcional validado:** `a457aee733d064af82976a72e2bf139a68a8ac6d`

## 1. Objetivo

Fazer as subrotas de Orçamentos criadas na Fase 2 controlarem a proposta aberta no editor comercial existente, sem criar outro editor e sem alterar regras de cálculo, autosave, PDF, compartilhamento, status, MFA ou persistência.

Rotas funcionais:

- `/admin/orcamentos`;
- `/admin/orcamentos/:orcamentoId`;
- `/admin/orcamentos/:orcamentoId/editar`.

## 2. Estado auditado antes da alteração

`AdminQuotes.tsx` já concentrava em uma implementação única:

- autenticação da sessão do módulo;
- carga de propostas/clientes/regras comerciais;
- lista e filtros;
- `selectedId` local;
- modal de criação;
- editor completo;
- autosave;
- cálculos;
- versionamento e PDF;
- compartilhamento;
- transições de status;
- exclusão e duplicação;
- experiência mobile.

A Fase 3A não havia alterado esse arquivo.

### Pontos de acoplamento encontrados

1. `selectedId` iniciava localmente como `null`.
2. `load()` restaurava a seleção anterior ou selecionava a primeira proposta, sem consultar a rota.
3. clique na fila executava diretamente `setSelectedId(request.id)` e `setMobileDetail(true)`.
4. botão voltar do editor apenas executava `setMobileDetail(false)`.
5. criação selecionava o ID criado localmente, sem mudar o pathname.
6. exclusão recarregava a lista, sem decisão explícita de navegação.
7. `QuoteEditor` já era a implementação única e deveria permanecer assim.
8. propostas encerradas/suspensas já eram tratadas como somente leitura pelo próprio editor.

## 3. Implementação realizada

### 3.1 URL como fonte de verdade

`AdminQuotes` passou a consumir `AdminRouteContext`.

Quando `quote-detail` ou `quote-edit` está ativo, `route.params.orcamentoId` tem precedência sobre a seleção local.

Na raiz `/admin/orcamentos`, a seleção local continua preservada para manter o comportamento desktop existente.

### 3.2 Abertura canônica de proposta

Foi centralizada a regra já existente de somente leitura:

- proposta editável → `/admin/orcamentos/:orcamentoId/editar`;
- proposta encerrada ou suspensa → `/admin/orcamentos/:orcamentoId`.

Os estados de somente leitura permanecem os mesmos já usados pelo editor: `approved`, `invoiced`, `received`, `lost`, `cancelled` ou rascunho suspenso.

A mesma função agora orienta a escolha da rota e o `QuoteEditor`, evitando duas definições diferentes da mesma regra.

### 3.3 Deep links, histórico e ID inválido

- deep link seleciona exatamente o ID indicado pela URL;
- back/forward sincroniza rota e proposta selecionada;
- query string é preservada pela navegação canônica;
- ID inexistente mostra `Orçamento não encontrado`;
- ID inválido não seleciona silenciosamente a primeira proposta.

### 3.4 Criação, retorno e exclusão

- criação bem-sucedida navega para `/admin/orcamentos/:novoId/editar`;
- retorno do editor navega para `/admin/orcamentos`;
- exclusão de rascunho retorna para a raiz do módulo;
- nenhuma recarga completa da aplicação foi introduzida.

### 3.5 Editor único preservado

Não foi criado segundo editor, segunda página comercial ou router local.

`QuoteEditor` continua sendo a implementação única para:

- dados do cliente;
- itens;
- valores e descontos;
- impostos estimados;
- condições de pagamento;
- autosave;
- revisão;
- PDF e versionamento;
- compartilhamento;
- status comercial;
- histórico;
- duplicação e exclusão.

## 4. Escopo deliberadamente preservado

A Fase 3B não alterou:

- cadeia `AdminAuthRouter → AdminMfaGate → AdminApp → AdminUnifiedRoot`;
- MFA/AAL2;
- shell desktop ou PWA;
- dock mobile;
- CSS estrutural;
- banco de dados;
- migrations;
- RLS;
- RPCs;
- Edge Functions;
- cálculo comercial;
- regras de desconto;
- cálculo de imposto;
- parcelas;
- geração do PDF;
- armazenamento de documentos;
- compartilhamento;
- transições comerciais;
- contratos financeiros.

## 5. Regressões adicionadas

### Estáticos/arquitetura

Os testes passaram a validar explicitamente que:

- Orçamentos consome `useAdminRoute()`;
- `quote-detail` e `quote-edit` controlam a seleção;
- a view não registra `onAdminRouteChange`;
- a view não resolve rota globalmente;
- a view não acessa diretamente History API ou hashes para controlar ativação;
- comandos de navegação usam os helpers canônicos;
- continua existindo um único `QuoteEditor`.

### Navegador real

Foi criado `tests/browser/admin-quote-routes.spec.ts` cobrindo:

1. deep link de edição abrindo a proposta correta;
2. escolha entre rota de edição e detalhe conforme estado comercial;
3. back/forward restaurando a proposta;
4. ID inexistente sem fallback silencioso;
5. criação navegando para o novo rascunho;
6. exclusão retornando à lista canônica;
7. um único shell e um único editor.

## 6. Achados durante os gates

### 6.1 Contrato estático obsoleto

O primeiro gate rejeitou a importação do helper canônico `adminNavigation` apenas em `AdminQuotes`, embora Clientes — já homologado na Fase 3A — use o mesmo padrão.

O teste foi corrigido para proibir o que efetivamente caracteriza router local:

- listeners de mudança de rota na view;
- resolução global de rota dentro da view;
- acesso direto a pathname/hash;
- chamadas diretas de `history.pushState`/`replaceState`;
- shell/sidebar/dock próprios.

A emissão de navegação por helper canônico permanece permitida.

### 6.2 Hit-test do shell no novo teste de rotas

O primeiro Playwright de rota tentou clicar fisicamente em controles locais cobertos parcialmente pelo shell desktop legado. Os testes dedicados de geometria do shell continuaram verdes.

Como o objetivo desse arquivo é testar comportamento de rota e não duplicar testes de hit-testing/layout, os botões de navegação foram ativados semanticamente por teclado (`focus` + `Enter`). Isso executa o mesmo `onClick` React e mantém o teste acessível sem usar `force: true`.

### 6.3 Seletor ambíguo do modal

Após a correção anterior, restou um único erro de teste: `Título da proposta` correspondia ao campo do editor ao fundo e ao campo do modal de criação.

O teste foi restringido ao placeholder específico do modal. Nenhuma alteração de produção foi necessária.

## 7. Resultado dos gates no head funcional `a457aee733d064af82976a72e2bf139a68a8ac6d`

- `Validate HRX site`: **SUCCESS**;
- `npm run test:pwa`: **88/88 aprovados**;
- TypeScript + Vite production build: **SUCCESS**;
- Vite: **128 módulos transformados**;
- `HRX Admin PWA Quality Gate`: **SUCCESS**;
- Playwright: **45/45 aprovados**;
- matriz de shell, responsividade, PWA, iOS safe area e acessibilidade permaneceu aprovada.

## 8. Arquivos alterados na Fase 3B

- `src/quotes/AdminQuotes.tsx`;
- `tests/admin-architecture.test.mjs`;
- `tests/admin-canonical-routes.test.mjs`;
- `tests/admin-subroutes.test.mjs`;
- `tests/browser/admin-quote-routes.spec.ts`;
- este documento.

## 9. Resultado funcional

A Fase 3B conclui a transformação de Orçamentos para navegação orientada por URL sem substituir o fluxo comercial existente.

A aplicação agora diferencia de forma canônica:

- carteira/lista de propostas;
- detalhe de proposta somente leitura;
- edição de proposta ativa.

Deep links, histórico do navegador e criação/exclusão estão sincronizados com o pathname, e o editor comercial continua único.

## 10. Estado de integração

Implementação funcional concluída e gates automatizados aprovados no head funcional.

Este documento é o commit final de registro da branch e deve repetir os mesmos gates antes do merge.

Até esse último ciclo ficar verde:

- PR #89 permanece fora da `main`;
- nenhuma publicação de produção da Fase 3B deve ser considerada concluída.
