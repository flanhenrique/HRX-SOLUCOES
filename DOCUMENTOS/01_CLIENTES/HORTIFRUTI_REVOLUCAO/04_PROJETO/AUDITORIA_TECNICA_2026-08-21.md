# Auditoria Técnica — Hortifruti Revolução

**Data:** 21/08/2026  
**Responsável técnico:** HRX Solutions  
**Escopo:** aplicação web, mobile, PWA, fluxo operacional, bancos de clientes e preços, interface, usabilidade, notificações, fiscal/NF-e e cautela de entrega.

## Resumo executivo

A aplicação está publicada no Render e o deploy em produção corresponde ao commit mais recente da branch `main` no momento desta auditoria. A arquitetura principal está coerente com o projeto: Next.js 16, React 19, Neon PostgreSQL 18, Neon Auth, RLS, PWA e Web Push.

A base operacional já contém dados reais mínimos, porém a homologação completa ainda não deve ser considerada concluída. O principal bloqueio é fiscal: todos os seis produtos ativos estão sem NCM, CFOP e CST/CSOSN e nenhum produto possui validação fiscal registrada. O ciclo operacional real também ainda não chegou às etapas de recebimento, separação, entrega e pré-faturamento.

A auditoria também identificou uma pendência estrutural importante na experiência desktop: a interface administrativa web está excessivamente próxima da arquitetura do PWA/mobile. A visão desktop deve ser tratada como uma superfície administrativa própria, com maior densidade de informação, navegação persistente, visão simultânea de indicadores, filtros, tabelas, atalhos e contexto operacional.

## Revalidação do estado real — 21/08/2026

Esta seção registra a nova leitura direta do código, GitHub, Render e banco Neon realizada antes de qualquer alteração da arquitetura administrativa.

### Matriz consolidada de pendências

