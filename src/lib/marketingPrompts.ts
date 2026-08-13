import { formatSiteContextForAgent } from "@/lib/scrape-site";
import { SCHEMA_HINTS } from "@/types/generatedContent";
import {
  hasProductContext,
  type MarketingBrief,
  type MarketingChannel,
  type MaterialType,
} from "@/types/brief";

export interface PromptPair {
  system: string;
  user: string;
}

export const BRAND_VOICE = `TOM E VOZ (obrigatório em todas as peças):
- Português do Brasil, sempre. Nunca misture idiomas na copy.
- Profissional, premium e direto: frases curtas, zero enrolação, zero "encheção de linguiça".
- Foco em BENEFÍCIO e resultado para o cliente, não em características técnicas.
- Confiança sem arrogância: afirme, não implore. Nunca use tom de desespero.
- Escreva para leitura rápida em celular: uma ideia por frase.`;

export const COPY_QUALITY_RULES = `PADRÃO DE QUALIDADE (checklist de conversão):
1. HEADLINE: benefício principal específico, mensurável quando possível. Nunca genérica ("qualidade e excelência", "a melhor escolha" são PROIBIDAS).
2. SUBHEADLINE: explica a proposta de valor – o que é, para quem e por que agora.
3. CTA: começa com verbo de ação, no máximo 4 palavras, sem "clique aqui".
4. BENEFÍCIOS: em linguagem de resultado ("reduza X em Y"), não de feature.
5. OBJEÇÕES: antecipe as 2-3 dúvidas reais do público e responda em 1 frase.
6. GATILHOS: use urgência, escassez, autoridade ou prova social APENAS quando houver fato real no briefing que sustente. Inventar prova é proibido.
7. PROIBIDO: jargão corporativo, clichê de IA ("no mundo atual", "desbloqueie todo o potencial"), repetição da mesma palavra em headline e subheadline, emojis em excesso (máximo 1 por peça e só em social), exclamações múltiplas.
8. ZERO ALUCINAÇÃO: nunca invente preço, prazo, número, prêmio, endereço ou depoimento. Se o dado não está no briefing, não existe.`;

const OUTPUT_CONTRACT = `FORMATO DE SAÍDA:
- Responda EXCLUSIVAMENTE com um objeto JSON válido, sem texto ao redor.
- Sem markdown, sem crases, sem comentários. Apenas o JSON.`;

export const CHANNEL_PLAYBOOKS: Record<MarketingChannel, string> = {
  landing: `CANAL – LANDING PAGE / BANNER:
- Hierarquia clara: headline > subheadline > benefícios > CTA único.
- Uma única ação desejada. Não ofereça caminhos alternativos.
- Prova social e garantia reduzem atrito: use se houver fato real.`,
  linkedin: `CANAL – LINKEDIN:
- Abertura em 1 linha com dado, tensão de mercado ou consequência de negócio.
- Tom consultivo e sóbrio; zero hype, zero emoji decorativo.
- Fecha com pergunta ou convite profissional. 3 a 5 hashtags de setor.`,
  instagram: `CANAL – INSTAGRAM:
- Primeira linha é tudo: precisa parar o scroll antes do "ver mais".
- Frases curtas, ritmo visual, quebras de linha frequentes.
- CTA claro para bio/DM/link. 5 a 8 hashtags relevantes (sem hashtag genérica de spam).`,
  facebook: `CANAL – FACEBOOK:
- Linguagem coloquial e concreta, foco em benefício imediato e prova.
- Texto médio, com CTA explícito no final. 2 a 4 hashtags no máximo.`,
  email: `CANAL – E-MAIL MARKETING (padrão iFood/Amazon):
- O e-mail é uma CARTA DE VENDAS em miniatura, não um aviso genérico.
- ASSUNTO: até 45 caracteres, com o benefício ou oferta. Preheader complementa sem repetir.
- HERO BADGE: se houver oferta, preencha com um selo curto (ex: "OFERTA RELÂMPAGO", "NOVIDADE", "ÚLTIMA CHANCE"). Se não houver, deixe vazio.
- HEADLINE: título dentro do e-mail. Deve entregar o benefício principal ou a oferta.
- SUBTITLE: 1 frase de apoio que reforça o benefício e cria conexão emocional.
- BODY: 2 a 3 parágrafos persuasivos. Primeiro parágrafo entrega o valor. Segundo sustenta com prova ou detalhe. Terceiro prepara o CTA.
- BENEFIT TITLE: título curto para a seção de benefícios (ex: "Por que você vai amar", "O que muda pra você").
- KEY BENEFITS: 3 a 4 benefícios em bullets, cada um em linguagem de resultado (não de feature).
- OBJECTIONS: 1 a 2 objeções reais respondidas em 1 frase cada.
- URGENCY TEXT: se houver gatilho real (prazo, estoque limitado), preencha (ex: "Últimas 24 horas", "Restam poucas unidades"). Se não houver, deixe vazio.
- TESTIMONIAL: se houver depoimento real no briefing, use. Se não houver, deixe vazio — NUNCA invente.
- CTA TEXT: verbo de ação + benefício (ex: "Quero meu desconto", "Garantir agora").
- SECONDARY CTA: repita o CTA no final do e-mail para reforçar a ação.
- FOOTER INFO: informações práticas que reduzem atrito (ex: "Frete grátis", "Troca em 30 dias", "Pagamento seguro"). Se não houver, deixe vazio.
- ESTRUTURA VISUAL: o e-mail deve ter ritmo — hero impactante, headline, body, benefícios em cards, oferta destacada, CTA, prova/urgência, CTA secundário, footer.
- PROIBIDO: e-mail de parágrafo único sem hierarquia. O e-mail precisa respirar com seções distintas.`,
  whatsapp: `CANAL – WHATSAPP:
- Mensagem curta, pessoal, tratamento direto. Uma pergunta ou um CTA, nunca os dois.`,
  generic: `CANAL – MULTICANAL:
- Copy adaptável: headline forte, benefício claro e CTA único.`,
};

