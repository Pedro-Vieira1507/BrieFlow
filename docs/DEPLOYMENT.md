# Implantação segura

## 0. Pré-requisitos comerciais

Não abra cadastro pago enquanto algum destes itens estiver pendente:

- use ao menos o plano Supabase Pro para evitar pausa por inatividade, ter uma política de backup adequada e habilitar a proteção contra senhas vazadas;
- configure SMTP próprio, confirmação de e-mail e autenticação multifator para os operadores;
- escolha um único projeto Vercel como origem do domínio oficial e remova ou desconecte deploys duplicados depois de confirmar qual projeto está ativo;
- publique Termos de Uso, Política de Privacidade, política de cancelamento/reembolso e um canal de suporte com dados reais da empresa, revisados por responsável jurídico;
- configure alertas de erro, disponibilidade, latência e falhas de webhook sem registrar campanhas, JWTs ou segredos;
- execute teste de carga em staging com limites e volume próximos do lançamento, nunca contra a base principal sem janela aprovada.

## 1. Preparar o Supabase

Teste primeiro em um projeto de staging com cópia anonimizada do schema. Faça backup e aplique:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

A migração provisiona contas existentes, associa assets ao workspace padrão, ativa RLS pessoal, torna `campaign-assets` privado e cria planos, ledger, limites, cache e eventos Stripe. Valide especialmente usuários antigos e URLs de imagens salvas.

A migração interrompe com `unsafe_storage_policy` se detectar uma política genérica `true` em `storage.objects`, pois políticas permissivas são combinadas com OR e anulariam o isolamento. Restrinja ou remova essa política no staging antes de repetir a migração.

## 2. Configurar segredos

Copie `supabase/.env.example` para um arquivo fora do Git, preencha os valores e execute:

```bash
supabase secrets set --env-file supabase/.env.production
```

Configure `APP_URL` e uma lista exata de origens HTTPS em `ALLOWED_ORIGINS`. Defina pelo menos um provedor de IA. A mesma `GEMINI_API_KEY` habilita o provedor audiovisual principal; `GEMINI_VIDEO_MODEL` e `GEMINI_PODCAST_MODEL` permanecem no servidor. Runway é opcional e funciona como fallback. Nunca use prefixo `VITE_` para esses segredos.

## 3. Publicar funções

```bash
supabase functions deploy ai-proxy
supabase functions deploy scrape-proxy
supabase functions deploy image-search
supabase functions deploy billing
supabase functions deploy media-render
supabase functions deploy stripe-webhook --no-verify-jwt
```

O `config.toml` exige JWT nas cinco funções chamadas pelo app. Somente o webhook é público e ele valida a assinatura Stripe no corpo bruto.

## 4. Configurar Stripe

- crie preços recorrentes para Básico, Pro e Agência;
- em produção, use uma chave `sk_live_` ou `rk_live_`; chaves de teste são recusadas quando `ENVIRONMENT=production`;
- grave os IDs em `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO` e `STRIPE_PRICE_AGENCY`;
- aponte o webhook para `/functions/v1/stripe-webhook`;
- assine `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`;
- configure `STRIPE_WEBHOOK_SECRET` com o segredo do endpoint.

O endpoint autenticado `billing` consulta os Prices no Stripe e só libera um plano quando o Price está ativo, é recorrente, tem valor positivo e pertence ao mesmo modo (teste ou produção). A interface usa esse retorno como fonte do preço exibido. Se chave, webhook, `APP_URL` ou Price estiverem ausentes/inválidos, o checkout fica desabilitado sem criar Customer e sem iniciar cobrança.

Faça um ciclo completo em modo teste: checkout, webhook, alteração via portal, falha de pagamento e cancelamento.

## 5. Configurar Auth

No Supabase Auth:

- ative confirmação de e-mail;
- exija senha mínima de 12 caracteres e proteção contra senhas vazadas, quando disponível;
- cadastre a URL do app e `/app` como redirects permitidos;
- configure SMTP próprio, limites de envio e MFA para operadores;
- reduza a duração de sessões administrativas.

