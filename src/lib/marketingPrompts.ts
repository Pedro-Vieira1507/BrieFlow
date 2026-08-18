// src/lib/marketingPrompts.ts
import { formatSiteContextForAgent } from "@/lib/scrape-site";
import { SCHEMA_HINTS } from "@/types/generatedContent";
import { hasProductContext, type MarketingBrief, type MarketingChannel, type MaterialType } from "@/types/brief";

export interface PromptPair {
  system: string;
  user: string;
}

export const BRAND_VOICE = `TOM E VOZ (OBRIGATÓRIO EM TODAS AS PEÇAS):
- Português do Brasil (PT-BR) moderno e fluido.
- Profissional, premium, mas altamente persuasivo e direto.
- Evite jargões complexos, foque no DESEJO e no BENEFÍCIO FINAL do cliente.
- Escreva para leitura dinâmica (skimming) em celulares: ideias curtas, impacto rápido.
- NUNCA use palavras excessivamente formais ou robóticas como "adentrar", "destarte", "inovador". Use tom de conversa humana.`;

export const COPY_QUALITY_RULES = `REGRAS RÍGIDAS DE COPYWRITING (Checklist de Conversão):
1. HEADLINE (Título): Deve prometer um benefício forte ou resolver uma dor. PROIBIDO ser genérico. (MÁXIMO DE 6 PALAVRAS).
2. SUBHEADLINE (Subtítulo): Expande a headline com clareza. (MÁXIMO DE 12 PALAVRAS).
3. CTA (Botão): Verbo de ação direto focado no ganho do usuário. Ex: "Garantir Desconto", "Ver Detalhes". (MÁXIMO 3 PALAVRAS).
4. BENEFÍCIOS: Use linguagem de resultado ("reduza X", "ganhe Y").
5. ZERO ALUCINAÇÃO: Não invente preços, prazos ou frete grátis se não estiverem no briefing explícito. Se não houver preço, foque no valor agregado.`;

const OUTPUT_CONTRACT = `FORMATO DE SAÍDA:
- Responda EXCLUSIVAMENTE com um objeto JSON válido.
- Sem markdown ao redor, sem crases, apenas o JSON bruto.`;

export const CHANNEL_PLAYBOOKS: Record<MarketingChannel, string> = {
  landing: `CANAL - BANNER (ALTA RESTRIÇÃO DE ESPAÇO VISUAL):
- O texto do banner DEVE SER CURTO e IMPACTANTE para leitura em 2 segundos.
- CONTEÚDO RICO: Não faça banners vazios. Use o campo "body" para adicionar 1 parágrafo curto. Use "keyBenefits" para listas e "footerInfo" para regras legais.
- BADGES: Se houver oferta, preencha 'badgePrimary' com exatas 2 palavras (ex: 15% OFF) e 'badgeSecondary' (ex: FRETE GRÁTIS). Limite absoluto de 15 caracteres por badge!
- LAYOUT: Vocẽ DEVE variar o campo "layoutStyle" entre "split", "reverse" ou "centered".`,
  linkedin: `CANAL - LINKEDIN: Tom consultivo B2B, abertura forte com dados do mercado ou insights de negócios.`,
  instagram: `CANAL - INSTAGRAM:
- HOOK (Gancho): A primeira frase deve parar o scroll (ex: uma pergunta provocativa ou quebra de padrão).
- TEXTO: Use parágrafos muito curtos (1 ou 2 frases cada). Fluido e visual.
- CTA: Direto para o link da bio ou comentário.`,
  facebook: `CANAL - FACEBOOK: Foco em prova social, história relatável e benefício imediato com link claro.`,
  email: `CANAL - E-MAIL MARKETING (PREMIUM E DINÂMICO):
- FRAMEWORK OBRIGATÓRIO: Use AIDA (Atenção, Interesse, Desejo, Ação) ou PAS (Problema, Agitação, Solução) na estrutura da copy.
- ASSUNTO E PREHEADER: Criam curiosidade magnética. Use gatilhos mentais.
- BODY: Divida em 2 ou 3 parágrafos curtos criando profunda conexão e desejo.
- TESTIMONIALS: Essencial para prova social! Crie 2 a 3 cards realistas preenchendo a lista 'testimonials' EXATAMENTE no formato: "Nome - Resultado | 'Frase do depoimento'".
- HERO BADGE: Um selo superior curto (ex: "OFERTA VIP", "NOVIDADE").
- FOOTER INFO: Avisos legais, regras de oferta ou validade curtas.`,
  whatsapp: `CANAL - WHATSAPP: Curto, pessoal, formatado com negrito (*texto*) e uma única chamada para ação clara.`,
  generic: `CANAL - MULTICANAL: Copy adaptável e direta ao ponto.`
};

const MATERIAL_CHANNEL: Record<MaterialType, MarketingChannel> = { banner: "landing", social: "instagram", email: "email" };

