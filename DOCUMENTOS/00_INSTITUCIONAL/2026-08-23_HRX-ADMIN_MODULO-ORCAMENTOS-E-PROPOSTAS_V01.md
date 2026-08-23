# HRX SOLUTIONS — MÓDULO DE ORÇAMENTOS E PROPOSTAS COMERCIAIS

**Versão:** 1.0

**Data:** 23/08/2026

**Área:** Comercial / Administrativo

**Classificação:** Institucional — uso interno

## Objetivo

Formalizar o fluxo comercial da HRX Solutions desde o rascunho do orçamento até sua aprovação, mantendo rastreabilidade para as futuras integrações com Contas a Receber, nota fiscal e comprovantes. Esta entrega não implementa o módulo financeiro, emissão fiscal nem WhatsApp Business API.

## Fluxo comercial

O modelo suporta:

`Rascunho → Revisado → Enviado → Em negociação → Aprovado → Faturado → Recebido`

Estados finais alternativos: `Perdido` e `Cancelado`.

As transições são validadas no backend. Uma proposta só pode ser marcada como revisada, enviada ou aprovada quando possuir ao menos uma versão oficial. Orçamentos faturados, recebidos, perdidos ou cancelados são somente leitura.

## Numeração e rastreabilidade

Cada orçamento recebe numeração oficial no padrão:

`HRX-ORC-AAAA-NNNNNN`

O identificador permanece associado ao cliente, ao rascunho, às versões da proposta, ao documento armazenado e, futuramente, à nota fiscal, parcelas e recebimentos.

## Cliente

O primeiro passo do editor pesquisa a base oficial por nome, razão social/nome fantasia, CPF/CNPJ, e-mail e telefone. O cadastro rápido utiliza o formulário e a operação oficial de clientes; não existe cadastro paralelo. Ao concluir o cadastro, o cliente criado é selecionado e os dados já preenchidos no orçamento são preservados.

O orçamento referencia o cliente original. Cada versão oficial registra um snapshot documental dos dados necessários para preservar o histórico da proposta.

## Rascunhos

Rascunhos podem ser salvos, retomados, duplicados e excluídos mediante confirmação. A duplicação gera novo protocolo e novo número oficial, copia cliente, itens e condições apropriadas, atualiza datas e retorna ao status Rascunho.

A exclusão física é restrita a rascunhos nunca versionados. Propostas utilizadas comercialmente devem ser canceladas ou arquivadas, preservando o histórico.

O editor realiza autosave com indicação visual de `Salvando`, `Salvo` ou erro. Rascunhos incompletos podem ser salvos, mas não finalizados.

## Cálculos monetários

Todos os cálculos operacionais são realizados em centavos inteiros para evitar erro de ponto flutuante.

Ordem do cálculo:

1. soma dos itens;
2. aplicação dos multiplicadores já existentes;
3. desconto percentual ou ajuste para valor final desejado;
4. imposto configurável;
5. taxas de pagamento e retenções já suportadas;
6. total final e valor líquido estimado.

O imposto é configurável e não possui alíquota universal fixa. O modo `Definir valor final` calcula desconto em reais e percentual equivalente, exige justificativa e sessão administrativa AAL2, e registra valor original, valor final, ajuste, usuário e data no histórico.

As parcelas são geradas em centavos e a última parcela absorve eventual diferença de arredondamento. A soma das parcelas deve ser exatamente igual ao total final.

## Condição de pagamento

O módulo registra pagamento à vista ou parcelado, quantidade de parcelas, intervalo, primeiro vencimento, valores e datas previstas. Nenhuma baixa financeira é realizada nesta fase. Os dados ficam estruturados para a futura criação de receita prevista no Contas a Receber.

## Versionamento e PDF

Finalizar uma proposta cria uma nova versão imutável do conteúdo comercial e um PDF profissional com:

- identidade HRX Solutions;
- número, versão e data;
- dados do cliente;
- título, descrição, escopo e itens;
- subtotal, desconto, imposto e total;
- pagamento, parcelas e vencimentos;
- validade e observações;
- dados institucionais no rodapé.

