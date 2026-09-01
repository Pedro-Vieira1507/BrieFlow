# Segurança do BrieFlow

## Reporte responsável

Não abra uma issue pública para vulnerabilidades. Use o recurso **Security → Report a vulnerability** deste repositório e inclua impacto, passos mínimos de reprodução e, se possível, uma correção sugerida. Não acesse dados de terceiros durante a validação.

## Controles implementados

- chaves de IA, busca, Stripe e service role existem somente em Edge Functions;
- biblioteca protegida por RLS e sempre filtrada por `auth.uid()`;
- arquivos em bucket privado, separados pelo UUID do usuário e entregues por URL assinada;
- créditos e rate limits debitados atomicamente no banco, com idempotência e estorno;
- scraping protegido por validação de DNS/IP, bloqueio de redes privadas em cada redirect, timeout integral, limite de payload e protocolos HTTP(S);
- webhook Stripe validado por HMAC e deduplicado por evento;
- CORS restrito a `ALLOWED_ORIGINS`, autenticação obrigatória e limites de payload;
- CI com lint, tipos, testes, build, auditoria de dependências e CodeQL.

## Operação

Rotacione imediatamente qualquer segredo que tenha sido exposto. Revogue sessões afetadas no Supabase, verifique `ai_usage_log`, `credit_ledger` e eventos Stripe, e preserve evidências sem registrar prompts, tokens ou chaves em logs.
