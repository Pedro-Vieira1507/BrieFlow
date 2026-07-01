/**
 * SEOGuidelinesEngine
 *
 * Regras de SEO e otimização por plataforma.
 * Injetado no prompt junto com o DesignSystemEngine para garantir
 * que todo conteúdo seja otimizado para descoberta e alcance orgânico.
 */

import type { ContentFormat } from './design-system-prompt';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SEOScore {
  score: number; // 0-100
  passed: string[];
  warnings: string[];
  suggestions: string[];
}

export interface PlatformSEORules {
  platform: string;
  character_limits: Record<string, number>;
  algorithm_factors: string[];
  keyword_strategy: string[];
  best_practices: string[];
  common_mistakes: string[];
}

// ─── Regras SEO por plataforma ───────────────────────────────────────────────

export const SEO_RULES_BY_FORMAT: Record<ContentFormat, PlatformSEORules> = {
  banner: {
    platform: 'Display Ads / Meta Ads / Google Display',
    character_limits: {
      headline: 40,
      description: 90,
      cta_button: 20,
    },
    algorithm_factors: [
      'Relevance Score (Meta): alinhamento entre criativo, copy e público-alvo',
      'Quality Ranking: CTR esperado vs CTR real do setor',
      'Ad Relevance: match entre o anúncio e a intenção do público',
    ],
    keyword_strategy: [
      'Use a keyword principal da campanha no headline do banner',
      'Inclua a proposta de valor única (UVP) de forma explícita',
      'Adicione prova social numérica quando possível ("+10.000 clientes")',
    ],
    best_practices: [
      'Teste A/B: 3-5 variações de headline por campanha',
      'Imagem com rosto humano aumenta CTR em média 38%',
      'Contraste de cores: CTA deve ter mínimo 4.5:1 de contraste',
      'Logo visível mas não dominante (máximo 15% da área)',
      'Mobile-first: verifique leitura em telas de 375px',
    ],
    common_mistakes: [
      'Texto ocupando mais de 20% da área do banner',
      'CTA genérico ("Clique aqui", "Saiba mais") sem benefício',
      'Falta de urgência ou escassez para conversão imediata',
      'Cores da marca que conflitam com a plataforma (ex: azul similar ao Facebook)',
    ],
  },

  instagram_post: {
    platform: 'Instagram Feed / Explore',
    character_limits: {
      caption: 2200,
      caption_before_more: 125,
      hashtags_recommended: 10,
      alt_text: 100,
    },
    algorithm_factors: [
      'Saves e Shares: sinalizam conteúdo de alto valor (peso maior que likes)',
      'Tempo de permanência no post (dwell time)',
      'Engajamento nas primeiras 1-2 horas após publicação',
      'Consistência de posting (frequência regular)',
      'Uso de todas as features do Instagram (Collab, Alt Text, Localização)',
    ],
    keyword_strategy: [
      'Keyword principal nas primeiras 125 chars da legenda (índice do Explore)',
      'Alt text da imagem com 2-3 keywords naturais',
      'Nome do arquivo da imagem: keyword-principal.jpg (antes do upload)',
      'Hashtags: mix de nicho (50k-500k), médias (500k-2M) e amplas (2M+)',
    ],
    best_practices: [
      'Poste nas janelas de maior engajamento do seu nicho (use Instagram Insights)',
      'Responda comentários nas primeiras 2h para impulsionar o algoritmo',
      'Use CTA de engajamento na legenda: "Salve para usar depois 📌"',
      'Carrosséis têm 3x mais alcance que posts estáticos',
      'Adicione localização geográfica relevante',
    ],
    common_mistakes: [
      'Hashtags em comentário (melhore indexação colocando na legenda)',
      'Legenda sem CTA claro',
      'Postar e desaparecer (não engajar com comentários)',
      'Hashtags irrelevantes ou banidas pelo Instagram',
    ],
  },

  instagram_carousel: {
    platform: 'Instagram Carousel',
    character_limits: {
      caption: 2200,
      caption_before_more: 125,
      slides_max: 10,
      text_per_slide: 50,
    },
    algorithm_factors: [
      'Tempo de visualização total do carrossel (peso alto no algoritmo)',
      'Porcentagem de usuários que chegam ao último slide',
      'Saves: carrosséis educativos têm taxa de save 5-10x maior',
      'Compartilhamentos via Direct Messages',
    ],
    keyword_strategy: [
      'Slide 1: keyword principal visível sem necessidade de texto na legenda',
      'Cada slide deve ter 1 conceito-chave claro (para indexação via OCR do Instagram)',
      'Legenda: explica o tema do carrossel com keyword no início',
    ],
    best_practices: [
      'Slide 1 deve gerar FOMO ou curiosidade irresistível',
      'Use elemento visual cortado na borda direita do slide para incentivar swipe',
      'Último slide: sempre com CTA + convite para salvar',
      'Consistência visual entre slides (mesma paleta, tipografia)',
      'Carrosséis de 7-10 slides performam melhor que 3-4 slides',
    ],
    common_mistakes: [
      'Slide 1 sem proposta clara de valor',
      'Muita informação por slide (break down em mais slides)',
      'Descontinuidade visual entre slides',
      'Sem CTA no último slide',
    ],
  },

  linkedin_post: {
    platform: 'LinkedIn Feed',
    character_limits: {
      post_text: 3000,
      characters_before_see_more: 200,
      article_title: 100,
      hashtags_recommended: 5,
    },
    algorithm_factors: [
      'Dwell time: LinkedIn mede quanto tempo você passa lendo',
      'Comentários > Reposts > Reações (hierarquia do algoritmo)',
      'Primeiras 2h após publicação são críticas para o alcance',
      'Conteúdo de criadores com alto Employee Advocacy se espalha mais',
      'Posts com links externos recebem MENOS alcance (evite ou coloque no comentário)',
    ],
    keyword_strategy: [
      'Inclua a keyword do setor nas primeiras 2 linhas (aparece em buscas do LinkedIn)',
      'Use termos técnicos do setor estrategicamente (sinalizam autoridade)',
      'Nome de cargos e habilidades mencionados aumentam busca por perfil',
    ],
    best_practices: [
      'Primeira linha deve funcionar como headline de jornal (cria urgência de ler)',
      'Linha em branco após a primeira linha (pausa visual = gancho)',
      'Parágrafos de 1-3 linhas máximo (escaneabilidade mobile)',
      'Feche com uma pergunta para gerar comentários',
      'Links: cole no primeiro comentário, não no post',
      'Tag pessoas relevantes com moderação (máximo 3)',
    ],
    common_mistakes: [
      'Parágrafos longos sem espaçamento (ninguém lê em mobile)',
      'Conteúdo puramente promocional sem valor educativo',
      'Link no post (penaliza alcance)',
      'Muitas hashtags (parecem spam; use 3-5)',
    ],
  },

  landing_page: {
    platform: 'Google Search / Meta Ads / SEO Orgânico',
    character_limits: {
      title_tag: 60,
      meta_description: 155,
      h1: 70,
      url_slug: 60,
    },
    algorithm_factors: [
      'Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1',
      'Bounce rate e tempo na página (indicadores de qualidade para Google)',
      'Keyword intent match: a página entrega o que a keyword promete?',
      'E-E-A-T: Experience, Expertise, Authoritativeness, Trustworthiness',
      'Mobile-first indexing: Google usa versão mobile para ranking',
    ],
    keyword_strategy: [
      'Keyword principal: no H1, no primeiro parágrafo, na meta description e no title tag',
      'Keyword secundárias: nos H2s e naturalmente no body copy',
      'LSI keywords (semanticamente relacionadas): distribuídas pelo texto',
      'Long-tail keywords: capturar intenção específica no hero e no FAQ',
      'Schema Markup: FAQPage, Product, Review (aumenta CTR no SERP)',
    ],
    best_practices: [
      'Above-the-fold deve conter: H1 + proposta de valor + CTA + prova social',
      'Velocidade: comprima imagens, minifique CSS/JS, use CDN',
      'Social proof: números específicos ("3.847 clientes") > vagos ("milhares")',
      'Trust signals: selos, certificações, logos de clientes, depoimentos com foto',
      'CTA acima da dobra E abaixo de cada seção de benefício',
    ],
    common_mistakes: [
      'H1 genérico sem keyword principal',
      'Imagens sem alt text (perda de SEO de imagem)',
      'Múltiplos CTAs competindo entre si',
      'Falta de velocidade (imagens pesadas = bounce rate alto)',
      'Conteúdo duplicado do site principal',
    ],
  },

  email_marketing: {
    platform: 'Email (Gmail, Outlook, Apple Mail)',
    character_limits: {
      subject_line: 50,
      preheader: 100,
      cta_button: 25,
      width_pixels: 600,
    },
    algorithm_factors: [
      'Taxa de abertura (Open Rate): impactada pelo subject line e remetente',
      'Taxa de clique (CTR): impactada pelo conteúdo e CTAs',
      'Taxa de entrega: afetada pela reputação de domínio e ratio texto/imagem',
      'Spam score: palavras gatilho, excesso de maiúsculas, ratio imagem/texto',
      'Engajamento histórico: ISPs priorizam e-mails de remetentes com quem o usuário interage',
    ],
    keyword_strategy: [
      'Subject line: personalize com nome OU inclua keyword de benefício claro',
      'Preheader: completa o subject, nunca o repete',
      'Headline do body: repete ou reforça a promessa do subject line',
      'Evite palavras de spam: "grátis", "promoção", "CLIQUE AQUI", "$$$", "urgente"',
    ],
    best_practices: [
      'Segmente: e-mails segmentados têm 14% mais abertura e 101% mais cliques',
      'Teste A/B subject lines: mude UMA variável por vez',
      'Mobile-first: 60%+ dos e-mails são abertos no mobile',
      'Texto de preview visível em todos os clientes de e-mail',
      'SPF, DKIM e DMARC configurados para melhor entregabilidade',
    ],
    common_mistakes: [
      'Subject line vaga ou enganosa (aumenta descadastros)',
      'Muitas imagens, pouco texto (cai em spam ou Promoções do Gmail)',
      'Links sem UTM parameters (impossível rastrear conversões)',
      'CTA enterrado no final sem aparecer above-the-fold',
      'Falta de versão em texto puro (plaintext)',
    ],
  },

  generic: {
    platform: 'Multi-plataforma',
    character_limits: {},
    algorithm_factors: [
      'Relevância para o público-alvo',
      'Qualidade e especificidade do conteúdo',
      'Clareza da proposta de valor',
    ],
    keyword_strategy: [
      'Identifique a keyword principal da campanha',
      'Inclua a keyword no título/headline',
      'Use variações semânticas no corpo do texto',
    ],
    best_practices: [
      'Conteúdo focado em UN objetivo específico',
      'CTA claro e mensurável',
      'Adaptado ao formato e plataforma de destino',
    ],
    common_mistakes: [
      'Conteúdo genérico sem personalização para o público',
      'Múltiplos CTAs competindo',
      'Falta de prova social ou credibilidade',
    ],
  },
};

