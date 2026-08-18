# VOLT — Acervo documental na HRX Solutions

Esta pasta representa a coleção oficial do VOLT dentro da governança documental da HRX Solutions.

## Regra de acesso

A navegação deve acontecer pela **Central de Documentos da HRX**. O usuário não deve ser enviado para um repositório de código para consultar documentos. A aplicação pode consumir fontes técnicas controladas, mas a leitura é apresentada dentro do próprio aplicativo.

## Estrutura documental

1. **Governança e visão** — Constituição, visão do produto, catálogo mestre e documentos de autoridade.
2. **Arquitetura e decisões** — ADRs, arquitetura oficial, fundação de domínios e arquitetura responsiva.
3. **Produto e PRDs** — PRD-000 e PRDs específicos, preservando numeração, versão, status e histórico.
4. **Dados e segurança** — integridade, modelo de dados, privacidade, segurança e auditorias.
5. **Operações** — runbooks, observabilidade, deploy, rollback, incidentes e continuidade.
6. **Design e experiência** — sistema de design, UX, responsividade e relatórios de redesign.
7. **Relatórios e modelos** — relatórios executivos, artefatos de exportação e modelos aprovados.
8. **Histórico** — documentos substituídos, IDs não reutilizáveis e versões preservadas para rastreabilidade.

## Acervo técnico conectado na primeira integração

A Central HRX passa a apresentar, dentro do aplicativo, os seguintes documentos técnicos do projeto VOLT:

- `README.md`
- `ARCHITECTURE.md`
- `docs/VOLT-DOMAIN-FOUNDATION.md`
- `docs/VOLT-RESPONSIVE-ARCHITECTURE.md`
- `DATA_INTEGRITY_AUDIT.md`
- `FORENSIC_AUDIT_MATRIX.md`
- `FORENSIC_STABILIZATION_REPORT.md`
- `VOLT_LIQUID_GLASS_REDESIGN_REPORT.md`
- `docs/VOLT-LIQUID-GLASS-DESIGN-SYSTEM.md`
- `docs/runbooks/AUTH-MIGRATION-ROLLBACK-BETA.md`

## Acervo mestre controlado

PDFs oficiais, PRDs, ADRs, documentos normativos, relatórios e versões históricas devem ser incorporados ao bucket privado `hrx-documents`, na área `internal`, pasta `VOLT`. O storage privado continua sendo a fonte para arquivos que exigem AAL2, versionamento e classificação de acesso.

Documentos mestres identificados para a migração incluem, entre outros:

- `PRD-000 — Product Requirements Master`
- `ADR-000 — Architecture & Product Decision Records`
- `ARCH-001 — Arquitetura Oficial`
- PRDs específicos ativos e registros históricos de IDs não reutilizáveis
- relatórios executivos e documentos de auditoria

## Padrão de indexação do VOLT

Preferência para documentos normativos e técnicos:

`VOLT_CODIGO_DESCRICAO_VERSAO.ext`

Metadados mínimos:

- código documental;
- título;
- versão;
- status;
- categoria;
- responsável/owner quando aplicável;
- data-base ou vigência;
- classificação de acesso;
- relação com documento substituído ou histórico, quando houver.

## Regra de histórico

Versões substituídas e IDs históricos não devem ser apagados nem reutilizados. Devem permanecer rastreáveis e classificados como substituídos, arquivados ou históricos conforme a governança do documento de origem.