const MATERIAL_CHANNEL: Record<MaterialType, MarketingChannel> = {
  banner: "landing",
  social: "instagram",
  email: "email",
};

function brandSection(brief: MarketingBrief): string {
  const lines = [
    `Marca (use EXATAMENTE esta grafia, é proibido alterar): ${brief.brandName}`,
    brief.product ? `Produto/serviço: ${brief.product}` : null,
    brief.audience ? `Público: ${brief.audience}` : null,
    brief.tone ? `Tom preferido pelo cliente: ${brief.tone}` : null,
    brief.framework ? `Framework de copy: ${brief.framework}` : null,
    brief.objective ? `Objetivo da campanha: ${brief.objective}` : null,
  ].filter((line): line is string => line !== null);

  const site = brief.site ? formatSiteContextForAgent(brief.site) : null;

  return [`=== MARCA ===`, ...lines, site ?? "Nenhum site analisado ainda."].join(
    "\n",
  );
}

function offerSection(brief: MarketingBrief): string {
  return brief.offer
    ? `=== OFERTA ===\nA campanha possui a seguinte oferta OBRIGATÓRIA: [${brief.offer}]. \nREGRA CRÍTICA: Você DEVE escrever a oferta e o cupom OBRIGATORIAMENTE no texto da sua peça (títulos, corpo ou CTA). Peças sem a menção explícita da oferta serão rejeitadas pelo sistema.`
    : `=== OFERTA ===\nNÃO existe desconto, cupom ou promoção. É ESTRITAMENTE PROIBIDO usar "%", "desconto", "promoção" ou inventar qualquer condição comercial.`;
}

function productSection(brief: MarketingBrief): string {
  if (!hasProductContext(brief)) return "";

  const safeImgUrl = brief.productImageUrl?.startsWith("data:image")
    ? "[Imagem salva pelo usuário - Ignore o link e gere os textos perfeitamente]"
    : brief.productImageUrl;

  const lines = [
    brief.productTitle ? `Produto: ${brief.productTitle}` : null,
    brief.productDescription ? `Descrição: ${brief.productDescription}` : null,
    brief.productUrl ? `Página do produto: ${brief.productUrl}` : null,
    brief.productImageUrl
      ? `Existe uma IMAGEM REAL do produto que será exibida na peça: ${safeImgUrl}`
      : null,
  ].filter((line): line is string => line !== null);

  return `\n=== PRODUTO EM DESTAQUE ===\n${lines.join("\n")}\n\nInstruções:\n- A copy deve ser COERENTE com este produto e com a imagem que aparecerá na peça.\n- Descreva benefícios plausíveis para ESTE produto; não fale de outra categoria.\n- Não descreva a imagem em palavras ("veja a foto"); a copy complementa o visual.\n- No campo "imagePrompt", crie uma cena que CONVIVA com a foto do produto (fundo, ambiente, iluminação) em vez de disputar o mesmo espaço.`;
}

