# GOVERNANÇA LGPD E MATRIZ DE TRATAMENTO DE DADOS
**Projeto**: HRX Solutions — HRX Admin PWA  
**Data**: 2026-08-24  
**Versão**: V01  
**Status**: PROPOSTA DE GOVERNANÇA — REQUER VALIDAÇÃO JURÍDICA  
**Repositório Canônico**: `flanhenrique/HRX-SOLUCOES`  

---

## 1. RESUMO DE CONFORMIDADE

A plataforma HRX Solutions adota medidas técnicas e organizacionais de segurança para proteção de dados pessoais em conformidade com as diretrizes da Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

---

## 2. MATRIZ DE TRATAMENTO DE DADOS PESSOAIS (PROPOSTA TÉCNICA)

| TIPO DE DADO | FINALIDADE PROPOSTA | BASE LEGAL PROPOSTA | ORIGEM | RETENÇÃO ESTIMADA | ACESSO | DESCARTE PROPOSTO | RESPONSABILIDADE |
|---|---|---|---|---|---|---|---|
| Dados Cadastrais de Clientes (Nome, CPF/CNPJ, E-mail, Telefone, Endereço) | Emissão de propostas comerciais e faturamento fiscal | Art. 7, V (Execução de contrato) e Art. 7, II (Obrigação legal) | Formulário público de intake e cadastro manual | Vigência comercial + prazo legal fiscal a validar | Administradores autenticados com AAL2 | Exclusão lógica com anonimização | Gestão Comercial / Diretoria |
| Credenciais e E-mails de Administradores | Autenticação e controle de acesso administrativo | Art. 7, V (Execução de contrato de trabalho/prestação) | Cadastro de usuários pelo Supabase Auth | Enquanto durar o vínculo administrativo | Sistema de Auth / Próprio usuário | Revogação imediata e exclusão da conta | Gestor de Acessos HRX |
| Logs de Auditoria e Acesso | Rastreabilidade de mutações financeiras e comerciais | Art. 7, II (Cumprimento de obrigação legal) | Sistema automatizado de banco de dados | Prazo probatório contábil a validar | Somente leitura via AAL2 | Arquivamento histórico imutável | Encarregado / Auditoria |

> **Nota de Governança**: Os prazos de retenção e bases legais acima constituem uma **Proposta de Governança Técnica** e requerem validação e homologação jurídica formal pela diretoria ou assessoria jurídica da HRX Solutions.

---

## 3. STATUS DA NOMEAÇÃO DO ENCARREGADO (DPO)

A definição formal do Encarregado pelo Tratamento de Dados Pessoais (DPO) encontra-se pendente de deliberação executiva pela diretoria da HRX Solutions.

**Classificação**: `BLOQUEADO EXTERNAMENTE — REQUER DECISÃO ADMINISTRATIVA/JURÍDICA`
