# AUDITORIA DO BANCO DE DADOS SUPABASE
**Projeto**: HRX Solutions  
**Project ID**: 	gcdkofplegmjvvkheyd  
**Região**: sa-east-1  
**URL Canônica**: https://tgcdkofplegmjvvkheyd.supabase.co  
**Data**: 2026-08-24  
**Versão**: V01  
**Status**: RECONCILIADO E ENDURECIDO  
**Repositório Canônico**: lanhenrique/HRX-SOLUCOES  

---

## 1. RESUMO DA INFRAESTRUTURA DE DADOS

O backend de dados da HRX Solutions opera sobre o PostgreSQL gerenciado do Supabase, implementando:
1. **Row Level Security (RLS)** ativo em 100% das tabelas.
2. **Autenticação com MFA/AAL2 obrigatório** para todas as operações administrativas e fiscais.
3. **Imutabilidade Estrita** de propostas aprovadas (quote_versions) e trilha de auditoria financeira (inancial_audit_log).
4. **Armazenamento Privado** de documentos no bucket hrx-documents com URLs assinadas temporárias.

---

## 2. MATRIZ DE TABELAS, RLS E CONTROLE DE ACESSO

| TABELA | FINALIDADE | CHAVE PRIMÁRIA | ÍNDICES PRINCIPAIS | POLICIES RLS | GRANTS PERMITIDOS | TRIGGERS / REGRAS |
|---|---|---|---|---|---|---|
| dmin_users | Cadastro de administradores e roles | user_id (UUID) | 
ole_idx | AAL2 / Self-admin | SELECT (Authenticated) | Protegido por allowlist |
| clients | Carteira de clientes cadastrados | id (UUID) | document_idx, 
ame_idx | Restrictive Admin AAL2 | SELECT, INSERT, UPDATE | Auto-catalogação via RPC |
| quote_requests | Demandas e solicitações de orçamento | id (UUID) | client_id_idx, created_at_idx | Public Intake / Admin AAL2 | INSERT (Anon), ALL (Admin) | Geração de protocolo sequencial |
| pricing_rules | Catálogo e regras de precificação base | id (UUID) | service_key_idx | Read-only Public / Admin AAL2 | SELECT (Anon/Auth) | Precisão em centavos |
| quote_drafts | Rascunhos operacionais de propostas | id (UUID) | 
equest_id_idx, status_idx | Admin AAL2 | SELECT (Admin) / Mutations via RPC | Proteção contra exclusão de versionados |
| quote_items | Itens e serviços vinculados ao rascunho | id (UUID) | draft_id_idx | Admin AAL2 | Mutations via Edge Function | Precisão em centavos e unidades |
| quote_versions | Snapshots imutáveis de propostas geradas | id (UUID) | 
equest_id_idx, ersion_idx | Admin AAL2 (Read-only) | SELECT (Admin) / INSERT via Edge Function | **Imutabilidade**: UPDATE e DELETE bloqueados |
| quote_payment_installments | Cronograma de parcelas comerciais | id (UUID) | draft_id_idx, due_date_idx | Admin AAL2 | Mutations via Edge Function | Vínculo com Contas a Receber |
| quote_audit_log | Histórico e trilha de eventos comerciais | id (UUID) | 
equest_id_idx, created_at_idx | Admin AAL2 | INSERT via RPC / Edge Function | Append-only |
| hrx_documents | Metadados da Central de Documentos | id (UUID) | client_id_idx, checksum_idx | Restrictive Admin AAL2 | SELECT, INSERT (Admin) | Vínculo com Storage privado |
| inancial_accounts | Contas de liquidação financeira | id (UUID) | sort_order_idx | Admin AAL2 | SELECT, INSERT, UPDATE | Ordenação e status ativo |
| inancial_entries | Lançamentos de Contas a Receber/Pagar | id (UUID) | due_date_idx, 	ype_idx | Admin AAL2 | Mutations via Edge Function | Status efetivo derivado em leitura |
| inancial_settlements | Liquidações financeiras e baixas | id (UUID) | entry_id_idx, settled_at_idx | Admin AAL2 | Mutations via Edge Function | Suporte a estorno imutável (
eversed_at) |
| inancial_audit_log | Auditoria de baixas e estornos contábeis | id (UUID) | settlement_id_idx, ctor_idx | Admin AAL2 | INSERT (Edge Function) | **Append-only**: DELETE e UPDATE revogados |

---

## 3. RASTREABILIDADE DAS MIGRATIONS CANÔNICAS

Todas as 33 migrations versionadas em supabase/migrations/ foram catalogadas em ordem cronológica de execução:

