# HRX Solutions — ERP Modular — Fase 3

**Documento:** Auditoria e plano de implementação — Clientes e Orçamentos com rotas funcionais  
**Versão:** 1.0  
**Data:** 25/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch:** `agent/erp-functional-client-quote-routes`  
**Baseline:** `main @ 9e1d613424deb781e00863c9e3a960f3307f67ac`

## 1. Objetivo

Transformar os contratos de subrota criados na Fase 2 em navegação funcional para Clientes e Orçamentos, reutilizando integralmente as views e regras de negócio existentes.

Não serão criadas telas paralelas, novo shell, novo editor, novas tabelas, RPCs, migrations, RLS ou regras comerciais.

## 2. Estado auditado

### Clientes

`AdminClientsPage.tsx` já carrega:

- carteira de clientes;
- contatos e dados cadastrais;
- histórico de orçamentos vinculados;
- volume histórico;
- criação de cliente;
- criação de orçamento manual.

O detalhe já existe visualmente dentro da própria view, porém a seleção é controlada apenas por `selectedId` local. Clicar em um cliente não altera o pathname e abrir `/admin/clientes/:clienteId` não seleciona automaticamente o cadastro correspondente.

### Orçamentos

`AdminQuotes.tsx` já contém:

- lista de propostas;
- seleção por `selectedId` local;
- editor comercial completo;
- criação de proposta;
- salvamento, versionamento, PDF, compartilhamento, status e histórico;
- fluxo mobile de lista/detalhe.

A subrota `/admin/orcamentos/:orcamentoId` não controla a seleção atual. O editor existente deve ser reutilizado, não duplicado.

### Fundação de rotas

A Fase 2 já disponibiliza:

- `AdminRouteContext` e `useAdminRoute()`;
- `buildAdminSubroutePath()`;
- `navigateAdminPath()`;
- resolução de `client-detail`, `quote-detail` e `quote-edit`;
- fallback SPA para deep links dinâmicos no GitHub Pages.

## 3. Decisões arquiteturais

### 3.1 Cliente 360° sem nova tela

O detalhe existente em `AdminClientsPage` será transformado em view orientada por URL:

- `/admin/clientes` = carteira/lista;
- `/admin/clientes/:clienteId` = mesmo componente, com cliente selecionado pela rota;
- clique em cliente atualiza o pathname;
- botão voltar no mobile retorna a `/admin/clientes`;
- criação de cliente pode abrir o detalhe do novo cadastro;
- ID inválido gera estado de cliente não encontrado em vez de selecionar silenciosamente outro cadastro.

### 3.2 Orçamento sem segundo editor

O editor existente em `AdminQuotes` continuará sendo a única implementação:

- `/admin/orcamentos` = lista/seleção padrão;
- `/admin/orcamentos/:orcamentoId` = proposta selecionada pela URL;
- `/admin/orcamentos/:orcamentoId/editar` = mesma proposta e mesmo editor, com semântica de edição na rota;
- clique em proposta atualiza o pathname;
- criação de proposta abre o novo ID pela rota;
- retorno mobile volta para `/admin/orcamentos`.

### 3.3 Fonte de verdade

Quando uma subrota registrada estiver ativa, o parâmetro da URL terá precedência sobre `selectedId` local. Estado local continuará existindo apenas como suporte à view e compatibilidade da raiz do módulo.

## 4. Arquivos previstos

- `src/quotes/AdminClientsPage.tsx`
- `src/quotes/AdminQuotes.tsx`
- `tests/admin-subroutes.test.mjs`
- `tests/admin-canonical-routes.test.mjs`
- `tests/browser/admin-real-app.spec.ts`
- este documento

Não estão previstas alterações em CSS estrutural, autenticação, MFA, banco, migrations, RLS, Edge Functions, cálculo comercial, PDF ou financeiro.

## 5. Critérios de aceite

- deep link de cliente abre o cliente correspondente;
- clicar em cliente atualiza pathname sem reload;
- voltar à carteira restaura `/admin/clientes`;
- deep link de orçamento abre a proposta correspondente;
- clicar em proposta atualiza pathname sem reload;
- criação de cliente/orçamento navega para a entidade criada;
- IDs inexistentes não abrem outra entidade por fallback silencioso;
- back/forward do navegador restaura seleção;
- shell, dock e geometria PWA permanecem inalterados;
- testes estáticos, build e Playwright permanecem verdes.

## 6. Resultado da implementação

_A preencher após execução e validação._
