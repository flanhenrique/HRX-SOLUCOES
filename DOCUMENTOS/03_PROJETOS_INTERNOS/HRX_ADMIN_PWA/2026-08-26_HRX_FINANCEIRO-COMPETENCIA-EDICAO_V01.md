# HRX Admin — Financeiro por competência e edição

Data: 26/08/2026  
Branch: `feature/reestrutura-visual-financeiro-20260826`  
Base recebida: `69d10735b9fadbedaf440ac65338b287417ea17c`  
Publicação: não executada.

## Diagnóstico

O Financeiro corporativo consultava até 800 lançamentos globais e os KPIs eram calculados sobre todo o ledger. A presença de `competence_date` não era acompanhada por um estado mensal central, contrato de API mensal ou navegação persistida. As ações de linha não ofereciam edição e o modelo visual não distinguia adequadamente lançamento único, parcela e ocorrência recorrente.

## Implementação local

- `selectedCompetence` controla URL, consulta, KPIs, listas e navegação anterior/próxima.
- O endpoint `finance-admin` recebe `?competence=YYYY-MM` e consulta o intervalo mensal no servidor.
- Pendências anteriores usam consulta e bloco visual separados.
- O frontend mantém uma proteção secundária mensal para clientes conectados temporariamente a uma função remota ainda não publicada.
- Parcelas de propostas passam a usar a competência do respectivo vencimento, com valor individual e total de parcelas explícito.
- Lançamentos distinguem `one_time`, `installment` e `recurrence_occurrence`.
- A edição valida AAL2/admin no endpoint, concorrência por `updated_at`, valor total maior ou igual ao pago, estado editável e competência aberta; registra antes/depois em `financial_audit_log`.
- Fechamento/reabertura possui estado mensal, bloqueio no banco, justificativa para reabrir e auditoria.
- A tabela foi reduzida às colunas operacionais e o mobile preserva cards/ações sem comprimir o desktop.
- A identidade clara iniciada no commit `f62e87a` foi preservada e refinada, sem novo shell.

## Evidências locais

- URL agosto: `/admin/financeiro?competencia=2026-08`.
- Avanço para setembro: `/admin/financeiro?competencia=2026-09`.
- Back do navegador restaurou agosto e o seletor `2026-08`.
- Viewports sem overflow horizontal: 1920×1080, 1440×900, 1366×768, 1024×768, 820×1180, 390×844, 393×852 e 430×932.
- `npm run test:pwa`: 93/93 aprovados.
- `npm run build`: aprovado, 128 módulos transformados.
- `git diff --check`: sem erros.

## Limites de homologação

A migração e a nova versão da Edge Function não foram publicadas, conforme proibição expressa. Por isso não foi possível homologar contra o backend remoto os cenários com dados controlados de agosto/setembro, parcelamento, recorrência, edição persistida, audit log e mês fechado. Nenhum dado pessoal ou financeiro fictício foi criado.

Também não foi iniciada a Fase B de padronização global: o Financeiro precisa primeiro passar pela homologação integrada após implantação em ambiente autorizado.

## Gate

| Critério | Estado |
|---|---|
| Seletor e URL de competência | CONCLUÍDO LOCALMENTE |
| Filtro e KPIs server-side | IMPLEMENTADO, AGUARDA IMPLANTAÇÃO |
| Parcelas futuras fora do mês | IMPLEMENTADO, AGUARDA DADOS DE HOMOLOGAÇÃO |
| Edição e auditoria | IMPLEMENTADO, AGUARDA HOMOLOGAÇÃO INTEGRADA |
| Fechamento e reabertura | IMPLEMENTADO, AGUARDA HOMOLOGAÇÃO INTEGRADA |
| Identidade visual e responsividade | APROVADO LOCALMENTE |
| Fase B global | PENDENTE |

MESES MISTURADOS: NÃO NO CLIENTE LOCAL; BACKEND REMOTO NÃO HOMOLOGADO  
PERÍODO: FUNCIONAL LOCALMENTE  
EDIÇÃO: IMPLEMENTADA, NÃO HOMOLOGADA NO BACKEND REMOTO  
KPIs POR COMPETÊNCIA: IMPLEMENTADOS, NÃO HOMOLOGADOS NO BACKEND REMOTO  
PARCELAS FUTURAS NO TOTAL DO MÊS: NÃO NO CÓDIGO LOCAL; CENÁRIO INTEGRADO PENDENTE  
IDENTIDADE VISUAL HRX: APROVADA LOCALMENTE  
HOMOLOGAÇÃO: REPROVADA  
PUBLICAÇÃO: BLOQUEADA
