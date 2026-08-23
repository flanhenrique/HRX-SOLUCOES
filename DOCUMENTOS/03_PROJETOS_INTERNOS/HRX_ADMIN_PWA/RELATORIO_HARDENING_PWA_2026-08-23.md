# HRX SOLUTIONS — RELATÓRIO DE HARDENING DO PWA ADMINISTRATIVO

**Data:** 23/08/2026  
**Projeto:** HRX Solutions — Admin PWA  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`  
**PR principal:** #64 — Hardening completo do HRX Admin PWA  
**Merge em `main`:** `c1dc87e179b7ec069ff6dd3a37669d9cf898730c`  
**Status:** implementado, integrado e validado em produção

## 1. Objetivo

Executar as correções prioritárias resultantes da auditoria técnica do HRX Admin PWA, preservando a identidade visual e o shell administrativo aprovados, sem criar um segundo aplicativo, sem sobreposição de shells e sem enfraquecer os controles de autenticação, MFA/AAL2, RLS ou autorização administrativa.

## 2. Resultado executivo

Os bloqueadores P0 e os principais riscos P1 foram corrigidos. O PWA passou a possuir viewport acessível, atualização atômica com tratamento real de falhas, arquitetura de notificações controlada por React, distinção entre runtime e classe de viewport, suporte a tablet/landscape, safe areas endurecidas e QA automatizado em navegador real.

A publicação foi validada externamente contra `https://hrxsolutions.com.br` por um teste temporário executado dentro do GitHub Actions. O teste confirmou que a produção já servia o manifest adaptativo, o viewport sem bloqueio de zoom, um build publicado diferente de `dev` e o novo Service Worker com timeout, concorrência limitada e ícone maskable.

## 3. Correções P0

### 3.1 Acessibilidade e viewport

Corrigido `src/quotes/adminAppShell.ts` e o pipeline de deploy para usar:

`width=device-width, initial-scale=1, viewport-fit=cover`

Foram removidos:

- `maximum-scale=1`;
- `user-scalable=no`;
- bloqueios de `gesturestart`, `gesturechange` e `gestureend`;
- bloqueio de Ctrl/Cmd + zoom;
- bloqueio de Ctrl + wheel.

O controle de overflow passa a depender do layout responsivo, e não da desativação de recursos do navegador.

### 3.2 Atualizador PWA sem falso sucesso

`src/AdminPwaUpdater.tsx` passou a trabalhar com estados explícitos:

- `idle`;
- `available`;
- `checking`;
- `downloading`;
- `installing`;
- `activating`;
- `complete`;
- `error`.

Falhas e workers `redundant` não podem mais resultar em 100%, mensagem de sucesso ou reload automático. A versão atual permanece ativa e o usuário recebe opção de tentar novamente. O sucesso depende de ativação válida/controller change.

## 4. Correções P1

### 4.1 Runtime separado de viewport

O shell agora distingue:

**Runtime:**
- `standalone`;
- `browser`.

**Viewport:**
- `phone` até 760 px;
- `tablet` até 1100 px;
- `desktop` acima de 1100 px.

A detecção standalone usa `display-mode: standalone` e fallback iOS com `navigator.standalone`.

### 4.2 Tablet e landscape

Foram adicionadas regras específicas para tablet e orientação horizontal. O manifest não usa mais `portrait-primary`, permitindo rotação e adaptação real da interface.

### 4.3 Safe area e topbar

O chrome canônico foi endurecido para respeitar:

- `safe-area-inset-top`;
- `safe-area-inset-right`;
- `safe-area-inset-bottom`;
- `safe-area-inset-left`.

Sino, configurações e menu secundário mantêm alvo de toque de 44×44 px inclusive nos menores viewports. Em 320–360 px, a redução ocorre na marca/tipografia, não na área clicável dos controles.

### 4.4 Badge de notificações

O badge deixou de projetar para fora do botão. O posicionamento negativo foi substituído por posicionamento interno, eliminando a causa de clipping junto à borda/safe area.

### 4.5 Notificações sem DOM robot

A abertura e navegação da Central de Notificações deixaram de depender de `MutationObserver`, listeners nativos injetados, leitura de badge via DOM e `.click()` programático.

O fluxo agora é controlado por estado React. O painel possui `aria-haspopup`, `aria-expanded`, fechamento por `Escape` e navegação direta para as áreas administrativas.

### 4.6 Contagem otimizada de alertas

O shell usa contagens específicas no Supabase com `count: 'exact'` e `head: true`, evitando baixar listas completas apenas para calcular badges.

Estados explícitos:

- `loading`;
- `ready`;
- `unavailable`.

Falha de consulta não é mais apresentada silenciosamente como zero alertas.

## 5. Hardening P2

### 5.1 Service Worker

Foi criado `src/adminPwaService.ts` como ponto central de registro do Service Worker, removendo responsabilidade duplicada.

`public/admin/sw.js` recebeu:

- timeout de instalação de 15 s;
- timeout de runtime de 5 s;
- `AbortController`;
- concorrência limitada a 4 downloads no cache inicial;
- cache restrito ao shell/assets apropriados;
- preservação da estratégia network-first;
- ausência de cache explícito para dados Supabase/Auth administrativos.

### 5.2 Modo offline

O estado offline passou a ser explícito. A interface informa que dados em tempo real e alterações administrativas ficam indisponíveis até a reconexão.

Não foi implementada fila de escrita offline, por decisão arquitetural, para evitar conflitos comerciais e sincronização insegura.

### 5.3 Manifest e ícones