// ─── Gerador de prompt SEO ────────────────────────────────────────────────────

/**
 * Retorna o bloco de texto com as regras SEO da plataforma,
 * pronto para ser injetado no system prompt do Ollama.
 */
export function buildSEOPromptBlock(format: ContentFormat): string {
  const rules = SEO_RULES_BY_FORMAT[format];

  const limitsText = Object.entries(rules.character_limits)
    .map(([key, val]) => `  - ${key}: máximo ${val} caracteres`)
    .join('\n');

  return `
## DIRETRIZES SEO — ${rules.platform.toUpperCase()}

### Limites de Caracteres
${limitsText || '  - Siga as melhores práticas da plataforma'}

### Fatores de Algoritmo que Você DEVE Considerar
${rules.algorithm_factors.map((f) => `- ${f}`).join('\n')}

### Estratégia de Keywords
${rules.keyword_strategy.map((k) => `- ${k}`).join('\n')}

### Melhores Práticas
${rules.best_practices.map((p) => `- ${p}`).join('\n')}

### Erros Comuns a EVITAR
${rules.common_mistakes.map((m) => `- ❌ ${m}`).join('\n')}
`;
}

// ─── Validador de SEO básico ─────────────────────────────────────────────────

/**
 * Valida um conteúdo gerado contra as regras SEO do formato.
 * Retorna um score e lista de avisos.
 */
export function validateSEO(
  format: ContentFormat,
  content: Record<string, unknown>
): SEOScore {
  const rules = SEO_RULES_BY_FORMAT[format];
  const passed: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Valida limites de caracteres
  for (const [field, maxLength] of Object.entries(rules.character_limits)) {
    const value = content[field];
    if (typeof value === 'string') {
      if (value.length <= maxLength) {
        passed.push(`${field}: ${value.length}/${maxLength} chars ✓`);
      } else {
        warnings.push(`${field} tem ${value.length} chars (máximo: ${maxLength})`);
      }
    }
  }

  // Adiciona sugestões com base nas melhores práticas
  suggestions.push(...rules.best_practices.slice(0, 3));

  const totalChecks = passed.length + warnings.length;
  const score = totalChecks > 0 ? Math.round((passed.length / totalChecks) * 100) : 75;

  return { score, passed, warnings, suggestions };
}
