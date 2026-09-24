# Auditoria de prontidão para produção — 18/09/2026

## Decisão executiva

**Status: NO-GO para venda pública imediata; GO condicionado após a checklist P0.**

A base técnica é adequada para um piloto controlado: autenticação, RLS pessoal, créditos atômicos, idempotência, Stripe assinado, limites de payload e fallbacks de IA já existem. Esta auditoria corrigiu bloqueadores no código, mas a versão pública só estará protegida depois que a migração, as Edge Functions e o frontend desta revisão forem implantados e validados com contas reais.

## Escopo verificado

- experiência pública desktop e bloqueios de autenticação;
- onboarding, catálogo de formatos e promessas de exportação;
- renderização de banner e recorte de produto;
- isolamento por usuário e organização;
- proxy de IA, créditos, rate limits e fallbacks;
- scraping, busca de imagem e segmentação;
- Stripe Checkout, Customer Portal e webhook;
- CI, dependências, build e configuração Vercel;
- acessibilidade semântica básica e metadados.

Em 22/09/2026, o fluxo autenticado principal foi validado com uma conta de auditoria no Vercel público. Pagamento de teste, isolamento multiusuário e administração do Vercel continuam pendentes na checklist P0.

## Correções aplicadas

| Severidade | Área                    | Inconsistência                                                                                                | Correção                                                                                              |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Crítica    | Segurança               | `product-segment` baixava URL arbitrária com redirects automáticos, permitindo SSRF contra endereços internos | reutilização do downloader com validação DNS/IP, redirects manuais, timeout e limite de 12 MB         |
| Alta       | Segurança               | requisições POST com `Origin` não permitido eram processadas antes de o navegador bloquear a resposta         | validação de origem passou a ocorrer também nas requisições reais                                     |
| Alta       | Controle de custo       | usuário autenticado podia chamar geração visual diretamente sem vincular o custo a uma geração debitada       | render exige `request_id` debitado, claim atômico de uso único e cobra regeneração visual manual      |
| Alta       | Supply chain            | `browserslist` vulnerável a OOM/prototype write e `baseline-browser-mapping` vulnerável a DoS                 | lockfile atualizado; `npm audit --audit-level=high` retorna zero vulnerabilidades                     |
| Alta       | Qualidade               | pipeline falhava em TypeScript, dois testes e formatação                                                      | regressão do recorte corrigida; 84 testes passam; lint, tipos, build e Prettier passam                |
| Alta       | Produto                 | Slides e Ficha técnica premium eram exportados como TXT                                                       | Slides agora geram `.pptx` editável; Ficha técnica gera `.pdf`; demais documentos preservam TXT/JSON  |
| Média      | Infraestrutura          | duas Edge Functions não eram verificadas pelo CI nem apareciam no roteiro de deploy                           | `image-render` e `product-segment` incluídas no Deno check e no guia de implantação                   |
| Média      | Segurança web           | frontend público não enviava CSP, anti-clickjacking, Permissions Policy ou política de referrer               | `vercel.json` adiciona os cabeçalhos e cache imutável para assets versionados                         |
| Média      | Privacidade operacional | erros de provedores de IA expunham modelos/códigos internos ao cliente                                        | produção recebe somente erro público e `request_id`; detalhes permanecem nos logs                     |
| Média      | Privacidade de imagens  | componentes enviavam URLs assinadas e prompts criativos a serviços públicos de imagem fora do backend         | integrações públicas removidas; geração usa o backend autenticado e previews preservam fallback local |
| Média      | UX de autenticação      | prompt e formato escolhidos como visitante eram perdidos quando o login era aberto                            | intenção pendente é retomada automaticamente depois que a sessão é autenticada                        |
| Média      | Integridade editorial   | IA introduzia processo artesanal, produtores, embalagem e pontos de venda sem fonte no briefing               | filtro determinístico remove alegações sem evidência da estratégia, copy e formatos estruturados      |
| Média      | Oferta/merchandising    | “Não informada” e “Sem oferta definida” podiam aparecer como promoção real no social e no e-mail              | tokens vazios são normalizados no brief e todos os previews usam a mesma verificação semântica        |
| Média      | Integridade visual      | imagem gerada podia inventar rótulo e grafia falsa da marca quando não havia foto real do produto             | prompts do frontend e do renderizador exigem produto e embalagem sem marca, rótulo ou texto inventado |
| Baixa      | Acessibilidade/SEO      | hierarquia de headings e progresso do briefing sem semântica completa; metadados desatualizados               | heading corrigido, `progressbar` acessível e descrição social atualizada                              |

## Validação autenticada do Vercel — 22/09/2026

O teste ponta a ponta no endereço público confirmou que o ambiente implantado ainda não contém esta branch de auditoria. A conta de teste gerou e salvou uma campanha sintética “Café Aurora”; nenhum dado comercial real foi usado.

