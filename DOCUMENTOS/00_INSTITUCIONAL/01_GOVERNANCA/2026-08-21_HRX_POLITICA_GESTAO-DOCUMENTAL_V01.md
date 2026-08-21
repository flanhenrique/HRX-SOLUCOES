# Política Geral de Gestão Documental — HRX Solutions

**Código:** HRX-GOV-DOC-001  
**Versão:** 1.0  
**Data:** 21/08/2026  
**Status:** Vigente  
**Abrangência:** Todos os projetos atuais e futuros da HRX Solutions

## 1. Objetivo

Estabelecer uma regra única e obrigatória para criação, armazenamento, atualização e rastreabilidade de documentos produzidos no contexto dos projetos da HRX Solutions.

## 2. Regra geral

Todo documento relacionado a um projeto deve ser armazenado na respectiva pasta dentro da **HRX SOLUTIONS — Central de Documentos**.

A regra se aplica independentemente de onde o documento tenha sido produzido, incluindo:
- ChatGPT;
- Codex;
- ferramentas de desenvolvimento;
- processos de auditoria e QA;
- rotinas administrativas;
- atividades técnicas, comerciais ou operacionais.

Nenhum documento de projeto deve existir apenas em uma conversa, sessão de agente, pasta temporária, diretório local ou repositório operacional sem sua versão oficial na Central de Documentos.

## 3. Documentos abrangidos

A política inclui, entre outros:
- requisitos e escopos;
- especificações funcionais e técnicas;
- arquitetura e diagramas;
- regras de negócio;
- auditorias;
- checklists;
- atas e registros de decisão;
- relatórios;
- manuais e procedimentos;
- documentação de banco de dados;
- documentação de APIs e integrações;
- documentação de deploy e infraestrutura;
- testes, QA, homologação e evidências;
- documentação fiscal e operacional;
- documentação destinada ao cliente;
- planos de implementação e manutenção;
- históricos relevantes de alteração.

## 4. Estrutura oficial

A Central de Documentos utiliza a estrutura principal:

- `00_INSTITUCIONAL` — documentos da HRX Solutions e governança;
- `01_CLIENTES` — documentação organizada por cliente e projeto;
- `02_MODELOS` — modelos reutilizáveis;
- `03_PROJETOS_INTERNOS` — projetos internos;
- `04_COMERCIAL` — propostas e materiais comerciais;
- `05_FINANCEIRO` — documentos financeiros;
- `06_JURIDICO` — documentos jurídicos;
- `99_ARQUIVO` — documentos históricos ou descontinuados.

Dentro de cada cliente ou projeto, deve-se reutilizar a estrutura existente antes de criar novas categorias.

## 5. Identificação e versionamento

O padrão preferencial de nome de arquivo é:

`AAAA-MM-DD_CLIENTE-OU-PROJETO_TIPO_DESCRICAO_VNN.ext`

Exemplo:

`2026-08-21_HRX_POLITICA_GESTAO-DOCUMENTAL_V01.md`

Sempre que aplicável, o documento deve registrar data, versão, status e projeto de origem.

## 6. Atualização de documentos existentes

Antes da criação de um novo arquivo, deve ser verificado se já existe documento equivalente. Se o novo conteúdo representar apenas evolução, correção ou complemento de um artefato já existente, deve-se atualizar a versão correspondente em vez de criar duplicidade.

## 7. Regra para ChatGPT e Codex

### ChatGPT

Sempre que uma atividade resultar em documentação de projeto, a conclusão deve considerar o arquivamento na Central de Documentos como etapa obrigatória.

### Codex

Todo agente que atuar nos repositórios da HRX Solutions deve tratar esta política como parte da definição de pronto. Uma tarefa que gere documentação não está concluída enquanto o documento oficial não estiver armazenado na Central de Documentos.

## 8. Definition of Done documental

Uma atividade documental somente pode ser encerrada quando:

1. o projeto estiver identificado;
2. a categoria documental estiver definida;
3. o documento estiver armazenado no local correto da Central de Documentos;
4. data e versão estiverem registradas quando aplicável;
5. o controle ou índice documental do projeto estiver atualizado quando existir;
6. não houver credenciais ou informações indevidas para um repositório público.

## 9. Segurança

A Central de Documentos mantida neste repositório é pública. É proibido armazenar:
- senhas;
- tokens;
- chaves de API;
- credenciais;
- segredos de infraestrutura;
- dados pessoais sensíveis;
- documentos cuja publicação não tenha sido autorizada.

Quando um documento contiver dados restritos, a Central deve registrar apenas a referência, classificação ou versão sanitizada apropriada, conforme a arquitetura de armazenamento seguro adotada pelo projeto.

## 10. Fonte oficial

A **HRX SOLUTIONS — Central de Documentos** passa a ser a fonte oficial de documentação dos projetos da HRX Solutions.

Código-fonte permanece nos respectivos repositórios de desenvolvimento. Documentação oficial permanece vinculada à Central de Documentos.
