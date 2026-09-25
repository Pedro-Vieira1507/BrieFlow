# BrieFlow: texto, publicação e desempenho

## Preservação e direção

A versão gráfica completa foi preservada em `archive/graphic-studio-20260924`, commit `ff1e20c203f5f609aa131564b7f80a310c36a991`. Ela inclui a correção de integridade do PPTX. A refatoração está em `refactor/text-social-platform-20260924`. Dados e funções da versão gráfica não são apagados.

O produto agora trabalha com um briefing factual, anexos privados e textos diferentes para LinkedIn, Instagram, Facebook, X, TikTok e Reddit. A IA produz apenas texto. A configuração dos modelos existentes não foi alterada. A geração usa a ação `social`, com os controles existentes de autenticação, plano, créditos e rate limit: 2 créditos por texto/rede, sem renderização gráfica.

Os anexos são mídia pronta fornecida pelo cliente. A IA recebe as descrições escritas, não uma análise visual automática. As frequências sugeridas são as diretrizes iniciais fornecidas pelo usuário, ajustáveis pela estratégia editorial, não garantias de resultado.

## Escopo dos conectores desta primeira versão

| Rede      | Publicação implementada                                         | Leitura de desempenho                                                                        |
| --------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| LinkedIn  | Perfil pessoal, texto ou uma imagem JPEG/PNG                    | Impressões, alcance, reações, comentários, reposts; requer `r_member_postAnalytics` aprovado |
| Instagram | Conta profissional, uma foto JPEG e legenda                     | Views, alcance, likes, comentários, shares, saved quando o endpoint os disponibiliza         |
| Facebook  | Página administrada, texto ou uma foto JPEG/PNG                 | Reações, comentários e compartilhamentos; views/alcance ainda não implementados              |
| X         | Um post de texto, sem threads ou mídia                          | Métricas públicas, incluindo impressões quando presentes; sem alcance único                  |
| TikTok    | Vídeo MP4 próprio via Direct Post                               | Views, likes, comentários, shares de vídeo publicado com ID público acessível                |
| Reddit    | Self-post com título e corpo, subreddit e confirmação de regras | Votos líquidos e comentários; sem conversão de votos em curtidas                             |

Carrosséis, artigos, Reels, Stories e threads podem ser orientados por texto/roteiro, mas sua montagem e publicação automática não estão incluídas nesta entrega. O Facebook Groups não faz parte do conector. A primeira versão não inclui agendamento nem atualização de métricas em segundo plano.

## Ativação externa: obrigatória antes de uso real

Não existe conta demonstrativa, token simulado, post fabricado nem métrica fictícia. As conexões ficam desabilitadas até a configuração explícita. Os adaptadores foram implementados a partir das referências oficiais abaixo; testes de contrato não substituem homologação com contas reais.

Segredos somente nas Edge Functions, nunca em variáveis `VITE_*`, código, PRs ou arquivos versionados:

- `SOCIAL_TOKEN_ENCRYPTION_KEY`: 32 bytes aleatórios em base64/base64url. Backup e rotação exigem procedimento seguro; trocar a chave sem recriptografar invalida conexões anteriores.
- `APP_URL`: origem oficial do BrieFlow. O callback não aceita redirect fornecido pelo navegador.
- Para cada rede: `SOCIAL_<REDE>_CLIENT_ID`, `SOCIAL_<REDE>_CLIENT_SECRET`, `SOCIAL_<REDE>_ENABLED=true`. Redes: LINKEDIN, INSTAGRAM, FACEBOOK, X, TIKTOK, REDDIT. No TikTok, CLIENT_ID recebe o client key.
- Meta: `SOCIAL_META_API_VERSION` explícita e suportada pelo aplicativo (formato `vNN.N`). Sem uma versão configurada, não habilitar Instagram/Facebook.
- LinkedIn: `SOCIAL_LINKEDIN_API_VERSION` (padrão de implementação `202607`), `SOCIAL_LINKEDIN_ANALYTICS=true` apenas após aprovação da permissão de analytics.
- Reddit: `SOCIAL_REDDIT_USER_AGENT` único, verdadeiro, com versão e contato conforme a política oficial; acesso à Data API aprovado.
- TikTok: `SOCIAL_TIKTOK_MEDIA_PREFIX`, prefixo HTTPS terminado em `/`, verificado na plataforma, correspondente às URLs assinadas da mídia. Direct Post requer auditoria para remover a restrição de visibilidade de clientes não auditados. A interface consulta creator info, não preseleciona privacidade/interações e exige consentimentos.

