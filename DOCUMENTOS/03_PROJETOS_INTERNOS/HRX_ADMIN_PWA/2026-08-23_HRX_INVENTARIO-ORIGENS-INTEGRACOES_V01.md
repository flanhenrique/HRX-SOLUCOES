# INVENTÁRIO TÉCNICO DE ORIGENS E INTEGRAÇÕES
**Projeto**: HRX Solutions — HRX Admin PWA  
**Data**: 2026-08-24  
**Versão**: V01  
**Status**: APROVADO  
**Repositório Canônico**: lanhenrique/HRX-SOLUCOES  

---

## 1. INTRODUÇÃO E ESCOPO

Este inventário cataloga todas as origens de rede, dependências externas, endpoints, integrações de comunicação e serviços de terceiros utilizados pelo ecossistema **HRX Solutions**.

---

## 2. MATRIZ CONSOLIDADA DE ORIGENS E INTEGRAÇÕES

| ORIGEM / ENDPOINT | TIPO | USO / FINALIDADE | ARQUIVO(S) PRINCIPAIS | LEITURA / ESCRITA | SEGREDO? | AMBIENTE | RISCO | AÇÃO DEFINIDA |
|---|---|---|---|---|---|---|---|---|
| https://tgcdkofplegmjvvkheyd.supabase.co | Backend BaaS | Banco de dados PostgreSQL, Auth, Edge Functions, Realtime e Storage | src/quotes/supabaseClient.ts, Edge Functions | Leitura / Escrita | Anon Key (Pública) / Service Role (apenas em Edge Functions) | Produção / Homologação | Baixo | Manter como backend canônico da HRX. |
| https://hrxsolutions.com.br | Domínio Web | Domínio customizado canônico de produção | CNAME, public/manifest.webmanifest | Leitura (Pública) | Não | Produção | Baixo | Manter como domínio canônico de produção. |
| https://flanhenrique.github.io | Deploy / CDN | Origem de hospedagem do GitHub Pages | GitHub Actions deploy.yml | Leitura (Pública) | Não | Produção / Fallback | Baixo | Manter no CORS das Edge Functions para compatibilidade de deploy. |
| https://brasilapi.com.br/api/cnpj/v1/ | API Externa | Consulta automatizada de dados cadastrais e CNAEs por CNPJ | supabase/functions/cnpj-lookup/index.ts | Leitura | Não | Produção | Baixo | Manter com fallback resiliente para preenchimento manual; nunca usar como parecer contábil automático. |
| Canva Design DAHTJI6gD7s | Modelo Visual | Geometria, proporções e matriz visual da Proposta Comercial Oficial (6 páginas) | src/quotes/proposalPdf.ts, src/quotes/AdminQuotes.tsx | Leitura (Design) | Não | Produção | Baixo | Manter fidelidade geométrica canônica nas 6 páginas principais e gerar anexos no transbordamento. |
| wa.me/<telefone> | Comunicação | Abertura de mensagem de compartilhamento de proposta via WhatsApp Web / App | src/quotes/AdminQuotes.tsx | Escrita (Redirect) | Não | Produção / Cliente | Baixo | Manter protocolo padrão wa.me para compartilhamento instantâneo. Integração com WhatsApp Business API registrada como evolução futura P3. |
| mailto:<email> | Comunicação | Abertura do cliente local de e-mail com assunto, corpo e PDF da proposta | src/quotes/AdminQuotes.tsx | Escrita (Protocolo) | Não | Produção / Cliente | Baixo | Manter fluxo mailto seguro sem credenciais SMTP no frontend. Envio transacional direto no backend registrado como evolução futura P3. |
| lanhenrique/Volt-consumo / lanhenrique/somma | Repositórios Externos | Referências históricas a assets e workspaces documentais | DOCUMENTOS/03_PROJETOS_INTERNOS/ | Somente Leitura | Não | Histórico | Baixo | Tratar estritamente como dependências externas somente leitura. Proibido modificar ou copiar código. |
| 
egistry.npmjs.org | Gerenciador de Pacotes | Dependências de runtime (React 19, Supabase JS) e dev (Vite, Playwright, TypeScript) | package.json, package-lock.json | Leitura (Build) | Não | Build / CI/CD | Baixo | Manter lockfile e dependências auditadas com zero vulnerabilidades. |
| GitHub Actions | CI/CD | Workflows de validação (	est.yml), quality gate (qa.yml) e deploy (deploy.yml) | .github/workflows/ | Execução | GITHUB_TOKEN (CI) | CI/CD | Baixo | Manter quality gates ativos bloqueando merges que falhem nos testes. |

---

## 3. AVALIAÇÃO DE SEGURANÇA DAS ORIGENS

1. **Credenciais no Frontend**: Apenas a chave publicável (non key) do Supabase é utilizada no cliente. Nenhuma chave service_role, credencial SMTP ou segredo de infraestrutura é exposto nos bundles.
2. **CORS Restritivo**: Todas as Edge Functions validam a lista de origens autorizadas (https://hrxsolutions.com.br, https://flanhenrique.github.io, http://localhost:5173, http://127.0.0.1:4173).
3. **Isolamento de Projetos**: Nenhuma rota ou serviço do HRX Solutions possui acoplamento de escrita com outros clientes ou repositórios externos.
