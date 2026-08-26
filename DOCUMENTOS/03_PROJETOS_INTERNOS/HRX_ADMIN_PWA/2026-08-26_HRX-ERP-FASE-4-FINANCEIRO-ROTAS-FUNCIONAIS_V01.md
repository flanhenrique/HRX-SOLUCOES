# HRX Solutions — ERP Modular — Fase 4

**Documento:** Auditoria e implementação — Financeiro com rotas funcionais  
**Versão:** 1.1  
**Data:** 26/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch:** `agent/erp-functional-finance-routes`  
**PR:** `#90`  
**Baseline:** `main @ 8e1f7edfa8aa0f0106f27b1388351f6d99bff000`  
**Status:** implementação estrutural concluída; integração e publicação bloqueadas pela ausência dos gates do GitHub Actions.

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

### 3.4 Builder de subrotas estáticas

A auditoria posterior à implementação encontrou uma falha de tipagem antes da integração: `buildAdminSubroutePath()` exigia o argumento `params` mesmo para padrões estáticos como `receber` e `pagar`.

As chamadas do Financeiro, portanto, não compilariam enquanto o terceiro argumento estivesse ausente.

A correção foi aplicada no contrato central:

```text
params: Record<string, string> = {}
```

Isso permite construir subrotas sem parâmetros dinâmicos e preserva a validação `admin_subroute_param_required` para padrões com `:clienteId`, `:orcamentoId` e outros parâmetros obrigatórios.

## 4. Arquivos de produção alterados

- `src/quotes/AdminFinanceScopedPage.tsx`;
- `src/quotes/AdminFinancePage.tsx`;
- `src/quotes/adminModules.ts` — ajuste compatível do builder para subrotas estáticas.

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
- builder de subrotas estáticas com parâmetros opcionais;
- manutenção do erro obrigatório para parâmetros dinâmicos;
- ausência de History API/router/shell local nas views.

### Navegador real

`tests/browser/admin-finance-routes.spec.ts` cobre:

1. deep link `/receber` → HRX Solutions + Contas a receber;
2. deep link `/pagar` com preferência Pessoal prévia → HRX Solutions + Contas a pagar;
3. clique receber ↔ pagar + back/forward;
4. troca para Pessoal a partir de subrota empresarial → raiz `/admin/financeiro` + visão Pessoal.

O inventário esperado, quando o gate voltar a executar, é de **93 testes estáticos** e **49 cenários Playwright**, considerando o baseline já integrado da Fase 3B e os novos casos desta fase. Esses números não devem ser tratados como aprovados até existir execução real.

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

### 7.1 Evidência disponível

- `main` permanece em `8e1f7edfa8aa0f0106f27b1388351f6d99bff000` durante esta fase;
- último GitHub Actions observado no repositório: `Validate HRX site` run `32973434960`, `main`, criado em `2026-08-26T13:18:39Z`, conclusão `success`;
- PR funcional `#90` não gerou run de `pull_request` ao abrir;
- novo commit no PR `#90` também não gerou run de `synchronize`;
- fechamento/reabertura do PR não gerou novo run;
- PR-gate temporário `#91`, apontando para o mesmo head, também não gerou run ao abrir ou sincronizar;
- workflow temporário com `on: push` criado somente na branch-gate também não gerou run;
- Vercel e Render conectados não possuem projeto/serviço HRX utilizável para substituir esse gate; apenas ambientes de outro projeto foram encontrados e não foram usados.

### 7.2 Correção encontrada pela auditoria manual

Antes de qualquer merge, a revisão do contrato detectou que as novas chamadas de `buildAdminSubroutePath()` para rotas estáticas não compilariam pela assinatura anterior. O builder foi corrigido e um teste estático específico foi adicionado.

Essa ocorrência reforça que **não é seguro integrar sem execução real do build e dos testes**.

### 7.3 Estado atual

Não existe evidência válida para declarar:

- `npm run test:pwa` aprovado;
- TypeScript/Vite build aprovado;
- Playwright aprovado;
- `HRX Admin PWA Quality Gate` aprovado.

Por isso a Fase 4 permanece fora da `main` e fora de produção.

## 8. Gate de integração

Nenhum merge ou deploy deve ocorrer enquanto o head final do PR #90 não repetir com sucesso:

- `Validate HRX site`;
- `npm run test:pwa`;
- TypeScript/Vite build;
- `HRX Admin PWA Quality Gate`;
- Playwright completo.

Assim que o GitHub Actions voltar a processar eventos do repositório, o PR deve ser sincronizado e os gates repetidos no head final antes de qualquer integração.
