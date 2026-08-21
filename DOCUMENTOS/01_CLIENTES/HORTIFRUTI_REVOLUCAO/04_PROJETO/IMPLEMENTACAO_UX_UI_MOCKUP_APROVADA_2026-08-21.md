# Hortifruti Revolução — Implementação UX/UI da Mockup Aprovada

**Data:** 2026-08-21  
**Aplicação:** `flanhenrique/hortifruti-revolucao`  
**Branch de implementação:** `agent/redesign-ui-mockup-aprovada-20260821`  
**PR de revisão/CI:** `#82` — rascunho, sem autorização de merge/deploy  
**Objetivo:** implementar com alta fidelidade as cinco superfícies aprovadas, preservando arquitetura, regras de negócio, autenticação, RLS, APIs, PWA e dados reais.

## 1. Escopo implementado

### Tela 1 — Dashboard Administrativo
- sidebar desktop fixa e compacta;
- topbar com busca, alertas e perfil;
- quatro KPIs reais: faturamento registrado no dia, pedidos do dia, ticket médio e entregas;
- status dos pedidos com distribuição real;
- resumo de compras e recebimento;
- resumo de entregas;
- alertas operacionais reais;
- pedidos recentes;
- próximas ações;
- atividade recente baseada no histórico operacional.

### Tela 2 — Gestão de Pedidos
- cabeçalho e ações administrativas;
- busca, status, cliente e período;
- tabela desktop densa com seleção, ordenação e paginação;
- aprovação em lote condicionada às transições reais permitidas;
- consolidação real via backend de compras;
- exportação CSV;
- drawer lateral com cliente, documento, contato, entrega, valor, itens e histórico;
- atualização de status usando o endpoint operacional existente;
- acesso à cautela pelo pedido selecionado.

### Tela 3 — Operação / Compras / Separação
- workspace administrativo integrado;
- lotes de compra;
- recebimento com valores comprado/recebido/pendente;
- divergências de recebimento;
- progresso de separação;
- fornecedor em destaque por volume histórico real;
- próximas entregas presentes na fila operacional;
- tabela de lotes;
- links para compras, recebimento, separação, divergências e fornecedores.

Não foram inventadas métricas de pontualidade, qualidade ou performance de fornecedor. Elas permanecem ocultas até existir cálculo homologado.

### Tela 4 — PWA Cliente
- cabeçalho compacto;
- busca de produtos;
- categorias roláveis;
- cards compactos com nome, unidade, preço do cliente e controle de quantidade;
- barra sticky com quantidade, total e finalização;
- revisão do pedido em modal;
- envio real pelo endpoint de pedidos existente;
- navegação inferior com Início, Catálogo, Meu pedido, Pedidos e Conta;
- histórico e notificações preservados.

O catálogo atual não expõe mídia real por produto. Foi usado um visual neutro/abstrato em vez de imagens falsas.

### Tela 5 — Documento / Fiscal / Cautela
- duas vias: Cliente e Empresa;
- linha de corte;
- logo oficial e marca-d’água;
- A4 portrait;
- cliente, documento, contato, endereço, pedido, data/hora, entrega e itens reais;
- campos de recebimento, assinatura, documento do recebedor e carimbo;
- densidade adaptativa para maior quantidade de itens;
- resumo lateral de pré-faturamento ligado ao pedido real.

Frete, desconto, despesas, condição e vencimento não são simulados quando ausentes no modelo. A emissão de NF-e permanece na central fiscal existente.

## 2. Design system e componentes

### Alterados/reaproveitados
- `PortalSidebar`
- `AdminManualOrderModal`
- `ClientOrderHistory`
- `ClientOrderComposer`
- shells/layouts administrativos e do cliente
- componentes e estilos operacionais já existentes

### Novas camadas de estilo
- `src/app/mockup-approved.css`
- `src/app/dashboard-mockup.css`
- `src/app/orders-mockup.css`
- `src/app/operation-mockup.css`
- `src/app/client-mockup.css`
- `src/app/document-mockup.css`

As novas folhas são carregadas após as camadas legadas para consolidar o visual aprovado sem reescrever desnecessariamente a arquitetura existente.

## 3. APIs alteradas

### `/api/admin/dashboard`
Adicionadas métricas derivadas de dados reais existentes, incluindo ticket médio, entregas programadas, compras/recebimento e distribuição de status.

### `/api/admin/orders`
A leitura administrativa passou a fornecer dados adicionais do cliente, itens e histórico resumido necessários ao drawer da gestão de pedidos.

### `/api/admin/caution`
A leitura da cautela passou a fornecer subtotal, dados do cliente e itens efetivamente separados quando disponíveis.

Não foram criadas APIs fictícias nem integrações falsas de NF-e.

## 4. Commits da aplicação

1. `38b89152` — `feat(ui): consolida design system da mockup aprovada`
2. `770dd4f7` — `feat(admin): aproxima dashboard da mockup aprovada`
3. `203cda9a` — `feat(admin): implementa gestão de pedidos fiel à mockup`
4. `f113fc0f` — `feat(admin): transforma operação em workspace integrado`
5. `bb9f10ef` — `feat(pwa): implementa catálogo e pedido rápido da mockup`
6. `6bd6a9e0` — `feat(documentos): alinha cautela e pré-fiscal à mockup`
7. `cbf110e4` — `test(ui): atualiza contratos e reforça validação da mockup`

## 5. QA técnico

O PR rascunho foi criado somente para executar o CI do GitHub. Nenhum merge ou deploy foi autorizado.

- primeira execução: lint aprovado; testes legados falharam porque ainda validavam a composição anterior;
- testes estruturais foram atualizados para a mockup aprovada;
- foi adicionado script explícito `typecheck` (`tsc --noEmit`) e etapa correspondente no CI;
- o progresso visual de separação foi corrigido para usar percentual dinâmico;
- destaque da navegação da tela de operação foi ajustado para Compras.

**Status final do segundo CI e QA visual:** atualizar após conclusão da execução e captura visual.

## 6. Pendências/resíduos já identificados

- mídia/foto real dos produtos não existe no contrato atual do catálogo;
- filtros adicionais só devem ser expostos quando suportados e validados;
- métricas de fornecedor (pontualidade/qualidade) ainda não possuem fonte homologada;
- campos fiscais adicionais não existentes no banco não são simulados;
- comparação visual final das cinco telas depende de ambiente executável/autenticado da branch, sem disparar deploy não autorizado.

## 7. Regras de homologação

A etapa não deve ser marcada como pronta para merge/deploy enquanto houver qualquer um dos seguintes pontos:
- CI incompleto ou com falha;
- QA visual desktop 1440×1000 pendente;
- QA mobile/PWA 390×844 pendente;
- validação de impressão A4 pendente;
- divergências visuais relevantes em relação à mockup aprovada.

## 8. Governança

- código da aplicação HRX Solutions não foi alterado;
- esta branch contém apenas documentação do cliente Hortifruti Revolução;
- branch da aplicação permanece separada;
- não realizar merge nem deploy sem homologação expressa.
