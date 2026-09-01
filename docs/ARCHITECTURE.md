# Arquitetura de produção

## Fronteiras de confiança

O navegador usa apenas a URL e a chave anônima do Supabase. Todas as operações com custo, segredo ou acesso externo passam por uma Edge Function autenticada. A service role nunca é enviada ao cliente.

```mermaid
flowchart TD
  Web[Cliente web] -->|JWT| Edge[Edge Functions]
  Web -->|RLS + JWT| DB[(PostgreSQL)]
  Web -->|pasta do usuário| Storage[(Storage privado)]
  Edge -->|service role| DB
  Edge --> Providers[IA, busca e Stripe]
  Edge --> Storage
```

## Multiempresa e isolamento

- `organizations` representa a conta comercial.
- `organization_members` define owner, admin, member e viewer.
- `subscriptions` centraliza plano, ciclo e saldo da organização.
- `profiles.default_organization_id` seleciona o workspace atual.
- `assets` guarda o autor e a organização, mas as políticas dão acesso **somente ao autor**. Compartilhamento futuro deve usar uma tabela explícita, nunca relaxar essa política.

## Geração

1. O cliente envia ação, contexto e `request_id` à `ai-proxy`.
2. `authorize_generation` bloqueia a assinatura, valida plano e rate limit, deduz créditos e grava o ledger na mesma transação; `request_id` repetido é rejeitado antes de uma nova chamada ao provedor.
3. A função escolhe modelos configurados pelo operador e tenta fallback sem aceitar URL ou modelo arbitrário do cliente.
4. A saída JSON é validada no proxy e novamente pelo contrato Zod no cliente.
5. Falha total aciona `refund_generation`; a chave única por usuário, request e tipo impede débito ou estorno duplicado.

Prompts e conteúdo gerado não são persistidos em logs de uso.

## Conteúdo avançado

Roteiros e documentos usam `StructuredContentDocument`: título, resumo, duração, seções, timing, direção visual, notas, CTA, palavras-chave e ressalvas. A representação comum permite edição, exportação TXT/JSON e futuras integrações de renderização sem alterar campanhas existentes.

## Escala

- limites por minuto são contadores atômicos por usuário;
- débitos usam row locks e idempotência;
- biblioteca usa paginação por cursor em lotes de 50 itens, com ordenação estável e índice por usuário/data/ID;
- scraping usa cache de quatro horas;
- webhooks Stripe usam claim atômico, lease de recuperação e ordenação pelo timestamp assinado do evento;
- mídia é armazenada em vez de embutida em JSON e tem limite de 10 MB;
- payload de campanha tem limite de 2 MB.

Para volumes superiores, a evolução natural é fila assíncrona para vídeo renderizado, observabilidade centralizada e réplicas de leitura. Essas mudanças não exigem alterar o contrato atual de assets.
