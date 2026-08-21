# Auditoria Técnica — Hortifruti Revolução

**Data:** 21/08/2026  
**Responsável técnico:** HRX Solutions  
**Escopo:** aplicação web, mobile, PWA, fluxo operacional, bancos de clientes e preços, interface, usabilidade, notificações, fiscal/NF-e e cautela de entrega.

## Resumo executivo

A aplicação está publicada no Render e o deploy em produção corresponde ao commit mais recente da branch `main` no momento desta auditoria. A arquitetura principal está coerente com o projeto: Next.js 16, React 19, Neon PostgreSQL 18, Neon Auth, RLS, PWA e Web Push.

A base operacional já contém dados reais mínimos, porém a homologação completa ainda não deve ser considerada concluída. O principal bloqueio é fiscal: todos os seis produtos ativos estão sem NCM, CFOP e CST/CSOSN e nenhum produto possui validação fiscal registrada. O ciclo operacional real também ainda não chegou às etapas de recebimento, separação, entrega e pré-faturamento.

## Situação por área

| Área | Situação | Resultado da auditoria |
|---|---|---|
| Desktop web | Aprovado com ressalva | QA anterior validou 1440×1000, sem overflow horizontal. O deploy atual contém essas correções. É recomendada nova inspeção visual do estado publicado após qualquer alteração de interface. |
| Mobile | Aprovado com ressalva | QA anterior validou 390×844, alvos mínimos de 44 px e ausência de overflow. Navegação administrativa possui cinco destinos fixos. |
| PWA | Estrutura aprovada / teste final pendente | Manifest, service worker, instalação e atualização estão implementados. O cache usa identificação de deploy do Render. Falta nesta rodada comprovação em dispositivo físico do fluxo instalação → fechamento → reabertura → atualização. |
| Fluxo operacional | Parcial | 5 pedidos reais estão em `purchasing`; existe 1 lote de compra. Não há transações de compra, recebimentos, rateios, separações, entregas ou relatórios de faturamento registrados. |
| Banco de clientes | Parcial | 1 cliente ativo. Cadastro possui e-mail, telefone e endereço de entrega, porém o documento fiscal (`tax_id`) está ausente e não há ciência de aviso de privacidade registrada para este cadastro. |
| Banco de valores | Aprovado na consistência básica | 6 preços personalizados para 1 cliente e 6 produtos. Valores entre R$ 4,00 e R$ 9,50; nenhum preço <= 0, vencido ou com período inválido. Os 6 produtos também possuem preço padrão. |
| Arquitetura de interface | Aprovado com melhorias | Administração reorganizada por contexto e fluxo Pedido → Compra → Separação → Entrega → Fiscal. Design premium verde/terracota aplicado. |
| Usabilidade | Aprovado com ressalvas | QA móvel anterior confirmou ausência de overflow e controles de toque mínimos. Fluxos reais ainda precisam ser percorridos ponta a ponta com usuário e dados reais até a conclusão. |
| Notificações | Infraestrutura ativa / disparo final pendente | Há 6 notificações do tipo `new_order` e 3 inscrições Web Push habilitadas para 1 usuário. Não foi disparada uma notificação artificial nesta auditoria; o teste deve usar um evento operacional controlado em dispositivo inscrito. |
| Fiscal / espelho NF-e | Bloqueado | 6/6 produtos sem NCM, CFOP e CST/CSOSN; 6/6 sem validação fiscal. A aplicação possui pré-faturamento, snapshots fiscais e registro de autorização externa, mas emissão real depende da configuração fiscal e do emissor/provedor. |
| Cautela de entrega | Parcialmente aprovada | Documento real em duas vias e linha de corte tracejada já existem. Há identidade visual textual e campos de assinatura, mas falta marca-d'água, campo específico de carimbo, uso inequívoco da logo oficial e garantia de duas vias em uma única folha A4 para todos os volumes de itens. |
| Manual de uso | Pendente | Deve ser produzido após estabilização dos fluxos e telas auditados para evitar documentar comportamento ainda sujeito a correção. |