O manifest agora inclui idioma, `display_override`, orientação adaptativa e ícone maskable HRX dedicado em SVG 512×512.

### 5.4 Pipeline de qualidade

Foram adicionados:

- Playwright;
- Chromium no CI;
- axe-core;
- workflow `HRX Admin PWA Quality Gate` para pull requests;
- teste de browser antes do deploy de produção;
- acompanhamento Lighthouse no deploy como etapa inicialmente não bloqueante.

## 6. Matriz de viewport validada

A suíte em Chromium validou geometria, overflow e controles nos seguintes viewports:

- 320×568;
- 360×800;
- 375×812;
- 390×844;
- 393×852;
- 412×915;
- 430×932;
- 768×1024;
- 820×1180;
- 1024×1366;
- 844×390 landscape;
- 932×430 landscape;
- 1024×768 landscape;
- 1366×1024;
- 1366×768;
- 1440×900;
- 1920×1080.

Os testes verificam, entre outros pontos:

- apenas um shell canônico montado;
- `scrollWidth` global não superior à viewport;
- sino dentro da viewport;
- configurações e menu secundário dentro da viewport;
- bottom nav dentro da viewport;
- sidebar/topbar desktop visíveis;
- ausência de violações axe sérias ou críticas no fixture do shell.

## 7. Evidências de QA

### Quality Gate do PR principal

- testes estáticos/arquitetura: aprovados;
- build TypeScript + Vite: aprovado;
- testes Chromium/axe: aprovados.

### Validação externa de produção

**Run:** `32673900284`  
**Job:** `97278804577`

Resultado do teste temporário `production serves the hardened HRX Admin PWA release`:

- **PASS**;
- manifest em produção com `lang: pt-BR`;
- ausência de lock de orientação;
- ícone maskable publicado;
- `/admin/version.json` com build publicado diferente de `dev`;
- HTML administrativo sem `user-scalable=no` ou `maximum-scale=1`;
- Service Worker em produção com `RUNTIME_FETCH_TIMEOUT_MS`, `INSTALL_CONCURRENCY` e ícone maskable;
- placeholder `__HRX_ADMIN_BUILD__` substituído no SW publicado.

Na mesma execução:

- **45/45 testes Node aprovados** — 44 da suíte permanente + 1 smoke test temporário de produção;
- **18/18 testes Playwright aprovados**;
- **0 falhas**;
- **0 vulnerabilidades reportadas pelo npm audit durante a instalação**;
- build de produção aprovado com Vite 8.2.2 e 111 módulos transformados.

O smoke test de produção foi removido após cumprir sua função e não faz parte da suíte permanente.

## 8. Segurança preservada

Não foram enfraquecidos:

- Supabase Auth;
- MFA;
- AAL2;
- `admin_users`;
- RLS;
- Edge Functions;
- restrições fiscais/financeiras;
- política de senhas;
- proteção de versões oficiais.

Nenhum `service_role`, token administrativo ou segredo foi inserido no bundle PWA.

## 9. Arquivos principais alterados

- `src/quotes/adminAppShell.ts`;
- `src/AdminPwaUpdater.tsx`;
- `src/AdminPwaBridge.tsx`;
- `src/adminPwaService.ts`;
- `src/quotes/AdminUnifiedRoot.tsx`;
- `src/quotes/AdminPersonalizationBridge.tsx`;
- `src/quotes/admin-unified-chrome.css`;
- `src/admin-pwa.css`;
- `src/admin-pwa-update.css`;
- `public/admin/manifest.webmanifest`;
- `public/admin/sw.js`;
- `public/admin/hrx-admin-icon-maskable.svg`;
- `tests/admin-pwa-shell.test.mjs`;
- `tests/admin-pwa-update.test.mjs`;
- `tests/admin-responsive-personalization.test.mjs`;
- `tests/admin-architecture.test.mjs`;
- `tests/browser/admin-shell.spec.ts`;
- `playwright.config.ts`;
- `.github/workflows/pwa-quality.yml`;
- `.github/workflows/deploy-pages.yml`;
- `package.json`.

## 10. Pontos não bloqueantes remanescentes

1. O bundle JavaScript principal gera aviso de tamanho acima de 500 kB após minificação (`~630,6 kB`, gzip `~173,1 kB`). É uma oportunidade futura de code splitting, não uma falha de build ou homologação responsiva.
2. O conjunto de ícones foi fortalecido com SVG normal e maskable 512×512. Não foram adicionados fallbacks raster PNG nesta rodada.
3. Os testes de browser usam o shell e CSS reais em fixture controlada, sem criar bypass de autenticação. Fluxos autenticados reais continuam protegidos por MFA/AAL2.
4. A personalização ainda utiliza um portal para encaixar o cartão de preferências na view legada de Configurações; a arquitetura crítica de notificações já não depende de DOM observer.
5. Push notification nativa e escrita offline avançada permanecem fora desta rodada por decisão arquitetural.

## 11. Homologação técnica desta rodada

**P0:** corrigidos.  
**P1:** corrigidos e cobertos por QA.  
**P2 prioritários:** implementados.  
**Build:** aprovado.  
**QA Chromium/axe:** aprovado.  
**Produção:** validada externamente.  
**Segurança:** preservada.

A interface não foi redesenhada; o trabalho endureceu e estabilizou o shell aprovado.

## 12. Escopo de repositório

Toda a implementação desta rodada foi realizada exclusivamente no repositório canônico:

`flanhenrique/HRX-SOLUCOES`

Nenhum código dos projetos Hortifruti Revolução, Volt, Nexus, Somma ou outros repositórios foi utilizado como alvo de modificação.
