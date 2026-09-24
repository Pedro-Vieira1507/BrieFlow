# Validação de lançamento — 24/09/2026

## Situação

Frontend da PR #20 integrado em `main` e implantado na Vercel, commit `f3d06f9`. Geração autenticada de banner com imagem, atualização da campanha salva e exportação PNG verificadas em produção. O webhook de teste foi configurado e sua assinatura verificada. A venda pública ainda depende da configuração Stripe de produção e da conclusão dos testes de pagamento, mídia e operação.

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

- `npm run validate`: 112 testes aprovados; formatação, lint, TypeScript e build aprovados. CI e CodeQL da PR #20 aprovados.
- Instalação limpa com npm 10.9.8 (mesma versão do CI) aprovada após completar o lockfile com o peer opcional `lru-cache` do Nitro. A validação completa passou novamente após a instalação.
- `npm audit --audit-level=high`: zero vulnerabilidades.
- Deno: verificação das nove Edge Functions com dependências locais.
- Supabase: migração `20260924122326_visual_render_access_lifecycle` aplicada. Transação de teste confirmou autorização paga, bloqueio de repetição, ausência de débito, estorno, expiração e assinatura inativa; todos os dados de teste foram revertidos.
- RLS: quatro proprietários de assets existentes; role `authenticated` não leu, alterou ou excluiu assets de terceiros no teste transacional com rollback.
- Geração autenticada “Café Aurora”: e-mail e social gerados e campanha salva. Primeira tentativa de banner falhou nos provedores e teve estorno. Após atualizar `ai-proxy`, o texto do banner foi produzido em aproximadamente 3,4 s.
- Imagem: o bundle público antigo omite `request_id` e `action` ao chamar `image-render`. Isso é incompatível com a proteção implantada e explica a falha antes do provedor. O frontend desta branch envia ambos.
- Após o deploy: banner Café Aurora gerado com imagem; texto produzido em 5,0 s. O salvamento atualizou o registro criado às 12:19, sem duplicá-lo. PNG desktop exportado e aberto, 2400 × 1200 pixels.
- Verificação pública após o deploy: 10/10 itens aprovados. HTTPS, cabeçalhos de segurança, CORS permitido/rejeitado e rejeição de assinatura Stripe inválida passaram.
- Stripe conectada em modo de teste; endpoint `we_1UJC3qPDxDpQuWa8mDTm8E8p` registrado. Evento sintético assinado foi aceito com HTTP 200 e a reentrega identificada como duplicada, sem alteração de assinatura ou saldo. Isso verifica HMAC e idempotência, não um pagamento real.
- Inspeção do banner mobile encontrou recorte lateral que escondia o produto. Ajuste complementar centraliza o enquadramento e usa contraste vertical; o subtítulo distribui melhor as linhas. Revisão editorial passa a sinalizar repetição entre subtítulo e texto de apoio. Notificações ficam abaixo dos controles do cabeçalho.

## Pendências para liberação

1. Verificar o ajuste complementar do banner mobile, exportação PPTX/PDF e interface em aparelho real. O ajuste de teclado ainda requer aparelho real.
2. Testar Checkout, portal, renovação, falha e cancelamento em ambiente de teste. Para vendas, conectar e validar a configuração Stripe de produção. Validar configuração de impostos aplicável antes da venda; impostos automáticos não foram ativados nesta revisão.
3. Proteção de senhas vazadas: o painel confirmou que exige Supabase Pro ou superior; projeto atual no Free. Nenhuma assinatura paga foi contratada. As tabelas internas sem políticas são fechadas aos clientes por RLS; o RPC `get_user_plan` precisa continuar autorizado apenas à própria conta.
4. Validar áudio/vídeo finais, latência, recuperação de senha/SMTP, termos/canais de suporte, observabilidade e restauração de backup. Recuperar as fontes de mídia não equivale a validar a entrega final desses formatos.

## Limites desta evidência

O teste SQL não substitui duas sessões independentes de navegador. Build, testes unitários e verificações estáticas não certificam qualidade editorial de agência nem capacidade de carga. A prévia mobile do exportador não substitui o teste da aplicação em um telefone.
