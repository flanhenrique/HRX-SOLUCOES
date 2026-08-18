# HRX Admin — Refatoração e hardening

Data: 2026-08-18

## Objetivo

Reduzir código legado e camadas concorrentes, consolidar a navegação do PWA, padronizar a política de senha e tornar MFA/AAL2 requisito efetivo para operações administrativas sensíveis.

## Alterações aplicadas

### Autenticação e segurança

- Google Authenticator/TOTP permanece como segundo fator do acesso administrativo.
- A API `quote-admin` exige token verificado com `aal=aal2` antes de consultar ou alterar dados administrativos.
- A função `admin-password` exige `aal=aal2` antes de qualquer troca de senha.
- O motor fiscal privilegiado `hrx_calculate_quote_fiscal` recebeu bloqueio explícito para sessões abaixo de AAL2.
- Troca de senha dentro de Configurações usa a mesma política forte do fluxo de recuperação: mínimo de 12 caracteres, maiúscula, minúscula, número e símbolo, além da verificação externa de senha comprometida já implementada pela HRX.

### Navegação e usabilidade mobile

- A barra inferior do PWA foi consolidada em três destinos: Solicitações, Orçamento e Menu.
- Clientes, Suspensões, Central de Documentos, Painéis, Fiscal e Configurações ficam no Menu central.
- Portais mobile redundantes de Documentos e Painéis foram removidos.
- A camada temporária `AdminNavigationRefinement` foi eliminada depois de incorporar sua função ao Menu principal.
- Safe areas, scroll do menu, largura de cards, métricas e tabs do editor foram refinados para iPhone.

### Código removido

Removidos por estarem substituídos e sem montagem no app atual:

- `src/quotes/AdminBootstrapAccess.tsx`
- `src/quotes/admin-bootstrap-access.css`
- `src/quotes/AdminPasswordControl.tsx`
- `src/quotes/admin-password-control.css`
- `src/quotes/AdminNavigationRefinement.tsx`
- `src/quotes/admin-navigation-refinement.css`

### Central de Documentos

- A experiência documental permanece dentro do HRX Admin.
- GitHub deixou de ser destino da navegação documental do usuário.
- Estrutura organizada por função, cliente, projeto, jurídico/contratos e histórico.
- Checklist contratual contempla partes, objeto, valores, vigência, obrigações, multas/rescisão, LGPD, foro e assinaturas.

### CI e qualidade

O workflow `.github/workflows/ci.yml` foi ajustado para executar em pushes na `main` e pull requests, rodando:

1. verificação do shell PWA (`npm run test:pwa`);
2. compilação TypeScript e build Vite (`npm run build`).

O conector GitHub ainda não retornou um status de execução para os commits desta rodada; por isso o build não deve ser tratado como confirmado até existir um run observável.

## Pendências de segurança ainda abertas

### P0 — função fiscal SECURITY DEFINER

O advisor do Supabase ainda aponta que `public.hrx_calculate_quote_fiscal(uuid,boolean)` é `SECURITY DEFINER` e executável pelo papel `authenticated`. O guard AAL2 reduz o risco, mas não elimina o alerta estrutural. Solução recomendada: mover a execução privilegiada para uma Edge Function/backend controlado e revogar o `EXECUTE` direto do papel `authenticated`.

### P0 — proteção nativa de senhas vazadas

O advisor do Supabase informa que a proteção nativa de leaked passwords do Auth está desativada. O app já faz checagem própria contra base de senhas comprometidas, mas a proteção nativa deve ser habilitada no painel do Supabase quando a configuração estiver acessível.

### P1 — demais funções administrativas

Auditar todas as Edge Functions e RPCs administrativas para que operações sensíveis exijam AAL2 no servidor, não apenas na interface. `cnpj-lookup` ainda é candidato a receber o mesmo guard.

### P1 — módulo Fiscal mobile

`AdminFiscalHub` ainda mantém um portal mobile legado, embora esteja oculto pelo CSS e o acesso já exista no Menu central. Remover esse portal em uma próxima limpeza reduz observadores e complexidade de DOM.

### P1 — Central de Documentos persistente

A taxonomia e a UX existem, mas a Central ainda precisa de camada persistente própria para upload, metadados, indexação, versão, permissões, vigência e busca. Não tratar os cards atuais como um DMS completo.

### P2 — Painéis dinâmicos

Os status e percentuais de SOMMA, VOLT e Hortifruti ainda são definidos no código. Migrar para uma fonte persistente antes de usar esses painéis como fonte oficial de gestão.

## Decisão sobre índices do banco

O advisor de performance marcou vários índices como ainda não utilizados. Nenhum foi removido nesta rodada porque o banco é recente e parte deles atende FKs, auditoria e filtros operacionais. Remover índice por baixa contagem de uso neste momento seria otimização prematura.

## Critério para próximas remoções

Código só deve ser apagado quando houver evidência de que está sem import, sem montagem, sem chamada indireta e sem dependência operacional. O objetivo é reduzir complexidade sem trocar dívida técnica por regressão.
