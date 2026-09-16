# Prontidão comercial do BrieFlow

Última auditoria técnica: 16 de setembro de 2026.

## Decisão atual

O núcleo do produto está apto a continuar em piloto controlado: autenticação, isolamento pessoal da biblioteca, créditos atômicos, rate limit, armazenamento privado, geração por IA, mídia, exportações, cobrança fail-closed e pipelines de CI estão implementados.

O lançamento pago aberto permanece **bloqueado** até todos os itens P0 abaixo estarem concluídos. Nenhum bloqueador deve ser contornado relaxando RLS, expondo buckets ou habilitando checkout sem webhook.

## P0 — obrigatório antes da primeira empresa pagante

| Área                | Estado auditado                                                                                         | Critério de liberação                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Supabase            | Organização no plano Free                                                                               | Migrar para Pro ou superior, confirmar backups e executar um teste de restauração                  |
| Senhas              | Proteção contra senhas vazadas desativada                                                               | Ativar no Supabase Auth e exigir senha mínima de 12 caracteres                                     |
| E-mail transacional | SMTP próprio não comprovado                                                                             | Configurar SMTP, confirmação de e-mail, remetente e limites de envio                               |
| Stripe              | Duas contas conectadas, ambas em teste; nenhuma possui webhook                                          | Escolher uma conta oficial, ativar modo live, criar Products/Prices e cadastrar o webhook assinado |
| Segredos Stripe     | `STRIPE_WEBHOOK_SECRET` ausente no gate público                                                         | Usar chave restrita live, segredo do webhook, `ENVIRONMENT=production` e Prices live               |
| Vercel              | Dois projetos publicam previews do mesmo repositório                                                    | Escolher o projeto proprietário de `brieflow-ai.vercel.app` e desconectar o duplicado              |
| Jurídico            | Cadastro já bloqueia sem documentos e registra o aceite internamente; conteúdo público ainda não existe | Publicar Termos, Privacidade, cancelamento/reembolso e canal de suporte revisados                  |
| Observabilidade     | Logs estruturados existem, alertas externos não foram comprovados                                       | Alertar erro/latência p95, indisponibilidade, webhook falho, provedor e crescimento do Storage     |

## P1 — obrigatório para escala B2B

- manter staging separado e sem dados pessoais reais;
- executar testes E2E com dois usuários comprovando que nenhum asset ou arquivo cruza contas;
- fazer teste de carga do chat, geração, biblioteca, webhook e polling de mídia;
- definir RPO, RTO, retenção de ledger/logs e procedimento de incidente;
- revisar mensalmente Supabase Advisors, dependências, CodeQL e chaves de acesso;
- adicionar monitor de disponibilidade para frontend e funções essenciais;
- documentar suporte, SLA, horário de atendimento e processo de exclusão/exportação de dados;
- validar custos reais por geração e margem de cada plano antes de abrir checkout.

## Escopo comercial honesto

- Vídeo longo permanece em stand by e não deve ser vendido como funcionalidade ativa.
- O banco já limita membros por plano, mas a gestão de convites e funções ainda não está disponível na interface. Até sua implementação, cada workspace comercial deve ter um único operador.
- Reel assistido, podcast, PowerPoint e ficha técnica em PDF podem seguir para piloto após o teste E2E do ambiente que será promovido.

## Gate técnico de lançamento

1. `npm ci --ignore-scripts`
2. `npm run validate`
3. `npm audit --audit-level=high`
4. CI, Edge Functions e CodeQL verdes no commit exato do deploy
5. `npm run check:launch -- https://brieflow-ai.vercel.app PROJECT_REF`
6. ciclo Stripe completo em modo teste e depois uma compra live controlada
7. teste de cadastro, confirmação, login, geração, consumo/estorno, salvamento, exportação e exclusão
8. aprovação jurídica e operacional registrada

O resultado é **go** somente quando o gate público aprovar todas as verificações e a tabela P0 não possuir pendências.
