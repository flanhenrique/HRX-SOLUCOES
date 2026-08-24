# GOVERNANÇA LGPD E MATRIZ DE TRATAMENTO DE DADOS
**Projeto**: HRX Solutions — HRX Admin PWA  
**Data**: 2026-08-24  
**Versão**: V01  
**Status**: BLOQUEADO EXTERNAMENTE — REQUER DECISÃO ADMINISTRATIVA/JURÍDICA  
**Repositório Canônico**: flanhenrique/HRX-SOLUCOES  

---

## 1. RESUMO DE CONFORMIDADE

A plataforma HRX Solutions adota medidas técnicas e organizacionais de segurança para proteção de dados pessoais em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

---

## 2. MATRIZ DE TRATAMENTO DE DADOS PESSOAIS

| TIPO DE DADO | FINALIDADE | BASE LEGAL (LGPD) | ORIGEM | RETENÇÃO | ACESSO | DESCARTE | RESPONSÁVEL |
|---|---|---|---|---|---|---|---|
| Dados Cadastrais de Clientes (Nome, CPF/CNPJ, E-mail, Telefone, Endereço) | Emissão de propostas comerciais e faturamento fiscal | Art. 7, V (Execução de contrato) e Art. 7, II (Obrigação legal) | Formulário público de intake e cadastro manual | Período de vigência comercial + 5 anos fiscais | Administradores autenticados com AAL2 | Exclusão lógica com anonimização | Administrador HRX |
| Credenciais e E-mails de Administradores | Autenticação e controle de acesso administrativo | Art. 7, V (Execução de contrato) | Cadastro de usuários pelo Supabase Auth | Enquanto durar o vínculo administrativo | Sistema de Auth / Próprio usuário | Revogação imediata e exclusão da conta | Gestor de Acessos HRX |
| Logs de Auditoria e Acesso | Rastreabilidade de mutações financeiras e comerciais | Art. 7, II (Cumprimento de obrigação legal) | Sistema automatizado de banco de dados | 5 anos para fins probatórios contábeis | Somente leitura via AAL2 | Arquivamento histórico imutável | Encarregado / Auditoria |

---

## 3. STATUS DA NOMEAÇÃO DO ENCARREGADO (DPO)

A definição formal do Encarregado pelo Tratamento de Dados Pessoais (DPO) encontra-se pendente de deliberação pela diretoria executiva da HRX Solutions.

**Classificação**: BLOQUEADO EXTERNAMENTE — REQUER DECISÃO ADMINISTRATIVA/JURÍDICA