## 6. Publicar o frontend

Configure apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Execute `npm run validate` e então publique o build.

Promova o artefato Vercel de `npm run build`; nunca trate `vite dev` exposto por túnel como produção. Rode `npm run preview` depois do build para validar localmente o mesmo handler e os mesmos arquivos estáticos. Após a publicação, confirme que a interface mostra “créditos diários” e que a resposta HTML contém CSP, `X-Content-Type-Options`, proteção contra framing e HSTS. Essa verificação detecta imediatamente um processo antigo ou uma branch incorreta sendo servida.

Mantenha `APP_URL` e cada item de `ALLOWED_ORIGINS` como origens exatas. A Function normaliza barras finais, mas rejeita curingas. Os previews ativos versionados em `supabase/functions/_shared/preview-origins.ts` também devem usar origens HTTPS exatas; remova o túnel anterior quando ele for substituído e publique novamente as Functions consumidas pelo navegador.

## 7. Retenção e operação

Os jobs `brieflow-reset-daily-credits` e `brieflow-clean-ephemeral-data`, instalados pelas migrações, devem permanecer ativos no Supabase Cron. O primeiro usa `0 3 * * *` (00:00 em `America/Sao_Paulo`); o segundo roda no minuto 17 de cada hora e remove, em lotes limitados, janelas de rate limit com mais de dois dias e caches de scraping expirados. Monitore `cron.job_run_details`; a leitura do plano e a autorização de geração fornecem recuperação automática caso o reset seja atrasado.

Defina com jurídico/compliance a retenção de `ai_usage_log`, `credit_ledger`, histórico do Cron e eventos Stripe antes de automatizar a exclusão desses registros auditáveis.

Monitore taxa de erro e p95 de latência por função, falhas por provedor/modelo, saldo e estornos, `stripe_webhook_events.status = 'failed'`, crescimento do Storage e rejeições de rate limit. Os logs não devem receber prompts, conteúdo de campanhas, JWTs ou segredos.

## Verificações pós-deploy

Rode primeiro o gate público automatizado:

```bash
npm run check:launch -- https://app.example.com YOUR_PROJECT_REF
```

Ele exige HTTPS e os headers do frontend, valida CORS positivo e negativo nas quatro funções privadas e confirma que o webhook está configurado (uma assinatura ausente deve receber 401, nunca 503).

- dois usuários não conseguem listar, ler, alterar ou excluir assets um do outro;
- URLs do bucket expiram e os caminhos começam pelo UUID correto;
- um formato bloqueado retorna 403 mesmo com chamada manual;
- retries com o mesmo `request_id` debitam uma única vez;
- a repetição de um `request_id` já debitado retorna 409 sem chamar novamente o provedor;
- falha de todos os provedores estorna o saldo;
- URLs privadas/localhost são rejeitadas pelo scraper;
- CORS rejeita uma origem fora da lista;
- webhook sem configuração retorna 503 e, após configurar o segredo, assinatura ausente ou inválida retorna 401;
- a tela de planos exibe exatamente os valores recorrentes cadastrados no Stripe e desabilita qualquer Price inativo, avulso, zerado ou do modo incorreto;
- salvar duas vezes a mesma campanha atualiza o mesmo ID e não aumenta a contagem da Biblioteca;
- exportação Social gera PNG exatamente em 1080×1350 e legenda TXT em UTF-8;
- o Advisor do Supabase não aponta extensão no schema `public` nem helpers internos expostos como RPC;
- `anon` não possui privilégios em tabelas públicas e `authenticated` possui DML direto somente em `assets`.

## Rollback

Não reverta a privacidade do bucket nem as políticas RLS para contornar um incidente. Reverta primeiro o frontend, mantenha as funções compatíveis e restaure o banco a partir do backup apenas se a migração falhar. Correções de dados devem ser novas migrações auditáveis.