Callback a registrar em cada aplicativo:

`https://ushsfrhavhbqsctebaiu.supabase.co/functions/v1/social-oauth`

As primeiras autorizações usam os tokens obtidos no OAuth, com a expiração informada pelo provedor. Não há refresh token automático nesta versão: a interface pede reconexão. No Facebook, são carregadas até 100 páginas elegíveis por autorização. A revogação no BrieFlow remove a credencial local; revogar também na rede é uma ação separada.

Nenhum serviço pago foi contratado. As redes podem exigir plano comercial, revisão, verificação de empresa e aprovação dos escopos. Sem isso não é possível afirmar que publicação/analytics estão operacionais em produção.

## Segurança e consistência

- Novas tabelas com RLS, seleção por dono e vínculo ativo na organização; escrita apenas pelo backend autenticado. FK composta impede misturar campanha, dono e organização.
- Anexos em bucket privado `social-briefs`, caminho por usuário/campanha, limite de 25 MB e até 12 anexos no briefing. Objetos não são sobrescritos pelo navegador; a publicação envia apenas a mídia selecionada.
- Credenciais separadas de linhas visíveis pelo cliente, AES-GCM com binding de usuário/organização/rede/conta.
- OAuth: state aleatório, armazenado como hash, expirando em 10 minutos, consumido atomicamente. PKCE S256 para X. Falhas não retornam corpo do provedor nem tokens.
- Revisão exige confirmação de destino, conteúdo e direitos de mídia. Versão do post é conferida em transação; uma tentativa por post, com snapshot do texto aprovado. Sem retry automático de escrita externa.
- Estados distinguem rascunho, envio, processamento, publicação confirmada, recusa e incerteza. Instagram persiste o container antes da etapa final; essa etapa tem claim atômico. Consulta de status é manual e necessária para concluir o container Instagram. TikTok também usa consulta manual de status. Uma invocação de envio interrompida é classificada como incerta após dois minutos, ao consultar o status.
- Métricas ausentes são `null`, exibidas como “—”; zero só existe se retornado pela API. Snapshots datados, cache de 15 minutos, sem soma de alcance entre plataformas. Os conceitos das métricas não são tratados como equivalentes.
- Mudança de conta interrompe a geração e descarta resultados atrasados. Salvamento usa controle otimista de versão.

## Homologação necessária para ativar um conector

1. Registrar o aplicativo oficial, aprovar os escopos e configurar segredos sem exposição.
2. Validar OAuth autorizado, negado, expirado, state repetido e troca de usuário/organização.
3. Autorizar explicitamente um post de teste na conta correta; conferir texto, mídia, consentimentos e link remoto.
4. Testar timeout ambíguo e dois cliques simultâneos; confirmar que não há post duplicado.
5. Consultar métricas reais e comparar com as definições da rede, distinguindo zero de ausência.
6. Habilitar a flag da rede somente depois da homologação e acompanhar expiração/revogação.

## Referências oficiais consultadas em 24/09/2026

- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-07) e [Member Post Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/members/post-statistics?view=li-lms-2026-06).
- [Instagram Content Publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing), [Business Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login) e [Facebook Pages Posts](https://developers.facebook.com/documentation/pages-api/posts). Parte das páginas Meta não foi acessível integralmente; a homologação da versão e das métricas é requisito de ativação.
- [X OAuth 2.0 PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) e [X metrics](https://docs.x.com/x-api/fundamentals/metrics).
- [TikTok Direct Post](https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post), [Creator Info](https://developers.tiktok.com/docs/en/content-posting-api-reference-query-creator-info), [Status](https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status) e [Video Query](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-query).
- [Reddit Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki), [API reference](https://www.reddit.com/dev/api/) e [OAuth](https://github.com/reddit-archive/reddit/wiki/oauth2).
- [Supabase Storage private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) e [alteração de exposição explícita da Data API](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
