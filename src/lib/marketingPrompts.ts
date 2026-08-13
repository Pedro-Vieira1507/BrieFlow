// src/lib/marketingPrompts.ts
import { formatSiteContextForAgent } from "@/lib/scrape-site";
import { SCHEMA_HINTS } from "@/types/generatedContent";
import { hasProductContext, type MarketingBrief, type MarketingChannel, type MaterialType } from "@/types/brief";

export interface PromptPair { system: string; user: string; }

export const BRAND_VOICE = `TOM E VOZ (obrigatório em todas as peças):
- Português do Brasil, sempre.
- Profissional, premium e direto: frases curtas, zero enrolação.
- Foco em BENEFÍCIO e resultado para o cliente.
- Escreva para leitura rápida em celular: uma ideia por frase.`;

export const COPY_QUALITY_RULES = `PADRÃO DE QUALIDADE (checklist de conversão):
1. HEADLINE: benefício principal específico. Proibido ser genérico.
2. SUBHEADLINE: explica a proposta de valor.
3. CTA: verbo de ação, máximo 4 palavras.
4. BENEFÍCIOS: linguagem de resultado ("reduza X em Y").
5. ZERO ALUCINAÇÃO sobre preços ou prazos não fornecidos.`;

const OUTPUT_CONTRACT = `FORMATO DE SAÍDA:
- Responda EXCLUSIVAMENTE com um objeto JSON válido.
- Sem markdown ao redor, sem crases, apenas o JSON bruto.`;

