# HRX ADMIN PWA — Correção de usabilidade do Financeiro Pessoal

**Data:** 25/08/2026  
**Versão:** 1.0  
**Escopo:** Financeiro > Pessoal > PWA mobile

## Problema observado

No iPhone, a visão de contas pessoais apresentava baixa legibilidade e a ação de criação de nova despesa podia sair da área útil. A navegação inferior flutuante também competia com o conteúdo financeiro, especialmente nos últimos cartões e ações.

## Correções implementadas

- CTA `+ Nova conta` mantido permanentemente acessível acima da navegação inferior no PWA mobile.
- Reserva adicional de área inferior considerando `safe-area-inset-bottom`.
- Cabeçalho redundante do conteúdo ocultado no mobile, preservando o título no chrome canônico do HRX Admin.
- Indicadores financeiros compactados em grade 2x2 com tipografia maior.
- Abas `Contas a pagar` e `Pagos` tornadas sticky e com área de toque ampliada.
- Cartões mobile com tipografia, espaçamento e hierarquia reforçados.
- Tema claro com superfícies opacas e contraste explícito para títulos, descrições, rótulos e status.
- Botões `Registrar pagamento` e `Cancelar` ampliados para alvo de toque mínimo de 44 px.
- Modal financeiro protegido por altura dinâmica e safe area.
- Teste de regressão adicionado em `tests/admin-mobile-personal-finance-usability.test.mjs`.

## Arquivos alterados

- `src/quotes/admin-finance-scope.css`
- `tests/admin-mobile-personal-finance-usability.test.mjs`

## Regra preservada

A correção é exclusivamente de interface e usabilidade. Nenhuma regra de cálculo, isolamento financeiro, RLS, MFA/AAL2, ledger empresarial ou persistência das contas pessoais foi alterada.
