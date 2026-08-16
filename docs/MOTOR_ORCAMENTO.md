# Motor de orçamento — HRX Solutions

## Objetivo

Receber uma solicitação pública, interpretar a necessidade, montar um rascunho interno de orçamento e manter qualquer valor invisível ao cliente até aprovação manual da HRX.

## Fluxo

1. **Formulário público**
   - Nome
   - E-mail
   - Telefone / WhatsApp
   - Empresa opcional
   - Motivo do contato
   - Áreas de interesse
   - Descrição livre da necessidade
   - Prazo desejado
   - Canal de retorno preferido
   - Consentimento de privacidade obrigatório
   - Consentimento de marketing opcional e separado

2. **Entrada segura**
   - A página envia para uma Edge Function.
   - O navegador não recebe tabela de preços nem regras privadas.
   - A Edge Function valida origem, payload, consentimento e frequência de envio.

3. **Interpretação**
   - A versão inicial usa regras determinísticas para sugerir serviços do catálogo.
   - A interpretação recebe nível de confiança e lista de informações faltantes.
   - Baixa confiança ou ausência de correspondência deixa o pedido em `needs_scope`.

4. **Precificação privada**
   - A Edge Function consulta `pricing_rules` no banco privado.
   - Os valores não ficam no bundle público do site.
   - O motor cria um rascunho e itens sugeridos.

5. **Validação interna**
   - O cliente não recebe o valor calculado.
   - O administrador revisa escopo, preço, complexidade, urgência, desconto, pagamento e retenções.

6. **Motor de desconto**
   - `0%` e `5%`: verde / faixa saudável.
   - `10%`: amarelo / atenção.
   - `15%`: vermelho / desconto alto.
   - `20%`: roxo / bloqueado para aprovação normal.
   - Percentuais são inteiros e limitados às faixas acima.

7. **Boleto e parcelamento**
   - Provedores previstos: Nubank e Mercado Pago.
   - Taxa por boleto é um parâmetro configurável no backend; não deve ser hard-coded.
   - O custo total é calculado por quantidade de parcelas.

8. **Retenções fiscais**
   - Campos previstos: ISS, IRRF, PIS, COFINS, CSLL e INSS.
   - O sistema não determina sozinho se uma retenção é obrigatória.
   - Retenções informadas ativam `fiscal_review_required`.
   - A aprovação é bloqueada até a revisão fiscal ser confirmada.

9. **Aprovação**
   - Rascunho só pode virar `approved` por usuário administrativo autenticado.
   - Desconto roxo bloqueia aprovação.
   - Revisão fiscal pendente bloqueia aprovação.
   - Todas as mudanças relevantes entram no log de auditoria.

10. **Retorno ao cliente**
    - WhatsApp v1: abertura manual de conversa com mensagem pré-preenchida.
    - E-mail: a entrada cria um item pendente na fila `outbound_messages`.
    - Nenhum orçamento é enviado automaticamente nesta fase.

## Segurança

- Repositório GitHub é público; não armazenar segredos, chaves, memória de precificação pessoal ou credenciais.
- Tabelas de preços ficam no banco protegido.
- RLS ativado nas tabelas administrativas.
- Entrada pública ocorre pela Edge Function com Service Role apenas no servidor.
- Painel administrativo só deve ser habilitado em produção depois de autenticação e backend configurados.

## Ativação pendente

- Criar um projeto Supabase exclusivo da HRX.
- Aplicar migrations.
- Criar o primeiro usuário administrador.
- Inserir a tabela privada de preços.
- Configurar domínio/origens permitidas.
- Publicar `quote-intake` sem JWT, com validação de origem e payload.
- Publicar `quote-admin` com JWT obrigatório.
- Escolher/configurar o provedor de e-mail transacional para processar a fila de confirmações.
- Conectar o painel autenticado ao endpoint `quote-admin`.