export const CHANNEL_PLAYBOOKS: Record<MarketingChannel, string> = {
  landing: `CANAL - BANNER: Foco em CTA único, benefício claro e visual. Como Diretor de Arte, você define a composição visual e a densidade de conteúdo.
- LAYOUT (CRÍTICO): Você DEVE variar o campo "layoutStyle". Escolha entre: "split" (texto à esquerda), "reverse" (texto à direita), "centered" (texto centralizado).
- CONTEÚDO RICO: Não faça banners vazios. Use o campo "body" para adicionar parágrafos descritivos. Use "keyBenefits" para listas e "footerInfo" para cupons ou regras.
- FORMAS: Use o campo 'backgroundShape' para definir a geometria ('curve' ou 'diagonal').
- BADGES: Se houver oferta, preencha 'badgePrimary' (ex: 15% OFF) e 'badgeSecondary' (ex: FRETE GRÁTIS).`,
  linkedin: `CANAL - LINKEDIN: Tom consultivo, abertura forte com dados do mercado.`,
  instagram: `CANAL - INSTAGRAM: Hook forte para parar o scroll, texto fluido.`,
  facebook: `CANAL - FACEBOOK: Foco em prova social e benefício imediato.`,
  email: `CANAL - E-MAIL MARKETING (PREMIUM E DINÂMICO):
- O e-mail deve ter uma arquitetura visual sofisticada. Você vai decidir quais blocos usar preenchendo as chaves JSON.
- LAYOUT (CRÍTICO): Você DEVE variar o campo "layoutStyle". Escolha ativamente entre: "minimalist" (limpo, texto alinhado à esquerda), "split" (imagem grande no topo, texto embaixo), "diagonal" (blocos visuais sobrepostos) ou "centered" (clássico cartão arredondado). NUNCA use o mesmo layout repetidamente! Adapte ao humor da campanha.
- ASSUNTO e PREHEADER: Curtos, quebrando a objeção ou entregando o benefício.
- HEADLINE e SUBTITLE: O título e a introdução da carta de vendas.
- BODY: 1 ou 2 parágrafos curtos criando conexão.
- TESTIMONIALS: Essencial para prova social! Se for pertinente, crie 2 a 4 cards de prova social preenchendo a lista 'testimonials'. O formato OBRIGATÓRIO de cada string da lista é: "Nome da Pessoa - Resultado/Prêmio | 'Frase do depoimento em aspas'".
- KEY BENEFITS: Se aplicável, liste 3 a 4 benefícios rápidos.
- HERO BADGE: Um selo superior curto (ex: "OFERTA", "NOVIDADE", "INDICAÇÃO").
- CTA TEXT: Botão focado em conversão.
- FOOTER INFO: Avisos legais, regras de oferta ou validade. NUNCA escreva "Frete grátis" a menos que seja um e-commerce físico e isso faça sentido.`,
  whatsapp: `CANAL - WHATSAPP: Curto, pessoal, com uma única chamada para a ação.`,
  generic: `CANAL - MULTICANAL: Copy adaptável.`
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
  return brief.offer ? `=== OFERTA ===\nOFERTA OBRIGATÓRIA: [${brief.offer}]. Inclua no texto e nos badges se apropriado.` : `=== OFERTA ===\nNÃO HÁ OFERTA/CUPOM. Não invente descontos.`;
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

export interface MaterialPromptOptions { channel?: MarketingChannel; channelBriefing?: string; }

export function buildMaterialPrompt(brief: MarketingBrief, material: MaterialType, options: MaterialPromptOptions = {}): PromptPair {
  const channel = options.channel ?? MATERIAL_CHANNEL[material];
  
  let layoutEnforcement = "";
  if (material === "email") {
    const layouts = ["centered", "minimalist", "split", "diagonal"];
    const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];
    layoutEnforcement = `\n\nREGRA CRÍTICA DE DESIGN: Para esta geração específica, você DEVE OBRIGATORIAMENTE definir o campo "layoutStyle" exato como "${randomLayout}". Isso é essencial para gerar layouts dinâmicos e únicos. Nunca omita este campo.`;
  } else if (material === "banner") {
    const layouts = ["split", "reverse", "centered"];
    const randomLayout = layouts[Math.floor(Math.random() * layouts.length)];
    layoutEnforcement = `\n\nREGRA CRÍTICA DE DESIGN: Para o BANNER, você DEVE OBRIGATORIAMENTE definir o campo "layoutStyle" exato como "${randomLayout}". Utilize "body", "keyBenefits" e "footerInfo" para deixar o banner rico de conteúdo, com mais textos explicativos (evite banners vazios). Abuse de "badgePrimary" e "badgeSecondary" se houver oferta.`;
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
  
  const colorEnforcement = `\n\nREGRA CRÍTICA DE CORES: 
1. Se o usuário pediu uma cor específica no briefing (ex: "roxo", "vermelho e branco"), você DEVE OBRIGATORIAMENTE usar essa cor. Converta a cor para HEX (ex: #8B5CF6) e preencha "themeColor" e "secondaryColor".
2. Se o usuário NÃO pediu nenhuma cor específica, PARE DE USAR AZUL O TEMPO TODO! Utilize esta paleta sorteada aleatoriamente para dar variedade: Theme Color = "${randColor.t}" e Secondary Color = "${randColor.s}".
Atenção: Os campos "themeColor" e "secondaryColor" DEVEM sempre ser strings Hexadecimais válidas (iniciando com #).`;

  const system = `Você é o BrieFlow Art Director.\nSua tarefa: produzir a peça ${material.toUpperCase()} para ${channel.toUpperCase()}.\n\n${BRAND_VOICE}\n\n${COPY_QUALITY_RULES}\n\n${CHANNEL_PLAYBOOKS[channel]}\n\n${brandSection(brief)}\n\n${offerSection(brief)}\n\n${productSection(brief)}\n\n${OUTPUT_CONTRACT}\n\nSCHEMA JSON OBRIGATÓRIO:\n${SCHEMA_HINTS[material]}${layoutEnforcement}${colorEnforcement}`;
  
  const briefing = options.channelBriefing?.trim() || brief.context?.trim() || brief.strategy?.trim() || "Sem briefing adicional: use os dados da marca.";
  const user = `=== BRIEFING ===\n${briefing}\n\nGere AGORA o JSON da peça.`;
  
  return { system, user };
}

export function extractChannelBriefing(text: string, material: MaterialType): string {
  return text;
}