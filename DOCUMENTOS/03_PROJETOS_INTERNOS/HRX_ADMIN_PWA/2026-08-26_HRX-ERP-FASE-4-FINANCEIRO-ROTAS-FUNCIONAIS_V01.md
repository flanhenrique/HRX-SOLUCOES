# HRX Solutions — ERP Modular — Fase 4

**Documento:** Auditoria e implementação — Financeiro com rotas funcionais  
**Versão:** 1.0  
**Data:** 26/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch:** `agent/erp-functional-finance-routes`  
**PR:** `#90`  
**Baseline:** `main @ 8e1f7edfa8aa0f0106f27b1388351f6d99bff000`  
**Status:** implementação em validação; não integrada e não publicada.

## 1. Objetivo

Transformar os contratos estruturais de Financeiro criados na Fase 2 em navegação funcional, reutilizando integralmente as views e regras financeiras existentes.

Rotas-alvo:

- `/admin/financeiro/receber`;
- `/admin/financeiro/pagar`.

A Fase 4 não amplia o modelo financeiro, não cria telas paralelas e não altera ledger, backend, MFA/AAL2, RLS, migrations, RPCs, Edge Functions ou regras de faturamento/baixa.

## 2. Estado auditado

A Fase 2 já registrava:

- `finance-receivable` → `receber`;
- `finance-payable` → `pagar`.

Entretanto, `AdminFinancePage.tsx` mantinha a aba ativa apenas em estado local (`view`), com seis áreas internas:

- Aguardando faturamento;
- Contas a receber;
- Recebidos;
- Contas a pagar;
- Pagos;
- Fluxo de caixa.

Clicar em Contas a receber ou Contas a pagar não alterava o pathname e abrir diretamente as subrotas não selecionava a área correspondente.

`AdminFinanceScopedPage.tsx` também preservava o último escopo HRX/Pessoal em `sessionStorage`. Assim, uma preferência anterior por **Pessoal** podia prevalecer mesmo quando a URL solicitava `/admin/financeiro/receber` ou `/admin/financeiro/pagar`, violando a regra de URL como fonte de verdade.

## 3. Decisão arquitetural

### 3.1 Escopo empresarial obrigatório nas subrotas

As subrotas `/receber` e `/pagar` pertencem ao Financeiro empresarial da HRX. Enquanto uma delas estiver ativa, o escopo efetivo deve ser `business`, independentemente da preferência anteriormente persistida.

Ao escolher **Pessoal** a partir de uma dessas subrotas, o sistema deve primeiro retornar à raiz canônica `/admin/financeiro`, evitando associar uma URL empresarial à visão pessoal.

### 3.2 URL como fonte de verdade das duas áreas contratadas

`AdminFinancePage` passa a consumir `useAdminRoute()`:

- `finance-receivable` → `receivables`;
- `finance-payable` → `payables`.

Cliques nessas duas abas usam `buildAdminSubroutePath()` e `navigateAdminPath()`.

As demais áreas continuam internas nesta fase. Ao sair de `/receber` ou `/pagar` para uma dessas áreas, o pathname volta para `/admin/financeiro`.

### 3.3 Fluxos que concluem em receber/pagar

Os fluxos existentes que terminam nessas áreas também utilizam a mesma função de seleção/navegação:

- faturamento concluído → Contas a receber;
- baixa de recebível → Contas a receber;
- criação de despesa → Contas a pagar;
- baixa de despesa → Contas a pagar;
- cancelamento de despesa → Contas a pagar.

Nenhuma regra de negócio desses fluxos foi alterada.

## 4. Arquivos de produção alterados

- `src/quotes/AdminFinanceScopedPage.tsx`;
- `src/quotes/AdminFinancePage.tsx`.

Não foram alterados:

- `supabase/functions/finance-admin/index.ts`;
- migrations;
- RLS;
- RPCs;
- Edge Functions;
- `AdminAuthRouter`;
- `AdminMfaGate`;
- `AdminUnifiedRoot`;
- CSS do shell/dock;
- `AdminPersonalFinancePage.tsx`;
- cálculos, métricas, fluxo de caixa, baixa, comprovantes ou ledger.

## 5. Testes adicionados

### Estáticos

`tests/admin-finance-routes.test.mjs` protege:

- contratos `receber` e `pagar` no registro canônico;
- consumo de `useAdminRoute()`;
- navegação pelos helpers canônicos;
- precedência do escopo empresarial sobre preferência Pessoal;
- ausência de History API/router/shell local nas views.

### Navegador real

`tests/browser/admin-finance-routes.spec.ts` cobre:

1. deep link `/receber` → HRX Solutions + Contas a receber;
2. deep link `/pagar` com preferência Pessoal prévia → HRX Solutions + Contas a pagar;
3. clique receber ↔ pagar + back/forward;
4. troca para Pessoal a partir de subrota empresarial → raiz `/admin/financeiro` + visão Pessoal.

## 6. Critérios de aceite

- URL determina corretamente receber/pagar;
- deep links preservam query string;
- back/forward restaura a área correspondente;
- preferência Pessoal não sobrescreve subrota empresarial;
- Pessoal não permanece associado a `/receber` ou `/pagar`;
- um único shell administrativo permanece ativo;
- Financeiro Pessoal continua isolado;
- nenhum contrato financeiro de backend é alterado;
- testes estáticos, build e Playwright ficam verdes no head final.

## 7. Resultado da validação

_A preencher após conclusão dos gates oficiais do PR #90._

## 8. Gate de integração

Nenhum merge ou deploy deve ocorrer enquanto o head final do PR #90 não repetir com sucesso:

- `Validate HRX site`;
- `npm run test:pwa`;
- TypeScript/Vite build;
- `HRX Admin PWA Quality Gate`;
- Playwright completo.
