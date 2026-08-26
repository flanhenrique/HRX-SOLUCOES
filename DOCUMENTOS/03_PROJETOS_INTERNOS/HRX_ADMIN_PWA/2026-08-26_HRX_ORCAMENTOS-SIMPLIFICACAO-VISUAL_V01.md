# HRX Admin — Simplificação visual de Orçamentos

Data: 2026-08-26

Branch: `feature/reestrutura-visual-financeiro-20260826`

Escopo: módulo existente de Orçamentos/Propostas, sem alteração de backend, Supabase, autenticação, MFA ou regras comerciais.

## Resultado

- Cabeçalho reduzido para título, descrição e ações principais.
- Indicadores mantidos em quatro KPIs, com grid sem recorte nos tamanhos validados.
- Arquitetura mestre/detalhe consolidada em lista de 300 px e conteúdo flexível no desktop.
- Itens da lista reduzidos a número, cliente, data, status e valor.
- Terceira coluna de resumo financeiro removida; o total permanece no cabeçalho da proposta e o detalhamento continua na etapa Revisão.
- Grande container visual do editor e cards intermediários desnecessários removidos.
- Stepper limitado a 46 px e horizontalmente controlado no mobile.
- Aviso de proposta aprovada reduzido para uma mensagem compacta.
- Rodapé de edição removido do modo somente leitura; `Duplicar` e `•••` ficam no cabeçalho.
- Histórico deixou de possuir rolagem própria.
- Lista e editor deixaram de possuir rolagens verticais independentes; a área principal é a única região rolável quando o conteúdo excede a viewport.
- Tablet e mobile usam telas separadas para lista e detalhe, com ação de retorno no detalhe.
- Liquid Glass permanece restrito ao shell/cabeçalhos; o conteúdo usa superfícies claras e legíveis.

## Validação visual

| Viewport | Resultado |
|---|---|
| 1920 × 1080 | quatro KPIs íntegros, mestre/detalhe confortável, sem overflow horizontal |
| 1440 × 900 | mestre/detalhe íntegro, um scroll vertical principal quando necessário |
| 1366 × 768 | conteúdo operacional, sem terceira coluna e sem overflow horizontal |
| 1024 × 768 | KPIs em 2 × 2 e mestre/detalhe sem compressão de terceiro painel |
| 820 × 1180 | lista e detalhe em telas separadas, retorno disponível |
| 430 × 932 | fluxo mobile separado e sem overflow horizontal |
| 390 × 844 | fluxo mobile separado; stepper horizontal controlado |

Em proposta aprovada, a validação confirmou ausência do botão `Salvar`. Na etapa Envio, o histórico não cria uma barra de rolagem adicional.

## Testes

- `npm run test:pwa`: 94 testes aprovados, 0 falhas.
- `npm run build`: TypeScript e bundle Vite concluídos.
- Inspeção responsiva autenticada no aplicativo local nos sete viewports acima.

## Gate

- `POLUIÇÃO VISUAL: CORRIGIDA`
- `MÚLTIPLOS SCROLLS: CORRIGIDOS`
- `HIERARQUIA VISUAL: APROVADA`
- `RESPONSIVIDADE: APROVADA`
- `PUBLICAÇÃO: BLOQUEADA` — não houve push, merge ou deploy; publicação depende de homologação humana.
