// src/lib/marketingPrompts.ts
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
- Sem markdown, sem crases, sem comentários.
- Nunca use Enter dentro de strings: escreva os caracteres \\n quando precisar quebrar linha.
- Preencha TODOS os campos do schema. Se faltar dado, escreva algo verdadeiro e genérico o suficiente – nunca copie a instrução do schema como valor.`;

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
  email: `CANAL – E-MAIL:
- Assunto curto (até 45 caracteres) com benefício; preheader complementa (não repete).
- Primeiro parágrafo entrega o valor; os seguintes sustentam com prova e detalhe.
- Um único botão de CTA, repetido no máximo duas vezes.`,
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

  // BLINDAGEM: Identifica se a URL é um código Base64 gigante e oculta da IA!
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

  return `
=== PRODUTO EM DESTAQUE ===
${lines.join("\n")}

Instruções:
- A copy deve ser COERENTE com este produto e com a imagem que aparecerá na peça.
- Descreva benefícios plausíveis para ESTE produto; não fale de outra categoria.
- Não descreva a imagem em palavras ("veja a foto"); a copy complementa o visual.
- No campo "imagePrompt", crie uma cena que CONVIVA com a foto do produto (fundo, ambiente, iluminação) em vez de disputar o mesmo espaço.`;
}

function literalRequirementsSection(brief: MarketingBrief): string {
  if (!brief.context) return "";
  return `
=== EXIGÊNCIAS LITERAIS DO CLIENTE (prioridade máxima) ===
${brief.context}

Se o cliente enviou textos exatos (títulos, legendas, hashtags), TRANSCREVA palavra por palavra. Não resuma, não reescreva, não "melhore".`;
}

export function buildDiscoveryPrompt(
  brief: MarketingBrief,
  latestMessage: string,
): PromptPair {
  const system = `Você é o BrieFlow Creative Director: diretor de criação e estrategista sênior de performance.
Sua tarefa nesta fase é ENTENDER o briefing, não gerar peças finais.

${BRAND_VOICE}

${brandSection(brief)}

${productSection(brief)}

REGRAS:
- "productSku" só é preenchido se o usuário enviar link DIRETO de UM produto.
- Retenção literal: transcreva em "detectedContext" toda exigência exata de copy.
- Confirme o que entendeu e pergunte se pode gerar as peças.

${OUTPUT_CONTRACT}

SCHEMA:
{
  "chat": "Resposta humana confirmando o que captou e perguntando se pode gerar.",
  "discoveryPlan": {
    "detectedContext": "Exigências literais do cliente ou resumo fiel do briefing",
    "offer": "Oferta/cupom mencionado, ou null",
    "missingInfo": "O que ainda falta descobrir",
    "proposedStrategy": "Estratégia baseada apenas nos fatos do briefing",
    "brandName": "Nome oficial da marca",
    "productSku": "SKU ou URL direta de produto, ou null"
  }
}`;
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

  const system = `Você é o BrieFlow Art Director & Copywriter sênior, especialista em copy de alta conversão.
Sua tarefa: produzir a peça ${material.toUpperCase()} para o canal ${channel.toUpperCase()}.

${BRAND_VOICE}

${COPY_QUALITY_RULES}

${CHANNEL_PLAYBOOKS[channel]}

${brandSection(brief)}

${offerSection(brief)}

${productSection(brief)}

${literalRequirementsSection(brief)}

${OUTPUT_CONTRACT}

SCHEMA JSON OBRIGATÓRIO:
${SCHEMA_HINTS[material]}`;

  const briefing =
    options.channelBriefing?.trim() ||
    brief.context?.trim() ||
    brief.strategy?.trim() ||
    "Sem briefing adicional: use os dados da marca acima.";

  const user = `=== BRIEFING DESTA PEÇA ===
${briefing}

=== TAREFA ===
Gere AGORA o JSON da peça ${material.toUpperCase()} para ${channel.toUpperCase()}.
Cada campo deve conter copy final, pronta para publicar.`;

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