# AGENTS.md — HRX Solutions

## Regra obrigatória de governança documental

Esta instrução se aplica a todo trabalho executado por Codex ou qualquer agente de desenvolvimento neste repositório e deve ser tratada como parte da definição de concluído.

### Central de Documentos

Todo documento relacionado a um projeto deve ser criado, atualizado e arquivado em `DOCUMENTOS/`, na pasta correspondente ao projeto e à categoria documental.

Nenhum documento de projeto pode ficar apenas em:
- conversa do ChatGPT;
- sessão do Codex;
- arquivo temporário;
- pasta local;
- pasta solta do repositório fora de `DOCUMENTOS/`;
- issue, PR ou comentário sem cópia documental quando o conteúdo constituir documentação de projeto.

### Abrangência

A regra inclui, entre outros: requisitos, escopos, especificações, arquitetura, fluxos, regras de negócio, auditorias, checklists, relatórios, manuais, procedimentos, planos, documentação de banco de dados, APIs, deploy, segurança, testes, QA, homologação, atas, documentos fiscais, documentação operacional, evidências de entrega e documentação destinada ao cliente.

### Destino

Usar a estrutura existente:
- `DOCUMENTOS/00_INSTITUCIONAL/` — governança e documentos da HRX Solutions;
- `DOCUMENTOS/01_CLIENTES/<CLIENTE>/` — documentação de clientes e seus projetos;
- `DOCUMENTOS/02_MODELOS/` — modelos reutilizáveis;
- `DOCUMENTOS/03_PROJETOS_INTERNOS/` — projetos internos da HRX;
- `DOCUMENTOS/04_COMERCIAL/` — materiais comerciais;
- `DOCUMENTOS/05_FINANCEIRO/` — documentação financeira;
- `DOCUMENTOS/06_JURIDICO/` — documentação jurídica;
- `DOCUMENTOS/99_ARQUIVO/` — materiais históricos ou descontinuados.

Para clientes, respeitar a estrutura interna já existente antes de criar novas categorias. Se não houver pasta apropriada, criar uma categoria clara e consistente dentro da pasta do cliente.

### Nome de arquivo

Preferir o padrão:

`AAAA-MM-DD_CLIENTE-OU-PROJETO_TIPO_DESCRICAO_VNN.ext`

Exemplo:

`2026-08-21_HRX_POLITICA_GESTAO-DOCUMENTAL_V01.md`

### Atualização x duplicação

Antes de criar um documento novo, verificar se existe documento equivalente. Quando for evolução do mesmo artefato, atualizar a versão ou o documento existente em vez de gerar duplicidade desnecessária.

### Definition of Done

Uma atividade que produza documentação só pode ser considerada concluída quando:
1. o projeto estiver identificado;
2. a categoria documental estiver definida;
3. o documento estiver salvo em `DOCUMENTOS/` no local correto;
4. versão/data estiverem registradas quando aplicável;
5. o índice ou controle documental do projeto for atualizado quando existir.

### Segurança

O repositório é público. Nunca armazenar senhas, tokens, chaves de API, segredos, credenciais, dados pessoais sensíveis ou qualquer informação que não possa ser publicada.

## Prioridade

Se uma instrução de tarefa solicitar que um documento seja criado fora da Central de Documentos, criar o artefato operacional onde necessário, mas manter a versão documental oficial também em `DOCUMENTOS/`. A Central de Documentos é a fonte oficial de documentação da HRX Solutions.
