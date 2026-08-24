# HRX SOLUTIONS — ROADMAP MESTRE DE EVOLUÇÃO CONTÍNUA
**Projeto**: HRX Solutions — HRX Admin PWA  
**Data**: 2026-08-24  
**Versão**: V01  
**Status**: APROVADO E EM VIGÊNCIA  
**Repositório Canônico**: flanhenrique/HRX-SOLUCOES  
**Branch Base**: main  
**SHA Base**: 7421cd8938fb0847e27fe8b54dc4fb64ebca4e8a  

---

## 1. ESTADO ATUAL DO PRODUTO

O ecossistema **HRX Solutions** concluiu com êxito as fases críticas P0, P1 e P2 do HRX Admin PWA. A aplicação encontra-se publicada e em produção no domínio canônico https://hrxsolutions.com.br, com backend Supabase (	gcdkofplegmjvvkheyd), banco de dados PostgreSQL estruturado com 33 migrations canônicas, 100% de RLS com exigência de MFA/AAL2 em operações administrativas, e suíte de testes 100% verde (67 testes unitários/PWA + 24 testes E2E Playwright em 17 viewports).

A aplicação opera sob o princípio de **estabilidade produtiva**, onde novas implementações devem seguir obrigatoriamente um ciclo incremental, faseado e sem PRs monolíticos (*mega PRs*).

---

## 2. O QUE ESTÁ CONCLUÍDO

1. **Arquitetura de Shell Único Canônico**:
   - Cadeia estrita: AdminAuthRouter → AdminMfaGate → AdminApp → AdminUnifiedRoot.
   - Exatamente um shell ativo por contexto de visualização: DesktopShell (desktop) e PwaShell (mobile/tablet).
   - Extinção total de micro-shells, docks, sidebars e overlays duplicados.
   - 10 áreas administrativas convertidas em views puras lazy loaded via React.lazy().
2. **Motor de Propostas Comerciais (Canva DAHTJI6gD7s)**:
   - 6 páginas canônicas idênticas à geometria aprovada.
   - Anexos de detalhamento dinâmicos para overflow de itens e parcelas sem truncamento de dados.
   - Geração de PDF e armazenamento privado no bucket hrx-documents com URLs assinadas temporárias.
3. **Módulo Financeiro Consolidado**:
   - Operação GET 100% read-only sem escrita colateral no banco.
   - KPIs e métricas globais calculados no backend.
   - Exclusão de liquidações estornadas (
reversed_at IS NULL) dos cálculos contábeis.
   - Trilha de auditoria append-only em financial_audit_log.
4. **PWA, Usabilidade e Acessibilidade**:
   - Navegação inferior flutuante protegida (z-index: 2000) sobre o workspace.
   - Moderação do atualizador para 120s condicionado à visibilidade da aba.
   - Responsividade aprovada em 17 resoluções distintas.
   - Conformidade de acessibilidade (0 violações sérias/críticas no axe-core).