1. 20260817023422_admin_manual_quotes_clients_suspensions.sql — Estrutura base de clientes manuais e suspensões.
2. 20260817023745_admin_quote_operations_rpc.sql — RPCs de operações comerciais.
3. 20260817023857_protect_suspended_quotes.sql — Proteção de orçamentos suspensos.
4. 20260817024233_index_admin_operations_foreign_keys.sql — Índices em chaves estrangeiras.
5. 20260817024618_fix_admin_operation_authorization.sql — Ajuste de autorização em RPCs.
6. 20260817024716_allow_suspended_quote_status.sql — Suporte a status suspenso.
7. 20260817024849_auto_catalog_quote_clients.sql — Auto-catalogação de clientes por propostas.
8. 20260817151020_client_fiscal_profiles.sql — Perfis fiscais de clientes.
9. 20260817151800_index_client_fiscal_manual_confirmer.sql — Índice de confirmação fiscal.
10. 20260817152700_harden_admin_bootstrap_tokens.sql — Hardening de tokens de primeiro acesso.
11. 20260817160000_sync_quote_clients_manual_state_registration.sql — Sincronização de Inscrição Estadual.
12. 20260817162226_fix_state_registration_rpc_authorization.sql — Autorização de RPC de IE.
13. 20260817173100_quote_fiscal_engine_by_service_code.sql — Motor de regras fiscais por código de serviço.
14. 20260817173600_auto_apply_quote_fiscal_engine_on_save.sql — Aplicação automática no salvamento.
15. 20260818035000_require_aal2_for_fiscal_engine.sql — Exigência de AAL2 para o motor fiscal.
16. 20260818040727_restrict_fiscal_engine_rpc_execution.sql — Restrição de execução de RPCs fiscais.
17. 20260818040754_require_aal2_for_fiscal_admin_rpcs.sql — AAL2 obrigatório em todas as RPCs administrativas.
18. 20260818135457_hrx_document_center_storage.sql — Central de Documentos e Storage.
19. 20260818140154_optimize_hrx_document_rls.sql — Otimização de performance de RLS em documentos.
20. 20260818140311_use_auth_jwt_for_document_aal2.sql — Uso de JWT no AAL2 de documentos.
21. 20260818153107_add_document_checksum_uniqueness.sql — Unicidade de checksum para evitar duplicidade.
22. 20260818205800_add_financial_ledger_v1.sql — Ledger financeiro básico.
23. 20260823203057_quote_commercial_lifecycle.sql — Ciclo de vida comercial e status canônicos.
24. 20260823203211_optimize_quote_commercial_lifecycle.sql — Otimização e índices de ciclo de vida.
25. 20260823204142_harden_quote_version_immutability.sql — Imutabilidade física de versões de propostas.
26. 20260823204215_restrict_quote_table_grants.sql — Revogação de grants diretos de escrita para authenticated.
27. 20260823213838_allow_admin_delete_unversioned_draft_quotes.sql — Exclusão segura de rascunhos não versionados.
28. 20260823224500_finance_receivables_phase1.sql — Contas a Receber e liquidações.
29. 20260823225500_finance_receivables_phase1_hardening.sql — Hardening do Contas a Receber.
30. 20260823230500_preserve_negotiated_final_amount.sql — Preservação de valores negociados com AAL2.
31. 20260824003000_finance_payables_phase2.sql — Contas a Pagar e fluxo previsto.
32. 20260824124000_finance_reversal_audit_topic2.sql — Estorno imutável e trilha de auditoria financeira.
33. 20260824125500_finance_reversal_audit_advisor_fix.sql — Índices de FK e otimização de validação JWT.

---

## 4. STORAGE PRIVADO — BUCKET hrx-documents

- **Nível de Acesso**: Privado (sem acesso público anônimo).
- **Políticas**:
  - SELECT: Apenas usuários com dmin_users e al = 'aal2' ou via URLs assinadas geradas no backend.
  - INSERT: Somente administradores autenticados com AAL2 ou Edge Functions via service role.
- **Expiração de Links Assinados**: 604.800 segundos (7 dias).

---

## 5. RECONCILIAÇÃO E MATRIZ DE DRIFT

| OBJETO | REPOSITÓRIO (GIT) | PRODUÇÃO (SUPABASE) | DRIFT DETECTADO | AÇÃO EXECUTADA |
|---|---|---|---|---|
| Schemas e Tabelas | 14 tabelas modeladas | 14 tabelas ativas | Nenhum | Reconciliado e verificado. |
| Migrations | 33 arquivos versionados | 33 aplicadas | Nenhum | Sincronia 100% confirmada. |
| RLS Policies | 100% RESTRICTIVE AAL2 | 100% ativas | Nenhum | Grants e policies preservados. |
| Edge Functions | 5 funções declaradas | 5 implantadas | Nenhum | Código-fonte auditado no repositório. |