## Banco de produção — fotografia da auditoria

- Clientes: **1**
- Produtos: **6**
- Pedidos: **5**
- Fornecedores: **0**
- Preços personalizados: **6**
- Notificações persistidas: **6**
- Inscrições Web Push: **3**, todas habilitadas
- Lotes de compra: **1**
- Transações de compra: **0**
- Recebimentos: **0**
- Rateios/alocações: **0**
- Itens separados: **0**
- Eventos de entrega: **0**
- Cautelas/recibos de entrega registrados: **0**
- Relatórios/pré-faturamentos registrados: **0**

## Pontos críticos

### 1. Fiscal

A camada fiscal existe tecnicamente, mas os dados atuais impedem homologação de NF-e. Antes de testar espelho final e integração emissora, é obrigatório completar e validar a classificação fiscal de cada produto e a configuração do emitente.

### 2. Ciclo operacional

O aplicativo ainda não foi comprovado com um ciclo real ponta a ponta usando os dados presentes na produção. Os pedidos chegaram à etapa de compras, mas não avançaram para compra registrada, recebimento, rateio, separação, conferência, entrega e fiscal.

### 3. Cautela

A estrutura funcional já é real e possui duas vias com indicador de corte. Correções obrigatórias de apresentação:

- aplicar a logo oficial do Hortifruti Revolução;
- inserir marca-d'água discreta nas duas vias;
- criar campos separados para assinatura do entregador e recebedor;
- criar área de nome legível/documento quando aplicável;
- criar área específica para carimbo do cliente;
- manter data e hora da entrega;
- definir CSS de impressão A4 e controlar que as duas vias caibam em uma página para o limite operacional definido;
- tratar pedidos com quantidade de itens acima do limite de uma página sem quebrar a legibilidade ou separar as vias incorretamente.

### 4. PWA e notificações

A infraestrutura está presente e já houve QA anterior. A homologação final precisa ser feita em aparelho real, verificando instalação, ícone, splash/abertura, modo standalone, safe-area, atualização após novo deploy, permissão de notificações, recebimento em primeiro e segundo plano e comportamento após remoção/reinscrição da assinatura.

## Roteiro de teste de uso a executar

1. Entrar como cliente.
2. Conferir catálogo e preço individual.
3. Criar pedido com múltiplos itens.
4. Validar criação da notificação administrativa.
5. Entrar como administrador.
6. Aprovar o pedido.
7. Consolidar em lote de compras.
8. Registrar compra por fornecedor.
9. Registrar recebimento, inclusive divergência controlada.
10. Executar rateio para os pedidos.
11. Separar e conferir o pedido.
12. Gerar e imprimir a cautela em duas vias.
13. Registrar tentativa/entrega.
14. Preparar o pré-faturamento e validar o espelho fiscal.
15. Registrar a autorização externa da NF-e quando o emissor real estiver configurado.
16. Fechar o pedido e conferir histórico, auditoria e notificações do cliente.

## Ordem de correção recomendada

1. Completar cadastro fiscal dos produtos e do emitente.
2. Cadastrar fornecedores reais e vínculos produto × fornecedor.
3. Executar um pedido piloto completo, sem atalhos de status.
4. Corrigir a apresentação final da cautela e validar impressão A4.
5. Testar Web Push em dispositivo físico inscrito.
6. Validar espelho de NF-e com dados fiscais reais.
7. Refazer QA visual desktop, mobile e PWA no deploy resultante.
8. Produzir o Manual de Uso final.

## Controle de evidência

- Repositório da aplicação: `flanhenrique/hortifruti-revolucao`
- Hosting: Render (`hortifruti-revolucao`)
- Banco: Neon PostgreSQL 18 — projeto `Hortifruti Revolucao`
- Deploy auditado: commit `2347d403dc8c359e28bdefcb066083581602cfba`

---

**Status desta auditoria:** aberta. Os itens de homologação final só devem ser marcados como concluídos após o teste ponta a ponta e a correção dos bloqueios fiscais e documentais identificados.
