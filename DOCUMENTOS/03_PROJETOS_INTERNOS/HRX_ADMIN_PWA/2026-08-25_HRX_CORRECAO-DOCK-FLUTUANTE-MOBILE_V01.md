# HRX ADMIN PWA — Correção do dock flutuante mobile

**Data:** 25/08/2026  
**Versão:** 1.0  
**Escopo:** PWA mobile / iPhone / Financeiro e navegação global

## Problema observado

A navegação inferior flutuante permanecia visualmente associada a uma faixa inferior do shell, enquanto o conteúdo e correções específicas do Financeiro Pessoal reservavam espaço excessivo no rodapé. Isso gerava uma área azul/branca abaixo do conteúdo, sensação de tela cortada e competição com o modal financeiro.

## Comportamento aprovado

A navegação inferior deve funcionar como um dock de aplicativo nativo:

- permanece fixa na viewport durante toda a rolagem;
- somente a área de conteúdo rola;
- respeita a safe area do iPhone;
- não cria uma terceira faixa visual no rodapé;
- o conteúdo possui apenas a reserva mínima para não ficar coberto;
- no Financeiro Pessoal, `+ Nova conta` volta ao fluxo da página e deixa de criar uma segunda barra fixa;
- durante modal financeiro, o modal assume a tela e o dock é temporariamente ocultado, retornando ao fechar.

## Implementação

- novo override final `src/quotes/admin-mobile-floating-dock-fix.css`;
- import carregado por último em `src/quotes/AdminApp.tsx`;
- shell PWA travado em `100dvh` com `overflow:hidden`;
- `hrx-unified-content` definido como única área rolável;
- `hrx-unified-mobile-nav` mantido em `position:fixed` com safe area;
- padding inferior do Financeiro Pessoal reduzido e normalizado;
- CTA financeiro removido da posição fixa inferior;
- teste de regressão `tests/admin-mobile-floating-dock-persistence.test.mjs`.

## Regras preservadas

Nenhuma regra de negócio, autenticação, MFA/AAL2, banco, RLS, cálculo financeiro, persistência ou navegação funcional foi alterada.