| Área | Classificação | Evidência atual | Próxima ação segura |
|---|---|---|---|
| Repositório e branch principal | **Concluído** | `main` limpa e sincronizada com `origin/main` no início da auditoria; HEAD `3b608b9`. | Trabalhar somente na branch `agent/auditoria-homologacao-final-20260821`. |
| Build, lint e testes | **Concluído** | ESLint aprovado, 103/103 testes aprovados e build de produção Next.js 16.3.1 aprovado com TypeScript. | Reexecutar após cada grupo funcional de mudanças. |
| Deploy Render | **Parcial** | Serviço ativo, `autoDeployTrigger: off`, branch `main`, último deploy `live` no commit `2347d40`. A `main` contém dois commits posteriores ainda não publicados. | Manter deploy manual; revisar diff completo antes de qualquer publicação. |
| Saúde operacional Render | **Parcial** | Aplicação pública responde HTTP 200; `/admin` e `/cliente` redirecionam usuário anônimo para `/login`. Logs históricos registram falhas de secret de Auth em 18/08 e casts de data vazia em 20/08; este último já possui correção e regressão. | Confirmar ausência de recorrência em janela posterior ao deploy atual e validar autenticação com usuário de homologação. |
| Arquitetura administrativa desktop | **Pendente** | Sidebar existe, mas páginas e CSS foram evoluídos prioritariamente para hubs/cards e navegação móvel. O critério oficial exige central administrativa com tabelas, filtros, inspeção contextual e maior densidade. | Redesenhar shell e superfícies prioritárias sem alterar regras de negócio do backend. |
| Mobile administrativo | **Parcial** | Contratos automatizados confirmam cinco destinos, safe-area e alvos de 44 px. | QA visual real em 390×844 após as mudanças desktop. |
| PWA | **Parcial** | Manifest e `/sw.js` respondem HTTP 200; testes protegem cache apenas de assets estáticos e ignoram tráfego autenticado. | Validar instalação, standalone, atualização e notificações em dispositivo real. |
| Autenticação e autorização | **Parcial** | Guard administrativo central e proxy estão cobertos por regressões; rotas anônimas protegidas no deploy. | Executar testes autenticados e tentativas IDOR com usuários de homologação. |
| RLS e isolamento | **Concluído no nível estrutural / teste real pendente** | 37/37 tabelas públicas com RLS; políticas presentes; nenhum `SECURITY DEFINER` público detectado. | Provar isolamento cliente × cliente em sessão real e manter testes automatizados. |
| Clientes | **Parcial** | 1 cliente ativo; 1 sem `tax_id`; 1 sem ciência versionada do aviso de privacidade; nenhuma PF cadastrada. Schema suporta PF/PJ e unicidade parcial do documento. | Completar dados reais com o cliente; testar cadastro PF/PJ, edição, inativação e duplicidade. |
| Preços | **Parcial** | 6 preços personalizados; nenhum valor não positivo, vencido ou com período invertido. Pedidos possuem itens com preço persistido. | Auditar sobreposição de vigências e provar snapshot por regressão/runtime. |
| Produtos | **Bloqueado externamente** | 6 ativos; 6/6 sem NCM, CFOP, CST/CSOSN e validação fiscal. Preços padrão positivos presentes. | Obter classificação do responsável contábil; não inventar códigos fiscais. |
| Fornecedores | **Pendente** | 0 fornecedores e 0 vínculos produto × fornecedor no banco principal. APIs e telas existem. | Cadastrar dados reais controlados e testar vínculos, filtros, inativação e compras por fornecedor. |
| Emitente fiscal | **Bloqueado externamente** | 0 perfis de emitente fiscal. Estrutura de homologação/emissão externa existe. | Obter dados fiscais reais e responsável pela validação antes de ativar cobertura obrigatória. |
| Ciclo operacional | **Parcial** | 5 pedidos, todos em `purchasing`; 1 lote; 0 compras, recebimentos, rateios, separações, eventos de entrega, cautelas e pré-faturamentos. | Executar piloto na branch Neon de QA ou fluxo explicitamente destinado à homologação, sem atalhos de status. |
| Transições server-side | **Parcial com boa cobertura estática** | Testes impedem lote fora de `approved`, mudança genérica capaz de pular ciclo e finalização sem cobertura fiscal configurada. | Exercitar todas as transições e concorrência em banco isolado. |
| Cautela | **Parcial / correção existente fora da main** | Branch `audit/cautela-documento-final` contém 3 commits, com logo, marca-d'água, carimbo, A4 e regressão; ainda não incorporada à `main`. | Revisar e integrar os commits, depois validar poucos/médios/muitos itens e PDF. |
| Web Push | **Parcial** | 6 notificações `new_order`; 3 subscriptions, todas habilitadas. Nenhum disparo artificial foi feito nesta auditoria. | Teste controlado com evento de homologação e dispositivo inscrito; validar expiração, duplicidade e foreground/background. |
| Fiscal / espelho NF-e | **Bloqueado externamente** | Backend possui perfil, snapshots e pré-faturamento, mas não há emitente nem produtos classificados. | Validar espelho somente após dados contábeis reais; manter explícito que não há integração SEFAZ. |
| Manual do usuário | **Pendente por dependência** | Telas e fluxo ainda serão alterados. | Produzir manuais Cliente e Administrador após homologação visual e operacional. |

### Problemas anteriores confirmados

- desktop administrativo exige redesign estrutural;
- banco continua sem fornecedores e vínculos produto × fornecedor;
- cliente ativo continua sem documento fiscal e ciência do aviso de privacidade;
- todos os produtos ativos continuam sem classificação e validação fiscal;
- ciclo real continua concentrado em `purchasing` e não chegou a recebimento, separação, entrega ou fiscal;
- infraestrutura Web Push continua com inscrições ativas, mas o teste final controlado permanece pendente;
- cautela finalizada existe em branch remota e não deve ser recriada.

### Hipóteses descartadas ou refinadas

- o deploy não acompanha atualmente o HEAD da `main`: o Render está no commit `2347d40`, enquanto a branch está em `3b608b9`;
- não há ausência estrutural de RLS nas tabelas públicas: todas as 37 tabelas base públicas estão com RLS habilitado;
- build quebrado não é uma pendência atual: lint, testes e build passaram nesta revalidação;
- fornecedores, fiscal e ciclo não estão ausentes do código: há schema, APIs e telas; a pendência principal é dado real, comprovação operacional e qualidade da interface.

### Evidências técnicas desta revalidação

- Aplicação: `main` em `3b608b9`; branch de trabalho `agent/auditoria-homologacao-final-20260821`.
- Documentação: branch `agent/auditoria-hortifruti-20260821`.
- Render: serviço `srv-da1t54rncjis738235vg`, deploy `dep-da3n3mk9v7es7394t2ug`, status `live`, commit `2347d403dc8c359e28bdefcb066083581602cfba`.
- Neon: projeto `dark-shadow-88410918`, branch principal `br-silent-glitter-avegm7p3`, PostgreSQL 18.
- Validação local: ESLint aprovado; 103 testes aprovados; build de produção aprovado.
- Produção: página pública HTTP 200; manifest HTTP 200; service worker HTTP 200; áreas autenticadas redirecionam para login.
- Nenhum deploy, migration, escrita no banco ou notificação foi disparado nesta fase.

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