function brandSection(brief: MarketingBrief): string {
  const lines = [
    `Marca: ${brief.brandName}`,
    brief.product ? `Produto/serviço: ${brief.product}` : null,
    brief.audience ? `Público: ${brief.audience}` : null,
    brief.tone ? `Tom: ${brief.tone}` : null,
  ].filter((l): l is string => l !== null);

  const site = brief.site ? formatSiteContextForAgent(brief.site) : null;
  return [`=== MARCA ===`, ...lines, site ?? "Nenhum site analisado."].join("\n");
}

function offerSection(brief: MarketingBrief): string {
  return brief.offer ? `=== OFERTA ===\nOFERTA OBRIGATÓRIA: [${brief.offer}]. Inclua agressivamente no texto, headlines e badges.` : `=== OFERTA ===\nNÃO HÁ OFERTA/CUPOM. Não invente descontos, foque no valor e exclusividade.`;
}

function productSection(brief: MarketingBrief): string {
  if (!hasProductContext(brief)) return "";
  const lines = [
    brief.productTitle ? `Produto: ${brief.productTitle}` : null,
    brief.productDescription ? `Descrição: ${brief.productDescription}` : null,
  ].filter((l): l is string => l !== null);
  return `\n=== PRODUTO ===\n${lines.join("\n")}`;
}

export function buildDiscoveryPrompt(brief: MarketingBrief, latestMessage: string): PromptPair {
  const system = `Você é o BrieFlow Creative Director.\n${BRAND_VOICE}\n${brandSection(brief)}\n${OUTPUT_CONTRACT}`;
  return { system, user: latestMessage };
}

export interface MaterialPromptOptions {
  channel?: MarketingChannel;
  channelBriefing?: string;
}

export function buildMaterialPrompt(brief: MarketingBrief, material: MaterialType, options: MaterialPromptOptions = {}): PromptPair {
  const channel = options.channel ?? MATERIAL_CHANNEL[material];

  let layoutEnforcement = "";
  if (material === "email") {
    const layouts = ["centered", "minimalist", "split", "diagonal"];
    const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];
    layoutEnforcement = `\n\nREGRA CRÍTICA DE DESIGN: Para esta geração específica, você DEVE OBRIGATORIAMENTE definir o campo "layoutStyle" exato como "${randomLayout}". Isso é essencial para layouts únicos.`;
  } else if (material === "banner") {
    const layouts = ["split", "reverse", "centered"];
    const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];
    layoutEnforcement = `\n\nREGRA CRÍTICA DE DESIGN: Para o BANNER, você DEVE OBRIGATORIAMENTE definir o campo "layoutStyle" exato como "${randomLayout}". Abuse de "badgePrimary" e "badgeSecondary" se houver oferta.`;
  }

  // --- SORTEIO DE CORES PARA QUEBRAR O PADRÃO AZUL ---
  const PALETTES = [
    { t: "#7c3aed", s: "#2e1065" }, // Roxo
    { t: "#059669", s: "#022c22" }, // Verde
    { t: "#ea580c", s: "#431407" }, // Laranja
    { t: "#db2777", s: "#500724" }, // Rosa
    { t: "#111827", s: "#020617" }, // Preto/Dark
    { t: "#b91c1c", s: "#450a0a" }, // Vermelho
    { t: "#0d9488", s: "#083344" }, // Cyan
    { t: "#2563eb", s: "#0f172a" }, // Azul Clássico
  ];
  const randColor = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const colorEnforcement = `\n\nREGRA DE CORES: Se o usuário NÃO pediu cor, use esta paleta sorteada para variedade: Theme Color = "${randColor.t}" e Secondary = "${randColor.s}". Forneça strings Hexadecimais válidas.`;

  const system = `Você é o BrieFlow Art Director, um Mestre em Copywriting.\nSua tarefa: produzir a peça ${material.toUpperCase()} para ${channel.toUpperCase()}.\n\n${BRAND_VOICE}\n\n${COPY_QUALITY_RULES}\n\n${CHANNEL_PLAYBOOKS[channel]}\n\n${brandSection(brief)}\n\n${offerSection(brief)}\n\n${productSection(brief)}\n\n${OUTPUT_CONTRACT}\n\nSCHEMA JSON OBRIGATÓRIO (Siga os limites de palavras):\n${SCHEMA_HINTS[material]}${layoutEnforcement}${colorEnforcement}`;

  const briefing = options.channelBriefing?.trim() || brief.context?.trim() || brief.strategy?.trim() || "Sem briefing adicional: use os dados da marca.";
  const user = `=== BRIEFING ===\n${briefing}\n\nGere AGORA o JSON da peça. Respire fundo e aplique as melhores técnicas de conversão.`;

  return { system, user };
}

export function extractChannelBriefing(text: string, material: MaterialType): string {
  return text;
}