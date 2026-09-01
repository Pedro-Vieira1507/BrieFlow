# Implantação segura

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

Configure `APP_URL` e uma lista exata de origens HTTPS em `ALLOWED_ORIGINS`. Defina pelo menos um provedor de IA. Nunca use prefixo `VITE_` para esses segredos.

## 3. Publicar funções

```bash
supabase functions deploy ai-proxy
supabase functions deploy scrape-proxy
supabase functions deploy image-search
supabase functions deploy billing
supabase functions deploy stripe-webhook --no-verify-jwt
```

O `config.toml` exige JWT nas quatro funções chamadas pelo app. Somente o webhook é público e ele valida a assinatura Stripe no corpo bruto.

## 4. Configurar Stripe

- crie preços recorrentes para Básico, Pro e Agência;
- grave os IDs em `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_PRO` e `STRIPE_PRICE_AGENCY`;
- aponte o webhook para `/functions/v1/stripe-webhook`;
- assine `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`;
- configure `STRIPE_WEBHOOK_SECRET` com o segredo do endpoint.

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

## 7. Retenção e operação

Agende uma rotina diária, pelo Supabase Cron ou pelo orquestrador da infraestrutura, para remover janelas de rate limit com mais de dois dias e cache expirado. Defina com jurídico/compliance a retenção de `ai_usage_log`, `credit_ledger` e eventos Stripe antes de automatizar a exclusão desses registros auditáveis.

Monitore taxa de erro e p95 de latência por função, falhas por provedor/modelo, saldo e estornos, `stripe_webhook_events.status = 'failed'`, crescimento do Storage e rejeições de rate limit. Os logs não devem receber prompts, conteúdo de campanhas, JWTs ou segredos.

## Verificações pós-deploy

- dois usuários não conseguem listar, ler, alterar ou excluir assets um do outro;
- URLs do bucket expiram e os caminhos começam pelo UUID correto;
- um formato bloqueado retorna 403 mesmo com chamada manual;
- retries com o mesmo `request_id` debitam uma única vez;
- a repetição de um `request_id` já debitado retorna 409 sem chamar novamente o provedor;
- falha de todos os provedores estorna o saldo;
- URLs privadas/localhost são rejeitadas pelo scraper;
- CORS rejeita uma origem fora da lista;
- webhook com assinatura inválida retorna 401.

## Rollback

Não reverta a privacidade do bucket nem as políticas RLS para contornar um incidente. Reverta primeiro o frontend, mantenha as funções compatíveis e restaure o banco a partir do backup apenas se a migração falhar. Correções de dados devem ser novas migrações auditáveis.
