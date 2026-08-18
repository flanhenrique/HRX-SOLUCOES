# Auditoria do HRX Admin

**Data:** 17/08/2026  
**Escopo:** aplicativo administrativo/PWA da HRX Solutions  
**Objetivo:** segurança, autenticação, arquitetura de navegação, experiência mobile/iPhone, qualidade visual, Central de Documentos e governança técnica.

## Resumo executivo

O HRX Admin possui boa base funcional, mas cresceu por adição sucessiva de módulos sobre a tela original de Orçamentos. A principal dívida não é falta de funcionalidades; é falta de uma arquitetura única de aplicativo. Operações, documentos, fiscal, painéis e configurações foram adicionados por componentes independentes e portals, o que aumenta competição por espaço, sobreposição de controles e inconsistência de comportamento — principalmente em iPhone/PWA.

A prioridade é estabilizar segurança e navegação antes de adicionar novos módulos.

## Achados críticos

### 1. MFA não era obrigatório
**Severidade: CRÍTICA**

O login existente aceitava e-mail e senha e liberava a interface com sessão autenticada, sem exigir AAL2. Isso não atende ao nível de proteção esperado para um backoffice que concentra dados comerciais, fiscais e documentais.

**Correção aplicada:**
- gate de MFA real por TOTP;
- cadastro do fator por QR Code/chave manual;
- desafio de 6 dígitos compatível com Google Authenticator;
- liberação da interface somente após sessão AAL2 no cliente;
- novo fluxo visual de login e verificação em duas etapas.

**Pendência de hardening:** exigir AAL2 também em todas as funções administrativas do backend, para impedir acesso direto via API com uma sessão AAL1.

### 2. Função SECURITY DEFINER exposta a authenticated
**Severidade: ALTA**

O advisor de segurança do Supabase identificou `public.hrx_calculate_quote_fiscal(uuid, boolean)` como `SECURITY DEFINER` executável pelo papel `authenticated`. A função possui checagem de administrador, mas o desenho deve ser endurecido para exigir também nível de autenticação adequado e princípio de menor privilégio.

**Ação recomendada:** revisar ACL, mover operações privilegiadas para superfície administrativa controlada ou incluir validação explícita de AAL2 antes da execução.

### 3. Proteção nativa contra senhas vazadas desativada
**Severidade: ALTA**

O advisor do Supabase indica `Leaked Password Protection` desativado.

**Ação recomendada:** habilitar a proteção no Auth, mantendo também a validação própria já utilizada no fluxo administrativo.

## Arquitetura de interface

### 4. Navegação construída por sobreposição de módulos
**Severidade: ALTA**

A tela base é `AdminQuotes`. Clientes, Suspensões, Central de Documentos, Fiscal, Painéis e Configurações são montados como camadas independentes e vários deles injetam botões via React Portal na mesma navegação.

**Efeito observado:**
- excesso de ações concorrentes;
- hierarquia pouco intuitiva;
- risco de sobreposição de botões;
- modais de tela cheia com comportamentos diferentes;
- dificuldade de manter consistência entre desktop e mobile.

**Correção de estabilização aplicada:** no mobile, a barra inferior foi reduzida conceitualmente a **Solicitações / Orçamento / Menu**. Ações secundárias passam para um menu único, incluindo Clientes, Suspensões, Central de Documentos, Painéis e Configurações.

**Refatoração recomendada:** substituir progressivamente portals de navegação por um único `AdminAppShell`, com estado/roteamento central e views nativas.

## iPhone e PWA

### 5. Área segura e fechamento de painéis
**Severidade: ALTA**

Painéis de tela cheia podiam extrapolar a viewport e deixar ações de fechamento pouco acessíveis em iPhone.

**Correções já aplicadas:**
- `safe-area-inset-*`;
- botão de fechar em zona segura;
- limitação de largura;
- rolagem vertical controlada;
- espaço inferior para navegação PWA;
- abas horizontais roláveis em telas estreitas.

### 6. Barra inferior congestionada
**Severidade: ALTA**

A barra recebia botões do fluxo de orçamento e botões injetados por módulos adicionais.

**Correção aplicada:** ações secundárias removidas da barra e centralizadas no Menu.

## Central de Documentos HRX

### 7. Conceito de “repositório” confundia documentação com GitHub
**Severidade: ALTA para usabilidade**

O usuário era levado à árvore `DOCUMENTOS` do repositório de código. Isso expunha uma implementação técnica no lugar de oferecer uma experiência documental.

