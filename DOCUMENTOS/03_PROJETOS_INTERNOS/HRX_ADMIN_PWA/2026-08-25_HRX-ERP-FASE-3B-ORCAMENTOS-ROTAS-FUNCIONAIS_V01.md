# HRX Solutions — ERP Modular — Fase 3B

**Documento:** Auditoria e plano de implementação — Orçamentos com rotas funcionais  
**Versão:** 1.0  
**Data:** 25/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch:** `agent/erp-functional-quote-routes`  
**Baseline:** `main @ 14b136ee552f44605a8282828515cc40eaea80f6`

## 1. Objetivo

Fazer as subrotas de Orçamentos criadas na Fase 2 controlarem a proposta aberta no editor comercial existente, sem criar outro editor e sem alterar regras de cálculo, autosave, PDF, compartilhamento, status, MFA ou persistência.

Rotas-alvo:

- `/admin/orcamentos`;
- `/admin/orcamentos/:orcamentoId`;
- `/admin/orcamentos/:orcamentoId/editar`.

## 2. Estado auditado

`AdminQuotes.tsx` concentra em um único arquivo:

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

A Fase 3A não alterou esse arquivo.

### Pontos exatos de acoplamento encontrados

1. `selectedId` inicia localmente como `null`.
2. `load()` restaura a seleção anterior ou seleciona a primeira proposta; não consulta a rota.
3. clique na fila executa diretamente `setSelectedId(request.id)` e `setMobileDetail(true)`.
4. botão voltar do editor apenas executa `setMobileDetail(false)`.
5. criação de orçamento seleciona o ID criado localmente, sem mudar o pathname.
6. exclusão recarrega a lista, mas não possui decisão explícita de navegação.
7. `QuoteEditor` já é a implementação única e deve permanecer assim.
8. propostas encerradas/suspensas já são tratadas como somente leitura pelo próprio editor.

## 3. Decisão arquitetural

A intervenção ficará restrita à camada de orquestração de `AdminQuotes`; o corpo do `QuoteEditor` não será reescrito.

### 3.1 Fonte de verdade

Quando `quote-detail` ou `quote-edit` estiver ativo, `route.params.orcamentoId` terá precedência sobre `selectedId`.

Na raiz `/admin/orcamentos`, a seleção local atual será preservada para manter o comportamento desktop existente.

### 3.2 Abertura de proposta

- proposta editável → `/admin/orcamentos/:orcamentoId/editar`;
- proposta encerrada ou suspensa → `/admin/orcamentos/:orcamentoId`.

A mesma instância de `QuoteEditor` será usada em ambos os casos. O editor já aplica somente leitura quando o estado comercial exige.

### 3.3 Criação, retorno e exclusão

- criação bem-sucedida navega para `quote-edit` do ID criado;
- voltar no mobile navega para `/admin/orcamentos`;
- exclusão de rascunho retorna para `/admin/orcamentos`;
- ID inexistente mostra estado explícito `Orçamento não encontrado` e não seleciona outra proposta silenciosamente.

### 3.4 Compatibilidade

- back/forward deve sincronizar a seleção;
- query string deve ser preservada pela API canônica de navegação;
- nenhum acesso direto a `window.location` ou History API será adicionado à view;
- nenhum router local será criado.

## 4. Arquivos previstos

- `src/quotes/AdminQuotes.tsx`
- `tests/admin-subroutes.test.mjs`
- novo teste Playwright específico de rotas de orçamento;
- este documento.

Não estão previstas alterações em CSS, banco, migrations, RLS, RPCs, Edge Functions, cálculo comercial, geração de PDF, MFA ou contratos financeiros.

## 5. Critérios de aceite

- deep link abre exatamente a proposta indicada;
- ID inexistente não abre outra proposta;
- clique em proposta atualiza pathname sem reload;
- editáveis usam `quote-edit` e encerradas/suspensas usam `quote-detail`;
- criação abre o ID criado em `quote-edit`;
- voltar retorna à raiz do módulo;
- back/forward restaura seleção;
- um único `QuoteEditor` continua existindo;
- shell/dock permanecem inalterados;
- testes estáticos, build e Playwright permanecem verdes.

## 6. Resultado

_A preencher após implementação e validação._
