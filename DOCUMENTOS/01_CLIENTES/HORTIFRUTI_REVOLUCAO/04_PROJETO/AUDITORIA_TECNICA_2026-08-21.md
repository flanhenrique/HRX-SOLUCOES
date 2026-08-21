# Auditoria Técnica — Hortifruti Revolução

**Data:** 21/08/2026  
**Responsável técnico:** HRX Solutions  
**Escopo:** aplicação web, mobile, PWA, fluxo operacional, bancos de clientes e preços, interface, usabilidade, notificações, fiscal/NF-e e cautela de entrega.

## Resumo executivo

A aplicação está publicada no Render e o deploy em produção corresponde ao commit mais recente da branch `main` no momento desta auditoria. A arquitetura principal está coerente com o projeto: Next.js 16, React 19, Neon PostgreSQL 18, Neon Auth, RLS, PWA e Web Push.

A base operacional já contém dados reais mínimos, porém a homologação completa ainda não deve ser considerada concluída. O principal bloqueio é fiscal: todos os seis produtos ativos estão sem NCM, CFOP e CST/CSOSN e nenhum produto possui validação fiscal registrada. O ciclo operacional real também ainda não chegou às etapas de recebimento, separação, entrega e pré-faturamento.

A auditoria também identificou uma pendência estrutural importante na experiência desktop: a interface administrativa web está excessivamente próxima da arquitetura do PWA/mobile. A visão desktop deve ser tratada como uma superfície administrativa própria, com maior densidade de informação, navegação persistente, visão simultânea de indicadores, filtros, tabelas, atalhos e contexto operacional.

## Situação por área

| Área | Situação | Resultado da auditoria |
|---|---|---|
| Desktop web | **Pendente — redesign estrutural necessário** | A visão atual está excessivamente semelhante ao PWA. Apesar de o QA anterior ter validado responsividade e ausência de overflow em 1440×1000, isso não significa que a experiência desktop esteja correta. O painel administrativo web deve ser redesenhado para explorar a largura e densidade disponíveis em desktop, com mais informação simultânea, navegação persistente, filtros, tabelas, KPIs e ações contextuais. |
| Mobile | Aprovado com ressalva | QA anterior validou 390×844, alvos mínimos de 44 px e ausência de overflow. Navegação administrativa possui cinco destinos fixos. |
| PWA | Estrutura aprovada / teste final pendente | Manifest, service worker, instalação e atualização estão implementados. O cache usa identificação de deploy do Render. Falta nesta rodada comprovação em dispositivo físico do fluxo instalação → fechamento → reabertura → atualização. |
| Fluxo operacional | Parcial | 5 pedidos reais estão em `purchasing`; existe 1 lote de compra. Não há transações de compra, recebimentos, rateios, separações, entregas ou relatórios de faturamento registrados. |
| Banco de clientes | Parcial | 1 cliente ativo. Cadastro possui e-mail, telefone e endereço de entrega, porém o documento fiscal (`tax_id`) está ausente e não há ciência de aviso de privacidade registrada para este cadastro. |
| Banco de valores | Aprovado na consistência básica | 6 preços personalizados para 1 cliente e 6 produtos. Valores entre R$ 4,00 e R$ 9,50; nenhum preço <= 0, vencido ou com período inválido. Os 6 produtos também possuem preço padrão. |
| Arquitetura de interface | **Parcial — desktop precisa de arquitetura própria** | A organização por contexto e o fluxo Pedido → Compra → Separação → Entrega → Fiscal estão corretos, mas a mesma lógica visual do PWA foi levada longe demais para o desktop. Deve haver dois níveis de apresentação: mobile/PWA orientado à execução rápida e desktop web orientado à gestão, análise e operação completa. |
| Usabilidade | Parcial | QA móvel anterior confirmou ausência de overflow e controles de toque mínimos. No desktop, a usabilidade está limitada pela baixa densidade informacional e pela excessiva semelhança com o PWA. Fluxos reais ainda precisam ser percorridos ponta a ponta com usuário e dados reais até a conclusão. |
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

### 5. Visão administrativa desktop

A visão desktop web não deve ser apenas uma versão larga do PWA. A proposta de produto precisa diferenciar claramente as duas experiências:

**PWA/mobile:**
- foco em execução rápida;
- poucas decisões por tela;
- navegação inferior;
- cards verticais;
- ações prioritárias;
- leitura simplificada em movimento.

**Desktop web administrativo:**
- sidebar persistente e hierarquia completa dos módulos;
- dashboard com múltiplos blocos simultâneos;
- KPIs operacionais e financeiros em maior densidade;
- tabelas completas onde forem mais eficientes que cards;
- filtros avançados sempre acessíveis;
- busca global e ações em lote quando aplicável;
- visão combinada de pedidos, compras, separação, entrega e fiscal;
- alertas, pendências e exceções visíveis sem exigir múltiplos cliques;
- melhor aproveitamento de 1280 px, 1440 px e resoluções superiores;
- uso de painéis laterais, modais, drawers e áreas de detalhe sem abandonar a tela principal;
- possibilidade de comparar registros, consultar histórico e executar ações administrativas com menos navegação.

O critério de aceite da visão desktop não será apenas “sem overflow”. Ela deve entregar ganho real de produtividade e informação em relação ao PWA.

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
17. Repetir os fluxos administrativos principais especificamente na visão desktop, verificando densidade informacional, quantidade de cliques, visibilidade de filtros, eficiência de tabelas e capacidade de operar múltiplas informações na mesma tela.

## Ordem de correção recomendada

1. Completar cadastro fiscal dos produtos e do emitente.
2. Cadastrar fornecedores reais e vínculos produto × fornecedor.
3. Redesenhar a visão administrativa desktop como superfície própria, sem copiar a estrutura do PWA.
4. Executar um pedido piloto completo, sem atalhos de status.
5. Corrigir a apresentação final da cautela e validar impressão A4.
6. Testar Web Push em dispositivo físico inscrito.
7. Validar espelho de NF-e com dados fiscais reais.
8. Refazer QA visual desktop, mobile e PWA no deploy resultante.
9. Produzir o Manual de Uso final.

## Controle de evidência

- Repositório da aplicação: `flanhenrique/hortifruti-revolucao`
- Hosting: Render (`hortifruti-revolucao`)
- Banco: Neon PostgreSQL 18 — projeto `Hortifruti Revolucao`
- Deploy auditado: commit `2347d403dc8c359e28bdefcb066083581602cfba`

---

**Status desta auditoria:** aberta. Os itens de homologação final só devem ser marcados como concluídos após o teste ponta a ponta e a correção dos bloqueios fiscais, documentais e da arquitetura administrativa desktop identificados.