5. **Governança de PRs Históricas e Documentação**:
   - PRs #74 e anteriores consolidadas e integradas ao main.
   - PRs históricas superseded (#65, #53, #40, #38, #37, #1) comentadas e fechadas sem merge cego.
   - Arquivamento de 5 relatórios canônicos em DOCUMENTOS/03_PROJETOS_INTERNOS/HRX_ADMIN_PWA/.

---

## 3. PENDÊNCIAS ATUAIS

1. **Operacional / Homologação Real**: Realização de teste administrativo com credenciais ativas e dispositivo TOTP físico em produção pelo operador humano responsável.
2. **Jurídica / LGPD**: Nomeação formal do Encarregado de Proteção de Dados (DPO) pela diretoria da HRX Solutions.

---

## 4. FASE 1 — HOMOLOGAÇÃO REAL EM PRODUÇÃO

- **Objetivo**: Executar a validação funcional completa do fluxo autenticado em produção (https://hrxsolutions.com.br) sem criar registros financeiros ou propostas oficiais fictícias que poluam o ambiente.
- **Critérios**:
  - Login com MFA e confirmação do claim al2 no JWT.
  - Teste de reload e persistência de sessão no PWA standalone.
  - Navegação entre as 10 áreas em desktop e dispositivos móveis reais (iOS Safari e Android Chrome).
  - Teste de abertura/fechamento do painel de notificações via teclado (Escape) e clique externo.

---

## 5. FASE 2 — LGPD E GOVERNANÇA DE DADOS

- **Objetivo**: Estruturar a matriz formal de governança de dados pessoais tratados na plataforma.
- **Matriz de Tratamento**:
  - *Tipos de Dados*: Identificação de clientes (Nome, CPF/CNPJ, E-mail, Telefone, Endereço), logs de acesso, registros de propostas e lançamentos financeiros.
  - *Bases Legais*: Execução de contrato (Art. 7, V da LGPD) para orçamentos e financeiro; Cumprimento de obrigação legal (Art. 7, II) para guarda fiscal.
  - *Segurança*: RLS ativo, segregação por AAL2, storage privado e conexões HTTPS/TLS.
- **Status do DPO**: BLOQUEADO EXTERNAMENTE — REQUER DECISÃO ADMINISTRATIVA/JURÍDICA.

---

## 6. FASE 3 — FINANCEIRO + FISCAL (EMISSÃO DE NOTAS E RECORRÊNCIAS)

- **Objetivo**: Evoluir o financeiro para conexão do ciclo comercial com o faturamento fiscal e suporte a receitas/despesas recorrentes.
- **Entregas Técnicas**:
  1. *Fluxo Fiscal Integrado*: Proposta Aprovada → Faturamento → Emissão/Registro de NF-e/NFS-e → Registro de Recebível.
  2. *Armazenamento de XML/PDF Fiscal*: Anexo direto de XML e DANFE ao lançamento e na Central de Documentos.
  3. *Recorrências Financeiras*: Criação de regras de faturamento e despesas periódicas (mensal, trimestral, anual) sem alterar lançamentos históricos retroativos.
  4. *Perfil de Acesso Contábil (ACCOUNTANT)*: Permissões restritas de leitura/exportação para relatórios fiscais sem poderes de administração global.
  5. *Preparação para Conciliação Bancária*: Camada de importação de extrato (OFX/CSV) mantendo clara distinção entre fluxo de caixa gerencial e saldo bancário real.

---

## 7. FASE 4 — E-MAIL TRANSACIONAL NO BACKEND

- **Objetivo**: Substituir o protocolo client-side mailto: por um serviço transacional automatizado via Edge Function.
- **Requisitos de Infraestrutura**:
  - Configuração de DNS: SPF, DKIM e DMARC no domínio hrxsolutions.com.br.
  - Provedor compatível (ex: Resend, Postmark ou SendGrid) autenticado exclusivamente via variáveis de ambiente seguras nas Edge Functions.
  - Fila de envio com retry automático, controle de idempotência e registro de falhas.
  - Eventos de disparo: Envio de proposta comercial ao cliente, notificação de aprovação, envio de comprovante e alertas de vencimento.

---

## 8. FASE 5 — WHATSAPP BUSINESS API (OFICIAL META)

- **Objetivo**: Integrar a API oficial do WhatsApp (Meta Cloud API) para envio automatizado e rastreável de propostas e avisos.
- **Requisitos**:
  - Conta comercial verificada na Meta e aprovação de templates HSM (*Highly Structured Messages*).
  - Webhook seguro em Edge Function para recepção de status de entrega (sent, delivered, 
ead, failed).
  - Preservação do link manual wa.me como contingência e fallback permanente.

---

## 9. FASE 6 — CRM 360° DE CLIENTES

- **Objetivo**: Expandir o módulo de Clientes em uma visão 360° unificada sem criar um CRM paralelo.
- **Funcionalidades**:
  - Linha do tempo integrada do cliente: Propostas, Contratos, Documentos anexados, Lançamentos Financeiros, Histórico de Comunicações e Atividades vinculadas.
  - Tags de segmentação, responsável pelo atendimento e próximos passos comerciais.

---

## 10. FASE 7 — ATIVIDADES E GESTÃO DE TRABALHOS EM ANDAMENTO

- **Objetivo**: Transformar o módulo de Atividades em uma central ágil de tarefas operacionais.
- **Funcionalidades**:
  - Gestão de status: *Não iniciado, Em andamento, Aguardando terceiro, Bloqueado, Em revisão, Concluído, Cancelado*.
  - Vínculo obrigatório com Projetos, Clientes ou Orçamentos.
  - Alertas visuais de proximidade de vencimento e atrasos.

---

## 11. FASE 8 — CONFIGURAÇÕES E PERSONALIZAÇÃO SEGURA

- **Objetivo**: Permitir personalização de preferências de trabalho sem comprometer o design system *Liquid Glass* ou a identidade visual da HRX Solutions.
- **Opções Permitidas**: Densidade da interface, atalhos rápidos e preferências locais do PWA.

---

## 12. FASE 9 — CENTRAL DE DOCUMENTOS AVANÇADA

- **Objetivo**: Aprimorar a biblioteca documental da interface sem transferir o usuário para o GitHub.
- **Funcionalidades**:
  - Filtros multifatoriais (por Cliente, Projeto, Categoria, Data e Status).
  - Versionamento explícito de arquivos com checksum de integridade.
  - Visualização embutida segura de PDFs e relatórios.

---

## 13. FASE 10 — OBSERVABILIDADE E PAINEL DE SAÚDE OPERACIONAL

- **Objetivo**: Monitoramento centralizado da integridade dos serviços do HRX Solutions.
- **Métricas**:
  - Taxa de sucesso de Edge Functions e autenticações AAL2.
  - Monitoramento de cotas de Storage e integridade de deploys no GitHub Pages.
  - Alertas automáticos para erros críticos de backend.

---

## 14. FASE 11 — SEGURANÇA CONTÍNUA E AUDITORIA PERIÓDICA

- **Diretrizes Permanentes**:
  - Revisão de RLS e validação de AAL2 a cada nova migration.
  - Zero exposição de chaves privadas ou service-role no frontend.
  - Execução rotineira dos Security e Performance Advisors do Supabase.

---

## 15. FASE 12 — PWA FUTURO (PUSH NOTIFICATIONS E ESCRITA OFFLINE)

- **Objetivo**: Evolução para push notifications nativas via Web Push API e fila de escrita offline com criptografia e resolução de conflitos.
- **Regra de Segurança**: Dados administrativos altamente confidenciais não devem ser cacheados em texto plano em dispositivos compartilhados.

---

## 16. TABELA MESTRA DE FASES E ROADMAP

| ID | FASE | ITEM / ESCOPO | PRIORIDADE | DEPENDÊNCIA | STATUS | BRANCH / COMMIT | DOCUMENTAÇÃO ASSOCIADA |
|---|---|---|---|---|---|---|---|
| **F-00** | Fase 0 | Correção Documental de Fechamento e Rastreabilidade | P0 | Nenhuma | **CONCLUÍDO** | main (7421cd8) | 2026-08-24_HRX_RELATORIO-FINAL-MERGE-DEPLOY-HOMOLOGACAO_V01.md |
| **F-01** | Fase 1 | Homologação Autenticada Real em Produção | P0 | Credenciais/TOTP | **EM ANDAMENTO** | main | 2026-08-24_HRX_HOMOLOGACAO-PRODUCAO_V01.md |
| **F-02** | Fase 2 | Governança LGPD e Matriz de Tratamento | P1 | Decisão Diretoria | **DOCUMENTADO** | main | 2026-08-24_HRX_GOVERNANCA-LGPD_V01.md |
| **F-03** | Fase 3 | Financeiro + Fiscal (NF-e, Recorrências e Perfil Contábil) | P1 | Fase 1 | **PLANEJADO** | feat/financeiro-fiscal-v1 | 2026-08-24_HRX_ESPECIFICACAO-FISCAL-NFE_V01.md |
| **F-04** | Fase 4 | E-mail Transacional no Backend (Edge Function / DNS) | P2 | DNS / Provedor | **PLANEJADO** | feat/email-transacional-v1 | 2026-08-24_HRX_ARQUITETURA-EMAIL-TRANSACIONAL_V01.md |
| **F-05** | Fase 5 | WhatsApp Business API (Meta Cloud API) | P2 | Conta Meta | **PLANEJADO** | feat/whatsapp-business-api | 2026-08-24_HRX_ARQUITETURA-WHATSAPP-BUSINESS_V01.md |
| **F-06** | Fase 6 | CRM 360° de Clientes | P2 | Fase 3 | **PLANEJADO** | feat/crm-360-clientes | 2026-08-24_HRX_ESPECIFICACAO-CRM-360_V01.md |
| **F-07** | Fase 7 | Central de Atividades e Trabalhos em Andamento | P2 | Fase 6 | **PLANEJADO** | feat/atividades-operacionais | 2026-08-24_HRX_ESPECIFICACAO-ATIVIDADES_V01.md |
| **F-08** | Fase 8 | Configurações e Preferências Seguras | P3 | Fase 1 | **PLANEJADO** | feat/configuracoes-seguras | 2026-08-24_HRX_CONFIGURACOES-PREFERENCIAS_V01.md |
| **F-09** | Fase 9 | Central de Documentos Avançada | P3 | Fase 3 | **PLANEJADO** | feat/documentos-filtros-avancados | 2026-08-24_HRX_DOCUMENTOS-AVANCADOS_V01.md |
| **F-10** | Fase 10 | Observabilidade e Painel de Saúde | P3 | Fase 4/5 | **PLANEJADO** | feat/observabilidade-saude | 2026-08-24_HRX_OBSERVABILIDADE-SAUDE_V01.md |
| **F-11** | Fase 11 | Segurança Contínua e Hardening de RLS | Contínua | Todas | **CONTÍNUA** | main | 2026-08-23_HRX_AUDITORIA-BANCO-SUPABASE_V01.md |
| **F-12** | Fase 12 | PWA Futuro (Push Notifications e Escrita Offline) | P3 | Fase 7 | **BACKLOG** | feat/pwa-push-offline | 2026-08-24_HRX_PWA-PUSH-OFFLINE_V01.md |

---

## 17. CRITÉRIOS DE ACEITE E DEFINITION OF DONE

Para que qualquer fase do roadmap seja considerada concluída, os seguintes requisitos são mandatórios:
1. Código implementado em branch dedicada, testado localmente com 100% de aprovação na suíte de testes (
pm run test:pwa e 
px playwright test).
2. Migrations aditivas, idempotentes e versionadas em supabase/migrations/, sem quebra de dados existentes.
3. RLS e validações AAL2 aplicadas e auditadas em todas as novas tabelas e RPCs.
4. Pull Request criada com descrição detalhada e validação verde em todos os workflows de CI remotos.
5. Merge realizado em main e deploy validado em produção (https://hrxsolutions.com.br).
6. Documento canônico correspondente redigido e arquivado em DOCUMENTOS/.

---

## 18. SEQUÊNCIA DE IMPLEMENTAÇÃO E PRÓXIMA FASE

A ordem mandatória de execução inicia-se pela **Fase 1 (Homologação Real em Produção)** e evolui imediatamente para a **Fase 3 (Financeiro + Fiscal)** como a principal frente de engenharia de software da HRX Solutions.

**STATUS: APROVADO E EM VIGÊNCIA**