| Fluxo                    | Resultado observado no Vercel público                                                                                   | Situação nesta branch                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| visitante → autenticação | prompt digitado e formato selecionado foram perdidos após login                                                         | corrigido e coberto por regressão                                     |
| créditos                 | descoberta consumiu 1 crédito; banner, social e e-mail consumiram 8 no total; Slides 8; Ficha técnica 4                 | débito observado corretamente                                         |
| geração factual          | estratégia e peças inventaram produtores locais, torrefação artesanal, embalagem, processo de cultivo e pontos de venda | novos filtros removem alegações sem evidência                         |
| oferta ausente           | social exibiu “OFERTA ESPECIAL” e e-mail mostrou literalmente “Não informada”                                           | normalização semântica aplicada ao brief e aos previews               |
| imagem de banner         | URL privada assinada, mas a imagem inventou texto de marca ilegível no copo                                             | direção visual agora exige superfícies sem marca e sem rótulos        |
| imagem de e-mail         | URL pública do Pollinations e retrato sem relação com o produto                                                         | integração pública já removida; renderização passa pelo backend       |
| biblioteca               | salvar e reabrir no Canvas funcionaram; listagem inicial levou cerca de 10 segundos                                     | funcional, mas latência deve entrar em observabilidade e teste de p95 |
| Slides                   | apenas TXT/JSON no Vercel; conteúdo continha fatos não confirmados                                                      | exportação PPTX e guardrails já implementados                         |
| Ficha técnica            | apenas TXT/JSON no Vercel; disclaimer factual estava correto                                                            | exportação PDF já implementada                                        |

**Conclusão da validação:** o Vercel público permanece **NO-GO** porque ainda expõe o pipeline antigo. O próximo passo de release é implantar esta branch seguindo a ordem P0 e repetir exatamente esta bateria em staging e produção.

## Pontos fortes confirmados

- visitantes conseguem explorar a proposta, mas uma chamada de IA abre autenticação antes de gerar custo;
- nenhuma chave de IA, Stripe ou service role aparece no bundle ou no histórico recente inspecionado;
- a biblioteca filtra `user_id` no cliente e repete a autoridade em RLS;
- Storage privado usa pasta iniciada pelo UUID e URLs assinadas;
- débito de créditos, rate limit e idempotência ocorrem no banco;
- falha total de IA aciona estorno;
- webhook Stripe valida HMAC, janela temporal, deduplicação e ordenação de eventos;
- scraper já validava DNS/IP e todos os redirects;
- conteúdo gerado passa por contratos Zod e guardrails contra ofertas, provas e alegações operacionais inventadas;
- exportação visual aguarda fontes e imagens e evita exportar canvas incompleto.

## Bloqueadores P0 antes do lançamento

1. **Implantar na ordem correta:** migração → segredos → Worker Cloudflare → Edge Functions → frontend Vercel.
2. **Executar teste multiusuário real:** criar duas organizações, tentar listar/ler/alterar/excluir assets cruzados, testar URL assinada expirada e usuário suspenso.
3. **Executar Stripe em modo teste:** checkout, webhook, portal, upgrade/downgrade, falha de pagamento, cancelamento e repetição do mesmo evento.
4. **Validar todo o fluxo autenticado:** briefing por texto, URL e imagem; geração de todos os formatos; retry; salvar; reabrir; exportar; esgotar créditos; bloqueio por plano.
5. **Definir escopo comercial de mídia:** hoje Reel, vídeo e podcast entregam roteiro estruturado, não MP4/MP3. Manter essa nomenclatura na oferta ou implantar uma fila assíncrona de renderização antes de prometer mídia final.
6. **Publicar Termos, Política de Privacidade/LGPD e canal de suporte**, incluindo base legal, retenção, suboperadores, exclusão de conta e tratamento de conteúdo enviado à IA.
7. **Configurar SMTP próprio e testar entregabilidade**, confirmação de e-mail, recuperação de senha e proteção contra abuso.
8. **Ativar observabilidade independente:** erros frontend/backend, p95, taxa de falha por provedor, gasto por geração, saldo/estorno, webhook falho e crescimento do Storage.
9. **Comprovar backup e restauração:** PITR/backup do Postgres, retenção do Storage e um exercício de restore em staging.

## Ajustes P1 recomendados para escala

- separar landing page pública de `/app`, reduzindo confusão entre demonstração e workspace;
- implementar gestão de membros, convites e troca de workspace — o banco já suporta organizações, mas o fluxo administrativo não está completo;
- adicionar fila assíncrona com status, cancelamento e retry para áudio/vídeo;
- versionar prompts e registrar somente metadados seguros para comparar qualidade e custo;
- adicionar testes E2E Playwright em desktop e mobile para os caminhos de receita;
- executar teste de carga nos limites de plano e validar custo real por milhão de tokens/arte;
- migrar alertas operacionais de console para Sentry/OpenTelemetry ou equivalente;
- criar política explícita de deleção/retenção para prompts, arquivos, ledger e eventos de cobrança;
- adicionar domínio próprio, e-mails transacionais com DMARC/DKIM/SPF e página pública de status.

## Critério de liberação

Liberar para os primeiros clientes somente quando todos os itens P0 tiverem evidência anexada e os seguintes comandos permanecerem verdes no commit de release:

```bash
npm ci --ignore-scripts
npm run validate
npm audit --audit-level=high
```

Após o deploy, confirmar que a página responde com CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy`, e repetir os testes de isolamento na infraestrutura de produção. A suíte local desta revisão contém 91 testes automatizados.
