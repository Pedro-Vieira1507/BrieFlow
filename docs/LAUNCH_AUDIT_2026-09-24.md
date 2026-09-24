# Validação de lançamento — 24/09/2026

## Situação

Venda pública ainda bloqueada até a implantação do frontend desta revisão, configuração do webhook Stripe e conclusão dos testes de pagamento e de mídia. A branch reúne a auditoria anterior e as correções desta rodada; o resultado publicado precisa ser validado separadamente.

## Correções

- Revisão editorial visível por peça: campos provisórios, números sem fonte, texto genérico, chamada repetida entre canais e conteúdo incompleto.
- Direção criativa com papéis complementares por canal; público, objetivo e tom não comprovam propriedades do produto. Alegações de dispensa de equipamento exigem confirmação.
- Tela inicial do estúdio mais clara, abertura correta do assistente no desktop, descrição acessível do chat mobile e ajuste ao teclado virtual.
- Créditos descritos como diários, atualização na virada do dia de São Paulo e acompanhamento do teto mensal gratuito.
- Salvar novamente atualiza a campanha aberta. Respostas atrasadas da IA e do salvamento são descartadas ao trocar conta ou campanha.
- Cobrança consulta disponibilidade e preço recorrente na Stripe, exige ambiente/chaves compatíveis e webhook configurado para liberar Checkout. Assinantes existentes seguem para o portal.
- Parser de IA aceita respostas Cloudflare nativas e no formato de chat, sem expor raciocínio ou argumentos de ferramentas. Retry respeita o prazo informado pelo provedor. O primeiro fallback já configurado volta a fazer parte da sequência.
- Migrações locais reconciliadas com o histórico remoto. Fontes de `media-render` e `multimodal`, antes presentes apenas no ambiente implantado, recuperadas e incluídas no CI.
- Autorização visual exige membro e assinatura ativos, formato permitido, débito da mesma organização com até 24 horas, sem estorno, e uso único.

## Evidências

- `npm run validate`: 111 testes aprovados; formatação, lint, TypeScript e build aprovados.
- `npm audit --audit-level=high`: zero vulnerabilidades.
- Deno: verificação das nove Edge Functions com dependências locais.
- Supabase: migração `20260924122326_visual_render_access_lifecycle` aplicada. Transação de teste confirmou autorização paga, bloqueio de repetição, ausência de débito, estorno, expiração e assinatura inativa; todos os dados de teste foram revertidos.
- RLS: quatro proprietários de assets existentes; role `authenticated` não leu, alterou ou excluiu assets de terceiros no teste transacional com rollback.
- Geração autenticada “Café Aurora”: e-mail e social gerados e campanha salva. Primeira tentativa de banner falhou nos provedores e teve estorno. Após atualizar `ai-proxy`, o texto do banner foi produzido em aproximadamente 3,4 s.
- Imagem: o bundle público antigo omite `request_id` e `action` ao chamar `image-render`. Isso é incompatível com a proteção implantada e explica a falha antes do provedor. O frontend desta branch envia ambos.
- Verificação pública: 8/10 itens aprovados. HTTPS e CORS passaram; faltam os cabeçalhos do novo frontend e `STRIPE_WEBHOOK_SECRET`.
- Stripe conectada em modo de teste; nenhum endpoint de webhook cadastrado na consulta inicial. Não houve cobrança real.

## Pendências para liberação

1. Implantar o frontend corrigido e repetir banner/imagem, salvar/reabrir, exportação PPTX/PDF e teste visual mobile. O ajuste de teclado ainda requer aparelho real.
2. Registrar o endpoint Stripe, guardar o segredo no Supabase e testar Checkout, portal, renovação, falha, cancelamento e reentrega de evento. Validar configuração de impostos aplicável antes da venda; impostos automáticos não foram ativados nesta revisão.
3. Ativar proteção de senhas vazadas no Auth. As tabelas internas sem políticas são fechadas aos clientes por RLS; o RPC `get_user_plan` precisa continuar autorizado apenas à própria conta.
4. Validar áudio/vídeo finais, latência, recuperação de senha/SMTP, termos/canais de suporte, observabilidade e restauração de backup. Recuperar as fontes de mídia não equivale a validar a entrega final desses formatos.

## Limites desta evidência

O teste SQL não substitui duas sessões independentes de navegador. Build, testes unitários e verificações estáticas não certificam qualidade editorial de agência nem capacidade de carga. A versão pública antiga não permite afirmar que as melhorias de interface desta branch foram testadas em produção.
