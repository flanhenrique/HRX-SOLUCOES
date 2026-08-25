# HRX Solutions — ERP Modular — Fase 3

**Documento:** Auditoria e execução — Clientes e Orçamentos com rotas funcionais  
**Versão:** 1.1  
**Data:** 25/08/2026  
**Projeto:** HRX Solutions  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**Branch:** `agent/erp-functional-client-quote-routes`  
**Baseline:** `main @ 9e1d613424deb781e00863c9e3a960f3307f67ac`

## 1. Objetivo original

Transformar os contratos de subrota criados na Fase 2 em navegação funcional para Clientes e Orçamentos, reutilizando integralmente as views e regras de negócio existentes.

Não criar telas paralelas, novo shell, novo editor, novas tabelas, RPCs, migrations, RLS ou regras comerciais.

## 2. Estado auditado

### Clientes

`AdminClientsPage.tsx` já carregava:

- carteira de clientes;
- contatos e dados cadastrais;
- histórico de orçamentos vinculados;
- volume histórico;
- criação de cliente;
- criação de orçamento manual.

O detalhe já existia visualmente dentro da própria view, porém a seleção era controlada apenas por `selectedId` local. Clicar em um cliente não alterava o pathname e abrir `/admin/clientes/:clienteId` não selecionava automaticamente o cadastro correspondente.

### Orçamentos

`AdminQuotes.tsx` já contém:

- lista de propostas;
- seleção por `selectedId` local;
- editor comercial completo;
- criação de proposta;
- salvamento e autosave;
- versionamento;
- PDF;
- compartilhamento;
- transições de status;
- histórico;
- fluxo mobile de lista/detalhe.

A auditoria confirmou que esse arquivo é um monólito funcional de alto impacto. Alterá-lo no mesmo PR de Clientes aumentaria o raio de regressão e dificultaria isolar defeitos no editor comercial. Por isso, a Fase 3 foi dividida em:

- **Fase 3A — Clientes com rotas funcionais:** executada neste PR;
- **Fase 3B — Orçamentos com rotas funcionais:** próxima etapa, em branch/PR próprios, precedida por refatoração segura do monólito quando necessária.

Essa divisão não altera o objetivo arquitetural. Ela reduz risco e mantém commits, testes e rollback independentes.

## 3. Fundação reutilizada

A Fase 2 já fornece:

- `AdminRouteContext` e `useAdminRoute()`;
- `buildAdminSubroutePath()`;
- `navigateAdminPath()`;
- resolução de `client-detail`, `quote-detail` e `quote-edit`;
- fallback SPA para deep links dinâmicos no GitHub Pages.

Nenhum router local foi criado nas views.

## 4. Fase 3A — implementação realizada

### 4.1 URL como fonte de verdade do Cliente

`AdminClientsPage.tsx` passou a consumir `useAdminRoute()`.

Comportamento final:

- `/admin/clientes` mantém a carteira e a seleção local compatível com o comportamento anterior;
- `/admin/clientes/:clienteId` seleciona exatamente o cliente indicado pela URL;
- clicar em um cliente chama `buildAdminSubroutePath()` + `navigateAdminPath()` e atualiza o pathname sem reload;
- voltar da visualização mobile retorna à rota canônica `/admin/clientes`;
- criar um novo cliente pode navegar diretamente para o detalhe canônico do ID criado;
- ID inexistente mantém o pathname solicitado e mostra `Cliente não encontrado`;
- ID inexistente não seleciona silenciosamente o primeiro cadastro;
- back/forward do navegador sincroniza novamente rota e seleção;
- a view não consulta `window.location` nem chama History API diretamente.

### 4.2 Cliente 360° sem nova tela

Nenhum segundo componente de detalhe foi criado. A mesma área `.hrx-client-detail` já existente continua exibindo:

- identificação;
- empresa;
- contatos;
- documento;
- origem;
- observações;
- quantidade de orçamentos;
- volume histórico;
- último orçamento;
- histórico comercial vinculado.

A Fase 3A, portanto, tornou o detalhe existente endereçável por URL sem duplicar UI ou regra de negócio.

### 4.3 Acessibilidade e estado inválido

O primeiro ciclo de Playwright encontrou duas falhas de teste/semântica, não de roteamento:

1. o novo teste de ID inválido contava qualquer `h2`, incluindo o próprio título `Cliente não encontrado`;
2. o CTA `Voltar para clientes` colidia por nome acessível com o botão canônico `Clientes` em um teste existente.

Correções:

- o teste passou a verificar ausência de `.hrx-client-title`;
- o CTA passou a se chamar `Voltar para carteira`.

A seleção por deep link, clique e histórico já havia passado no primeiro ciclo.

## 5. Arquivos alterados na Fase 3A

- `src/quotes/AdminClientsPage.tsx`
- `tests/admin-subroutes.test.mjs`
- `tests/browser/admin-client-routes.spec.ts` — novo
- este documento

Não foram alterados:

- `AdminQuotes.tsx`;
- CSS estrutural do shell/dock;
- `AdminAuthRouter`;
- `AdminMfaGate`;
- banco;
- migrations;
- RLS;
- RPCs;
- Edge Functions;
- cálculo comercial;
- PDF;
- financeiro;
- fiscal.

## 6. Validação da Fase 3A

Head validado antes deste fechamento documental: `344ad398415f5ab7a36ea484796171cc6e69c84e`.

Resultados:

- `Validate HRX site`: **success**;
- `HRX Admin PWA Quality Gate`: **success**;
- `npm run test:pwa`: **87/87**;
- TypeScript/Vite build: **success**;
- Vite: **128 módulos transformados**;
- Playwright: **41/41**;
- deep link de cliente: aprovado;
- clique cliente → pathname: aprovado;
- back/forward: aprovado;
- ID inválido sem fallback silencioso: aprovado;
- um único shell: preservado;
- regressão responsiva/dock/acessibilidade: aprovada.

Este commit documental deve repetir os mesmos gates antes do merge.

## 7. Fase 3B — Orçamentos

Permanece pendente deliberadamente e deve ser executada em branch própria após a Fase 3A entrar na `main`.

Objetivo da Fase 3B:

- `/admin/orcamentos/:orcamentoId` controlar a proposta selecionada;
- `/admin/orcamentos/:orcamentoId/editar` representar o modo de edição do mesmo editor existente;
- clique em proposta atualizar pathname sem reload;
- criação de proposta navegar para o ID criado;
- back/forward restaurar seleção/modo;
- ID inexistente não abrir outra proposta por fallback silencioso;
- manter exatamente um editor comercial.

Antes de alterar o monólito `AdminQuotes.tsx`, deve-se mapear e, quando necessário, extrair apenas responsabilidades técnicas que permitam sincronizar rota e estado sem tocar em cálculo, autosave, PDF, status ou compartilhamento.

## 8. Conclusão

A **Fase 3A está funcionalmente concluída e validada**. Clientes passou de uma seleção local não endereçável para uma experiência orientada por URL, reutilizando a view existente e a fundação arquitetural da Fase 2.

Orçamentos não foi declarado concluído nem parcialmente implementado neste PR. Ele segue formalmente para a Fase 3B, evitando uma alteração de alto risco misturada a um incremento já validado.