## Execução técnica posterior à matriz

### Correções realizadas

1. **Central administrativa desktop — primeira etapa estrutural**
   - adicionada barra de ferramentas exclusiva para desktop com pesquisa de pedidos recentes, filtro por status e atalhos administrativos;
   - adicionada matriz densa com dez filas e exceções operacionais simultâneas;
   - pedidos recentes passaram a usar tabela administrativa no desktop;
   - abaixo de 820 px, os controles exclusivos de desktop são removidos e a tabela assume apresentação em cartões com alvos de toque adequados;
   - backend e regras de negócio foram preservados.

2. **Fornecedores e vínculos produto × fornecedor**
   - interface passou a permitir tornar fornecedor preferencial por produto;
   - vínculos podem ser inativados e reativados sem remoção do histórico;
   - criação e reativação de vínculo exigem produto e fornecedor ativos no servidor;
   - fornecedor inativo não pode receber novo vínculo pela interface;
   - dados reais continuam bloqueados: produção permanece com zero fornecedores e zero vínculos.

3. **Cautela de entrega**
   - integrada a implementação já existente na branch `audit/cautela-documento-final`, sem recriação;
   - logo oficial e marca-d'água aplicadas;
   - duas vias na mesma folha com linha e indicador visual de corte;
   - campos separados para entregador, recebedor, documento, data/hora e carimbo;
   - CSS possui `@page { size: A4 portrait; }` e grade de impressão para manter as duas vias juntas;
   - densidade adaptativa aplicada para pedidos médios e extensos;
   - validação física de PDF com pedidos reais ainda depende de pedido separado disponível em homologação.

### Validação após as correções

- Testes automatizados: **106 aprovados, 0 falhas**.
- ESLint: **aprovado**.
- TypeScript/build Next.js 16.3.1: **aprovado**.
- Migrations: **nenhuma criada**.
- Banco principal: **nenhuma escrita**.
- Render: **nenhum deploy disparado**.
- Web Push: **nenhuma notificação disparada**.

### Commits da aplicação

- `89c6c1b` — `feat: amplia central administrativa desktop`
- `4938ed0` — `fix: endurece vínculos de fornecedores ativos`
- `b81ec88` — `feat: finaliza layout da cautela em duas vias`
- `9b31b98` — `style: ajusta cautela para A4, marca-d'água e carimbo`
- `50b019b` — `test: protege layout final da cautela`

### Situação para merge e deploy

- **Merge:** ainda não recomendado sem QA visual autenticado em 1440 px e 390×844 e revisão final do diff.
- **Deploy:** não recomendado. Permanecem bloqueios de dados fiscais, fornecedores reais, ciclo ponta a ponta, dispositivo PWA e Web Push controlado.

## Continuação — Web Push, ciclo de QA e espelho fiscal

### Ciclo operacional em branch Neon isolada

- Branch inspecionada: `qa-simulated-order-20260820` (`br-red-haze-av3a54a0`).
- Estado encontrado: 1 pedido em `received`, 3 produtos, 0 fornecedores, 0 vínculos, 0 lotes e nenhum pedido piloto selecionado.
- Nenhuma escrita foi executada nessa branch.
- O ciclo não foi forçado por SQL porque isso contornaria as transições server-side. Para prosseguir são necessários fornecedor controlado e credenciais de cliente/administrador de homologação.

### Web Push

- endpoints agora exigem HTTPS, não aceitam credenciais embutidas, portas não padrão, localhost nem endereços privados IPv4 comuns;
- tamanhos de endpoint e chaves passam a ser limitados;
- subscriptions expiradas continuam sendo inativadas somente em respostas `404/410`;
- falhas `429` e `5xx` recebem exatamente uma tentativa adicional curta;
- falhas finais são contabilizadas sem registrar o endpoint secreto;
- nenhum push real foi enviado.

Commit: `6e44b97` — `fix: endurece entrega e cadastro Web Push`.

### Espelho fiscal v2

