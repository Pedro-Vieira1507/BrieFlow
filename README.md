# BrieFlow

Plataforma multiempresa para transformar briefings em campanhas consistentes, editáveis e rastreáveis. O BrieFlow gera banners, e-mails, posts sociais, WhatsApp, artigos, fichas técnicas, apresentações e roteiros de Reels, vídeos e podcasts, com disponibilidade e consumo definidos pelo plano.

## Arquitetura

- **Web:** React 19, TanStack Start, TypeScript e Vite.
- **Dados e identidade:** Supabase Auth, PostgreSQL com RLS e Storage privado.
- **IA:** Edge Function autenticada com fallback administrado entre OmniRoute, Groq, Gemini e Ollama. Nenhuma chave entra no bundle.
- **Assinaturas:** Stripe Checkout, Customer Portal e webhook assinado.
- **Qualidade:** contratos Zod, guardrails factuais, lint TypeScript, testes, build, auditoria e CodeQL.

Detalhes: [arquitetura](docs/ARCHITECTURE.md), [planos](docs/PLANS.md) e [implantação](docs/DEPLOYMENT.md).

## Desenvolvimento local

Requisitos: Node.js 22.14+ e um projeto Supabase.

```bash
cp .env.example .env.local
npm ci --ignore-scripts
npm run dev
```

Antes de enviar uma alteração:

```bash
npm run validate
npm run security:audit
```

## Ordem obrigatória de implantação

1. aplicar a migração em `supabase/migrations`;
2. configurar os segredos do servidor;
3. publicar as Edge Functions;
4. publicar a aplicação web.

Essa ordem mantém compatibilidade com campanhas existentes e evita que uma versão nova do cliente encontre funções ou tabelas antigas. Consulte o [guia de implantação](docs/DEPLOYMENT.md) antes de promover para produção.

## Privacidade da biblioteca

Cada item salvo possui `user_id`. A interface filtra pelo usuário autenticado e o PostgreSQL repete a validação em políticas RLS para leitura, criação, alteração e exclusão. Ser integrante da mesma organização **não** concede acesso à biblioteca pessoal de outro login.

## Segurança

Consulte [SECURITY.md](SECURITY.md). Nunca adicione chaves de provedor em variáveis `VITE_*`, commits, logs ou screenshots.
