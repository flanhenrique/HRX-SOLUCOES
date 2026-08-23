# HRX SOLUTIONS — CORREÇÃO DO CADASTRO DE NOVO CLIENTE

**Versão:** 1.0  
**Data:** 23/08/2026  
**Área:** Administrativo / Clientes  
**Repositório canônico:** `flanhenrique/HRX-SOLUCOES`

## Problema identificado

O formulário de inclusão de novo cliente utilizava classes de modal, porém suas regras estruturais de overlay estavam acopladas a uma folha de estilo legada que deixou de ser carregada após a unificação do HRX Admin. Como consequência, o formulário era renderizado no fluxo normal da página, aumentando a altura do workspace e embaralhando o layout.

## Correção aplicada

- `AdminClientForm` passa a ser renderizado com `createPortal(..., document.body)`;
- backdrop fixo em toda a viewport;
- modal independente do shell administrativo;
- bloqueio temporário do scroll do `body` enquanto o modal está aberto;
- fechamento por `Esc`, botão fechar, cancelar e clique fora do container;
- foco inicial no campo Nome / responsável;
- `role="dialog"` e `aria-modal="true"`;
- scroll vertical interno no conteúdo do formulário;
- Desktop com modal centralizado;
- PWA/mobile com container sobreposto, respeitando `safe-area-inset-top` e `safe-area-inset-bottom`;
- formulário em uma coluna no mobile para evitar overflow horizontal;
- consulta de CNPJ, criação de cliente e regras de validação preservadas.

## Critério de QA

Foi adicionado teste automatizado para impedir regressão para renderização no fluxo normal da página. O teste exige portal no `document.body`, backdrop `position: fixed`, `z-index` explícito, altura limitada, scroll interno e comportamento específico para PWA.