PDFs preliminares exibem a marca `RASCUNHO`. Versões oficiais não exibem essa marca. Alterações posteriores geram uma nova versão em vez de sobrescrever o documento anterior.

## Central de Documentos

Cada versão oficial é enviada ao bucket privado `hrx-documents` e recebe registro correspondente em `hrx_documents`, na pasta/categoria `Propostas Comerciais`, vinculada ao cliente, ao orçamento e à versão. Em caso de falha no registro documental, o backend remove o objeto e a versão intermediária para evitar inconsistência.

O acesso compartilhável utiliza URL assinada temporária. Nenhum documento privado é tornado público permanentemente.

## E-mail

O editor prepara destinatário, assunto, mensagem e documento para confirmação do administrador. O fluxo atual permite abrir o cliente de e-mail com o conteúdo revisado e compartilhar o PDF pelo recurso nativo do dispositivo quando suportado.

O envio SMTP automático por iCloud não foi habilitado nesta entrega porque exigiria backend de e-mail e senha específica de aplicativo armazenada como segredo. Nenhuma senha ou credencial é armazenada no frontend, banco documental ou repositório. A evolução segura deve usar função backend, secret gerenciado e registro de entrega do provedor.

## WhatsApp e compartilhamento

No desktop, o módulo abre a conversa do cliente com mensagem e URL assinada temporária. No PWA/mobile, utiliza compartilhamento nativo para enviar o PDF, a mensagem e o link quando o dispositivo oferece suporte. Também existe opção para copiar o link temporário.

Não há integração com WhatsApp Business API paga nesta fase, e a interface não afirma anexar automaticamente um PDF por meio de um link `wa.me`.

## Histórico

O histórico registra criação, salvamento, duplicação, ajuste de valor, geração de versão/PDF, preparação e compartilhamento por canal, mudança de status e aprovação. A aprovação inclui data, usuário, forma, observação e versão aprovada.

## Segurança

- autenticação Supabase preservada;
- operações administrativas protegidas por administrador e MFA/AAL2;
- ajuste manual de valor exige AAL2 e justificativa;
- bucket permanece privado;
- URLs compartilhadas são temporárias;
- nenhuma credencial de iCloud, WhatsApp ou Supabase é exposta no frontend;
- políticas RLS foram mantidas e ampliadas para as novas entidades.

## Estruturas de dados

Entidades preservadas e evoluídas:

- `quote_requests`: cliente, protocolo e número oficial;
- `quote_drafts`: conteúdo editável, totais, condições e estado comercial;
- `quote_items`: itens manuais ou de catálogo;
- `quote_payment_installments`: parcelas previstas;
- `quote_versions`: snapshots e PDFs versionados;
- `quote_audit_log`: trilha de auditoria;
- `hrx_documents`: metadados e vínculo documental;
- bucket `hrx-documents`: arquivo físico privado.

Migrations oficiais versionadas:

- `20260823203057_quote_commercial_lifecycle.sql`;
- `20260823203211_optimize_quote_commercial_lifecycle.sql`;
- `20260823204142_harden_quote_version_immutability.sql`;
- `20260823204215_restrict_quote_table_grants.sql`.

## Evoluções futuras separadas

1. Contas a Receber: converter proposta aprovada e parcelas previstas em receita operacional.
2. Nota fiscal: vincular documento fiscal ao número do orçamento e à versão aprovada.
3. Recorrência automática: criar política própria; nesta fase, usar `Duplicar orçamento`.
4. E-mail transacional: configurar provedor/backend seguro, secrets e webhooks de entrega.
5. WhatsApp Business API: avaliar somente se houver necessidade operacional e consentimento adequado.

## Critérios de aceite técnicos

- cliente existente ou novo selecionado na base real;
- pelo menos um item para finalização;
- cálculos exatos em centavos;
- alíquota, desconto, validade e pagamento persistidos;
- ajuste manual protegido e auditado;
- parcelas fechando o total;
- versões anteriores preservadas;
- PDF de rascunho identificado;
- PDF oficial armazenado no bucket e registrado na Central;
- canais de compartilhamento sem exposição pública permanente;
- experiência desktop e mobile sem tabela horizontal no PWA.