function literalRequirementsSection(brief: MarketingBrief): string {
  if (!brief.context) return "";
  return `\n=== EXIGÊNCIAS LITERAIS DO CLIENTE (prioridade máxima) ===\n${brief.context}\n\nSe o cliente enviou textos exatos (títulos, legendas, hashtags), TRANSCREVA palavra por palavra. Não resuma, não reescreva, não "melhore".`;
}

export function buildDiscoveryPrompt(
  brief: MarketingBrief,
  latestMessage: string,
): PromptPair {
  const system = `Você é o BrieFlow Creative Director: diretor de criação e estrategista sênior de performance.\nSua tarefa nesta fase é ENTENDER o briefing, não gerar peças finais.\n\n${BRAND_VOICE}\n\n${brandSection(brief)}\n\n${productSection(brief)}\n\nREGRAS:\n- "productSku" só é preenchido se o usuário enviar link DIRETO de UM produto.\n- Retenção literal: transcreva em "detectedContext" toda exigência exata de copy.\n- Confirme o que entendeu e pergunte se pode gerar as peças.\n\n${OUTPUT_CONTRACT}\n\nSCHEMA:\n{\n  "chat": "Resposta humana confirmando o que captou e perguntando se pode gerar.",\n  "discoveryPlan": {\n    "detectedContext": "Exigências literais do cliente ou resumo fiel do briefing",\n    "offer": "Oferta/cupom mencionado, ou null",\n    "missingInfo": "O que ainda falta descobrir",\n    "proposedStrategy": "Estratégia baseada apenas nos fatos do briefing",\n    "brandName": "Nome oficial da marca",\n    "productSku": "SKU ou URL direta de produto, ou null"\n  }\n}`;
  return { system, user: latestMessage };
}

export interface MaterialPromptOptions {
  channel?: MarketingChannel;
  channelBriefing?: string;
}

export function buildMaterialPrompt(
  brief: MarketingBrief,
  material: MaterialType,
  options: MaterialPromptOptions = {},
): PromptPair {
  const channel = options.channel ?? MATERIAL_CHANNEL[material];

  const system = `Você é o BrieFlow Art Director & Copywriter sênior, especialista em copy de alta conversão.\nSua tarefa: produzir a peça ${material.toUpperCase()} para o canal ${channel.toUpperCase()}.\n\n${BRAND_VOICE}\n\n${COPY_QUALITY_RULES}\n\n${CHANNEL_PLAYBOOKS[channel]}\n\n${brandSection(brief)}\n\n${offerSection(brief)}\n\n${productSection(brief)}\n\n${literalRequirementsSection(brief)}\n\n${OUTPUT_CONTRACT}\n\nSCHEMA JSON OBRIGATÓRIO:\n${SCHEMA_HINTS[material]}`;

  const briefing =
    options.channelBriefing?.trim() ||
    brief.context?.trim() ||
    brief.strategy?.trim() ||
    "Sem briefing adicional: use os dados da marca acima.";

  const user = `=== BRIEFING DESTA PEÇA ===\n${briefing}\n\n=== TAREFA ===\nGere AGORA o JSON da peça ${material.toUpperCase()} para ${channel.toUpperCase()}.\nCada campo deve conter copy final, pronta para publicar.`;

  return { system, user };
}

export function extractChannelBriefing(
  text: string,
  material: MaterialType,
): string {
  const markers: Record<MaterialType, string[]> = {
    banner: ["BANNER:"],
    email: ["E-MAIL:", "EMAIL:"],
    social: ["POST SOCIAL:", "SOCIAL:"],
  };

  const upper = text.toUpperCase();
  const allMarkers = Object.values(markers).flat();

  if (!allMarkers.some((marker) => upper.includes(marker))) return text;

  const own = markers[material].find((marker) => upper.includes(marker));
  if (!own) return text;

  const start = upper.indexOf(own) + own.length;
  let end = text.length;

  for (const marker of allMarkers.filter((m) => m !== own)) {
    const index = upper.indexOf(marker, start);
    if (index !== -1 && index < end) end = index;
  }

  return text.slice(start, end).trim();
}