**Correção aplicada:**
- renomeação para **Central de Documentos HRX**;
- navegação interna por áreas;
- remoção do GitHub como destino principal;
- estrutura para Institucional, Clientes, Modelos, Projetos Internos, Comercial, Financeiro, Jurídico/Contratos e Arquivo;
- visão específica de análise contratual.

### 8. Central ainda não é um GED completo
**Severidade: MÉDIA/ALTA**

A interface organiza conceitos, mas o próximo nível exige persistência documental real e metadados pesquisáveis.

**Arquitetura recomendada:**
- armazenamento de binários em storage privado;
- catálogo de documentos em banco;
- ID documental estável;
- cliente/projeto/tipo/subtipo;
- versão e status;
- data do documento, vencimento e responsável;
- tags e indexação;
- checksum/integridade;
- trilha de auditoria;
- permissões por papel;
- campos contratuais estruturados: partes, objeto, valor, vigência, renovação, obrigações, multa, rescisão, confidencialidade, LGPD e assinaturas.

## Qualidade visual

### 9. Linguagem visual fragmentada
**Severidade: MÉDIA**

O backoffice principal é claro e compacto; Painéis possui linguagem escura própria; autenticação também utiliza dark mode; Central de Documentos usa outra composição clara. Essa diferença pode ser intencional por contexto, mas hoje parece mudança de produto em vez de mudança de módulo.

**Diretriz:** consolidar tokens de cor, raio, espaçamento, tipografia, estados, cabeçalhos, botões, sheets e dialogs em um design system administrativo único.

### 10. Densidade e priorização
**Severidade: MÉDIA**

Algumas telas exibem métricas, navegação e ações de atualização simultaneamente sem distinguir ação primária de utilitária.

**Correção parcial aplicada:** simplificação de ações mobile e redução de redundância de atualização na barra inferior.

## Usabilidade e acessibilidade

### 11. Comportamento de dialogs não é uniforme
**Severidade: MÉDIA**

Os módulos usam overlays e dialogs distintos. Ainda falta padronizar:
- fechamento por Escape quando aplicável;
- foco inicial;
- retenção de foco dentro de modal;
- retorno de foco ao acionador;
- gesto/ação de voltar no mobile;
- prevenção consistente de scroll da tela de fundo.

### 12. Estados de carregamento
**Severidade: MÉDIA**

Alguns estados usam apenas texto (“Validando acesso…”, “Carregando…”), reduzindo percepção de qualidade e feedback.

**Correção iniciada:** MFA ganhou estados de verificação visualmente explícitos. Recomenda-se aplicar skeleton/progress aos demais módulos.

## Face ID / passkeys

Face ID não deve ser simulado por um botão. Em web/PWA no iPhone, a direção correta é uma credencial WebAuthn/passkey que pode ser autorizada pela biometria do dispositivo. Essa camada deve ser tratada como evolução separada após estabilização do TOTP/AAL2.

## Prioridades de execução

### P0 — segurança e acesso
1. MFA TOTP obrigatório no cliente — **aplicado**.
2. Exigir AAL2 nas APIs administrativas — **em hardening**.
3. Habilitar proteção de senhas vazadas no Supabase Auth — **pendente**.
4. Revisar `SECURITY DEFINER` e privilégios — **pendente**.

### P1 — experiência do aplicativo
1. Barra mobile simplificada — **aplicado**.
2. Menu único para módulos secundários — **aplicado**.
3. Safe areas e fechamento de Painéis — **aplicado**.
4. Unificar dialogs, overlays e navegação — **próxima refatoração**.

### P1 — documentos
1. Central interna em vez de GitHub — **aplicado**.
2. Taxonomia e visão contratual — **aplicado na interface**.
3. Storage privado + catálogo/indexação persistente — **próxima fase**.

### P2 — acabamento
1. Design system administrativo.
2. Acessibilidade/foco/teclado.
3. Estados de carregamento e empty states.
4. Passkey/Face ID.

## Critério de aceite para a próxima versão

A próxima versão do HRX Admin só deve ser considerada estabilizada quando:
- usuário não autenticado vê login;
- senha correta não libera o backoffice sem 2FA;
- sessão AAL1 não acessa APIs administrativas sensíveis;
- iPhone não apresenta overflow horizontal;
- barra inferior possui no máximo três destinos claros;
- todo overlay crítico pode ser fechado sem depender de área fora da viewport;
- Central de Documentos não redireciona o fluxo normal para GitHub;
- navegação possui hierarquia única e previsível;
- build e testes de fluxo crítico passam antes da publicação.