- criada a migration `20260821_fiscal_snapshot_v2.sql`, ainda não aplicada ao Neon;
- snapshots futuros passam a registrar versão, endereço estruturado completo do emitente e destinatário, contatos, dados operacionais do pedido, informações adicionais e rastreabilidade;
- itens continuam preservando quantidade, unidade, valores e classificação fiscal;
- exportação detecta v1/v2 e mantém compatibilidade com relatórios antigos;
- a migration revoga execução pública e mantém a função restrita ao papel administrativo.

Commit: `1f047e0` — `feat: amplia espelho fiscal versionado`.

### Validação acumulada

- Testes automatizados: **108 aprovados, 0 falhas**.
- ESLint: **aprovado**.
- Build de produção e TypeScript: **aprovados**.
- A migration fiscal nova precisa ser validada em branch temporária Neon e aprovada antes de aplicação no banco principal.

### Validação da migration fiscal em branch Neon temporária

- Branch: `qa-fiscal-snapshot-v2-20260821`.
- Branch ID: `br-steep-mouse-avehupuj`.
- Parent: `br-silent-glitter-avegm7p3` (`main`).
- A função fiscal v2 compilou e foi instalada com sucesso somente na branch temporária.
- A primeira validação revelou referência incorreta ao papel inexistente `app_admin`.
- A migration foi corrigida para o papel RLS real `hortifruti_app`.
- Verificações aprovadas:
  - função presente;
  - snapshot v2 presente;
  - endereço completo presente;
  - informações adicionais presentes;
  - rastreabilidade presente;
  - execução por `PUBLIC` revogada;
  - execução por `hortifruti_app` concedida;
  - chamada controlada executada sob `hortifruti_app` e rejeição correta de pedido inexistente.
- A branch principal Neon não foi alterada.
- A branch temporária foi mantida como evidência até decisão de aplicação ou descarte.

Commit corretivo: `5a91ea8` — `fix: alinha permissão fiscal ao papel RLS`.

Validação final desta rodada: **110 testes aprovados**, ESLint aprovado e build de produção aprovado.

## Atualização de governança e homologação — 21/08/2026

Esta atualização substitui qualquer interpretação anterior de que a validação técnica ou responsiva equivaleria à homologação do produto.

**Decisão oficial:** a auditoria técnica foi concluída, porém o projeto **não está homologado**. A homologação permanece condicionada à evolução da experiência administrativa desktop, à regularização dos assets PWA, à disponibilização de dados reais e às validações operacionais, fiscais e de infraestrutura descritas abaixo.

### Matriz atualizada

| Área | Estado | Evidência e critério atual |
|---|---|---|
| Auditoria técnica de código | **CONCLUÍDO** | Lint aprovado, 110/110 testes aprovados e build de produção concluído. Isso comprova consistência técnica, não homologação operacional. |
| Segurança estrutural | **PARCIAL** | Guards, RLS, isolamento e headers possuem cobertura; testes autenticados de homologação e CSP permanecem pendentes. |
| Desktop administrativo | **PENDENTE** | A interface continua excessivamente semelhante ao PWA. Responsividade e ausência de overflow não atendem ao critério de central administrativa desktop completa. |
| Mobile | **PARCIAL** | Contratos responsivos e alvos de toque foram validados. A rodada final deve ocorrer após a estabilização do produto. |
| PWA | **PENDENTE** | Manifest e service worker existem, mas faltam assets oficiais íntegros 192×192 e 512×512 e homologação efetiva de instalação/atualização. |
| Dados QA-E2E | **PENDENTE** | Há dados identificados como QA no banco padrão. A limpeza deve ser preparada e revisada, sem execução até autorização expressa. |
| Fornecedores e vínculos | **PENDENTE** | Estrutura técnica existe; faltam fornecedores reais e vínculos produto × fornecedor. Nenhum dado deve ser inventado. |
| Fiscal | **BLOQUEADO** | Depende de dados reais do emitente, classificação fiscal dos produtos, orientação contábil/fiscal, definição entre NF-e/NFS-e e emissor/provedor. |
| Pedido piloto ponta a ponta | **BLOQUEADO** | Depende de dados operacionais e fiscais reais, fornecedor controlado e usuários de homologação. Não será simulado por atalhos de banco ou status. |
| Web Push | **BLOQUEADO** | A infraestrutura tem cobertura técnica, mas a homologação exige dispositivo real, conta cliente e evento operacional controlado. |
| Render | **PENDENTE** | Logs, métricas, configuração e deploy precisam de validação autorizada. Nenhum deploy foi executado nesta rodada. |
| Manual de uso | **PARCIAL** | A versão inicial foi produzida e arquivada; deverá ser atualizada somente com o comportamento efetivamente homologado. |
| Homologação final do projeto | **PENDENTE** | Depende da conclusão ou aceite formal dos itens P1 a P10. |

### Critério obrigatório para o desktop administrativo

O desktop não será considerado homologado enquanto funcionar essencialmente como o PWA redimensionado. Ele deve entregar ganho real de produtividade e capacidade analítica em telas grandes, incluindo:

- sidebar e navegação administrativa desktop persistentes;
- dashboard operacional completo e KPIs;
- tabelas densas e maior quantidade de informação simultânea;
- filtros avançados, pesquisa, ordenação e paginação quando aplicável;
- ações em lote e painéis de detalhes;
- histórico, alertas e pendências operacionais e fiscais;
- aproveitamento efetivo de telas grandes sem prejudicar a experiência móvel.

Mobile/PWA e desktop podem compartilhar componentes, APIs, regras de negócio e identidade visual. Eles não devem, porém, oferecer a mesma experiência apenas redimensionada.

### Backlog restante oficial

| Prioridade | Entrega | Estado | Condição de conclusão |
|---|---|---|---|
| P1 | Desktop administrativo completo | **PENDENTE** | Atender integralmente aos critérios de produtividade, densidade, navegação, tabelas, filtros, detalhes, histórico e alertas definidos acima. |
| P2 | Corrigir assets PWA oficiais 192×192 e 512×512 | **PENDENTE** | Receber/exportar assets oficiais íntegros, incluir variantes adequadas e validar instalação. |
| P3 | Preparar limpeza controlada dos dados QA-E2E | **PENDENTE** | Produzir inventário, dependências, backup e script revisável; não executar sem autorização. |
| P4 | Preparar fornecedores e vínculos produto × fornecedor | **PENDENTE** | Receber dados reais, validar cadastro e vínculos sem registros inventados. |
| P5 | Pendências fiscais e definição NF-e/NFS-e | **BLOQUEADO** | Obter emitente, classificação dos produtos, orientação contábil/fiscal, definição documental e emissor/provedor. |
| P6 | Executar pedido piloto ponta a ponta | **BLOQUEADO** | Dispor de dados reais/controlados e percorrer todas as transições server-side sem atalhos. |
| P7 | Homologar Web Push em dispositivo real | **BLOQUEADO** | Usar conta cliente, dispositivo inscrito e evento operacional controlado em foreground/background. |
| P8 | Validar logs, métricas e deploy no Render | **PENDENTE** | Confirmar workspace, revisar ambiente e executar validação autorizada sem deploy automático. |
| P9 | Reexecutar QA final desktop/mobile/PWA | **PENDENTE** | Executar após P1–P8 aplicáveis e registrar evidências nas resoluções e dispositivos definidos. |
| P10 | Atualizar manual com comportamento homologado | **PARCIAL** | Revisar a versão arquivada somente depois do QA e da homologação efetiva. |

### Bloqueios fiscais externos

Permanecem formalmente externos e não podem ser solucionados com dados fictícios:

- dados reais e completos do emitente;
- NCM, CEST, CFOP, CST/CSOSN e demais classificações aplicáveis aos produtos;
- orientação do responsável contábil/fiscal;
- definição do documento fiscal aplicável à operação, incluindo decisão entre NF-e e NFS-e;
- definição, credenciamento e configuração do emissor/provedor.

Até a resolução desses pontos, qualquer artefato gerado pelo sistema deve ser tratado como espelho ou pré-faturamento, nunca como documento fiscal oficialmente autorizado.

### Controle documental

Os entregáveis desta auditoria foram classificados no arquivo oficial do cliente:

- `04_PROJETO/AUDITORIAS/Auditoria_Tecnica_Hortifruti_Revolucao_2026-08-21.docx`;
- `04_PROJETO/AUDITORIAS/Auditoria_Tecnica_Hortifruti_Revolucao_2026-08-21.pdf`;
- `05_ENTREGAS/MANUAIS/Manual_de_Uso_Hortifruti_Revolucao_2026-08-21.docx`;
- `05_ENTREGAS/MANUAIS/Manual_de_Uso_Hortifruti_Revolucao_2026-08-21.pdf`.

Nenhum código da aplicação HRX Solutions foi alterado ou reutilizado. Nenhum dado QA-E2E foi removido, nenhum dado fiscal ou de fornecedor foi criado, e nenhum push, merge ou deploy foi realizado.
