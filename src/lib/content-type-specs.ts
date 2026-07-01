/**
 * ContentTypeSpecs
 *
 * Especificações técnicas completas por tipo de conteúdo.
 * Define dimensões, estrutura de dados, campos editáveis e
 * as "zonas" do preview que o usuário pode editar no Page Builder.
 */

import type { ContentFormat } from './design-system-prompt';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface ContentFieldSpec {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'image' | 'select' | 'url';
  placeholder: string;
  maxLength?: number;
  required: boolean;
  editableInPreview: boolean;
  helpText?: string;
}

export interface ContentDimensions {
  width: number;
  height: number;
  aspectRatio: string;
  label: string;
}

export interface ContentTypeSpec {
  format: ContentFormat;
  displayName: string;
  description: string;
  icon: string;
  dimensions: ContentDimensions[];
  defaultDimension: ContentDimensions;
  fields: ContentFieldSpec[];
  previewComponent: string;
  exportFormats: ('PNG' | 'JPG' | 'SVG' | 'HTML' | 'PDF' | 'TXT')[];
  jsonSchema: Record<string, unknown>;
  qualityBenchmarks: Record<string, string>;
}

// ─── Especificações por tipo ──────────────────────────────────────────────────

export const CONTENT_TYPE_SPECS: Record<ContentFormat, ContentTypeSpec> = {
  banner: {
    format: 'banner',
    displayName: 'Banner Publicitário',
    description: 'Banners para redes sociais, Google Display e portais',
    icon: '🖼️',
    dimensions: [
      { width: 1200, height: 628, aspectRatio: '1.91:1', label: 'Facebook / LinkedIn Feed' },
      { width: 1080, height: 1080, aspectRatio: '1:1', label: 'Quadrado Universal' },
      { width: 1920, height: 1080, aspectRatio: '16:9', label: 'Full HD / YouTube' },
      { width: 300, height: 250, aspectRatio: '6:5', label: 'Google Display (Rectangle)' },
      { width: 728, height: 90, aspectRatio: '8:1', label: 'Leaderboard' },
    ],
    defaultDimension: { width: 1200, height: 628, aspectRatio: '1.91:1', label: 'Facebook / LinkedIn Feed' },
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', placeholder: 'Ex: Transforme seu negócio hoje', maxLength: 60, required: true, editableInPreview: true, helpText: 'Máximo 8 palavras de impacto' },
      { key: 'subheadline', label: 'Subheadline', type: 'text', placeholder: 'Ex: Solução completa para empresas', maxLength: 100, required: false, editableInPreview: true },
      { key: 'cta_text', label: 'Texto do CTA', type: 'text', placeholder: 'Ex: Comece grátis', maxLength: 25, required: true, editableInPreview: true },
      { key: 'background_style', label: 'Estilo do fundo', type: 'select', placeholder: 'gradient | solid | image | pattern', required: true, editableInPreview: false },
      { key: 'color_palette', label: 'Paleta de cores', type: 'color', placeholder: '#1A1A2E, #E94560, #FFFFFF', required: false, editableInPreview: true },
      { key: 'image_description', label: 'Descrição da imagem', type: 'textarea', placeholder: 'Pessoa sorrindo usando notebook em escritório moderno', required: false, editableInPreview: false, helpText: 'Descreva a imagem que será gerada por IA' },
      { key: 'brand_logo_url', label: 'URL do logo', type: 'url', placeholder: 'https://', required: false, editableInPreview: true },
    ],
    previewComponent: 'BannerPreview',
    exportFormats: ['PNG', 'JPG', 'SVG'],
    jsonSchema: {
      headline: 'string (max 60 chars)',
      subheadline: 'string (max 100 chars) | null',
      cta_text: 'string (max 25 chars)',
      background_style: '"gradient" | "solid" | "image" | "pattern"',
      color_palette: 'string[] (hex codes)',
      layout_type: '"centered" | "left-aligned" | "right-image" | "split"',
      image_description: 'string | null',
    },
    qualityBenchmarks: {
      headline_words: 'Máximo 8 palavras',
      text_coverage: 'Máximo 20% da área total',
      contrast_ratio: 'Mínimo 4.5:1 para texto sobre fundo',
      cta_visibility: 'CTA deve ser o elemento mais chamativo após headline',
    },
  },

  instagram_post: {
    format: 'instagram_post',
    displayName: 'Post Instagram',
    description: 'Posts para o feed do Instagram (quadrado ou retrato)',
    icon: '📸',
    dimensions: [
      { width: 1080, height: 1080, aspectRatio: '1:1', label: 'Quadrado (Feed padrão)' },
      { width: 1080, height: 1350, aspectRatio: '4:5', label: 'Retrato (maior alcance)' },
    ],
    defaultDimension: { width: 1080, height: 1080, aspectRatio: '1:1', label: 'Quadrado (Feed padrão)' },
    fields: [
      { key: 'card_headline', label: 'Texto no card', type: 'text', placeholder: 'Ex: 5 erros que estão te custando clientes', maxLength: 70, required: true, editableInPreview: true, helpText: 'Máximo 7 palavras visíveis no card' },
      { key: 'card_subtext', label: 'Subtexto no card', type: 'text', placeholder: 'Ex: Deslize para descobrir →', maxLength: 50, required: false, editableInPreview: true },
      { key: 'caption_hook', label: 'Hook da legenda', type: 'textarea', placeholder: 'A primeira linha que aparece antes do "ver mais"', maxLength: 125, required: true, editableInPreview: false, helpText: 'Crítico para o algoritmo — deve parar o scroll' },
      { key: 'caption_body', label: 'Corpo da legenda', type: 'textarea', placeholder: 'Desenvolvimento do conteúdo...', maxLength: 2000, required: false, editableInPreview: false },
      { key: 'cta_caption', label: 'CTA na legenda', type: 'text', placeholder: 'Ex: Salve esse post para não esquecer 📌', maxLength: 100, required: true, editableInPreview: false },
      { key: 'hashtags', label: 'Hashtags', type: 'textarea', placeholder: '#marketing #negócios #empreendedorismo', required: true, editableInPreview: false, helpText: '5-10 hashtags relevantes' },
      { key: 'visual_mood', label: 'Mood visual', type: 'select', placeholder: 'professional | warm | bold | minimal | colorful', required: false, editableInPreview: false },
    ],
    previewComponent: 'InstagramPostPreview',
    exportFormats: ['PNG', 'JPG'],
    jsonSchema: {
      card_headline: 'string (max 70 chars)',
      card_subtext: 'string (max 50 chars) | null',
      caption_hook: 'string (max 125 chars)',
      caption_body: 'string (max 2000 chars)',
      cta_caption: 'string (max 100 chars)',
      hashtags: 'string[] (5-10 items)',
      visual_mood: 'string',
      color_scheme: 'string[]',
    },
    qualityBenchmarks: {
      caption_hook_length: '90-125 caracteres ideais',
      hashtag_count: '5-10 hashtags (mix de nicho e amplo)',
      cta_type: 'Inclua convite para salvar, comentar ou compartilhar',
      visual_hook: 'Elemento visual deve parar o scroll em 2 segundos',
    },
  },

  instagram_carousel: {
    format: 'instagram_carousel',
    displayName: 'Carrossel Instagram',
    description: 'Carrossel de múltiplos slides para o Instagram',
    icon: '🎠',
    dimensions: [
      { width: 1080, height: 1080, aspectRatio: '1:1', label: 'Quadrado' },
      { width: 1080, height: 1350, aspectRatio: '4:5', label: 'Retrato' },
    ],
    defaultDimension: { width: 1080, height: 1080, aspectRatio: '1:1', label: 'Quadrado' },
    fields: [
      { key: 'slides', label: 'Slides', type: 'textarea', placeholder: 'JSON com array de slides', required: true, editableInPreview: true, helpText: '5-10 slides para melhor performance' },
      { key: 'caption', label: 'Legenda', type: 'textarea', placeholder: 'Legenda do carrossel...', maxLength: 2200, required: true, editableInPreview: false },
      { key: 'hashtags', label: 'Hashtags', type: 'textarea', placeholder: '#marketing #negócios', required: true, editableInPreview: false },
    ],
    previewComponent: 'InstagramCarouselPreview',
    exportFormats: ['PNG', 'JPG', 'PDF'],
    jsonSchema: {
      slides: '{ slide_number: number, headline: string, body: string, visual_element: string }[]',
      total_slides: 'number (5-10)',
      caption: 'string',
      hashtags: 'string[]',
    },
    qualityBenchmarks: {
      slide_count: '7 slides = ponto ideal de engajamento',
      slide_1: 'DEVE conter pergunta ou promessa de valor irresistível',
      slide_last: 'DEVE conter CTA + convite para salvar',
      visual_continuity: 'Elemento visual cortado na borda direita incentiva swipe',
    },
  },

  linkedin_post: {
    format: 'linkedin_post',
    displayName: 'Post LinkedIn',
    description: 'Posts para o feed profissional do LinkedIn',
    icon: '💼',
    dimensions: [
      { width: 1200, height: 627, aspectRatio: '1.91:1', label: 'Imagem de apoio LinkedIn' },
      { width: 1080, height: 1080, aspectRatio: '1:1', label: 'Quadrado (melhor mobile)' },
    ],
    defaultDimension: { width: 1200, height: 627, aspectRatio: '1.91:1', label: 'Imagem de apoio LinkedIn' },
    fields: [
      { key: 'hook_line', label: 'Primeira linha (gancho)', type: 'text', placeholder: 'Ex: Cometi um erro que me custou R$ 50.000.', maxLength: 200, required: true, editableInPreview: false, helpText: 'Crítico — aparece antes do "ver mais"' },
      { key: 'body_paragraphs', label: 'Parágrafos do corpo', type: 'textarea', placeholder: 'Desenvolvimento em parágrafos curtos...', maxLength: 2800, required: true, editableInPreview: false },
      { key: 'cta_line', label: 'CTA final', type: 'text', placeholder: 'Ex: Você já passou por isso? Conta nos comentários.', maxLength: 200, required: true, editableInPreview: false },
      { key: 'hashtags', label: 'Hashtags (máx 5)', type: 'text', placeholder: '#marketing #liderança #vendas', maxLength: 100, required: false, editableInPreview: false },
      { key: 'image_description', label: 'Descrição da imagem de apoio', type: 'textarea', placeholder: 'Gráfico mostrando crescimento de receita...', required: false, editableInPreview: false },
    ],
    previewComponent: 'LinkedInPostPreview',
    exportFormats: ['TXT', 'PNG'],
    jsonSchema: {
      hook_line: 'string (max 200 chars)',
      body_paragraphs: 'string[] (array of short paragraphs)',
      cta_line: 'string (max 200 chars)',
      hashtags: 'string[] (max 5)',
      image_description: 'string | null',
    },
    qualityBenchmarks: {
      hook_line: 'Deve criar curiosidade ou identificação em 1 linha',
      body_format: 'Parágrafos de 1-3 linhas com espaço entre eles',
      cta_type: 'Pergunta aberta para gerar comentários',
      link_placement: 'Links devem ir no PRIMEIRO COMENTÁRIO, não no post',
    },
  },

  landing_page: {
    format: 'landing_page',
    displayName: 'Landing Page',
    description: 'Página de conversão com foco em um único objetivo',
    icon: '🏠',
    dimensions: [
      { width: 1440, height: 900, aspectRatio: '16:10', label: 'Desktop (viewport)' },
      { width: 390, height: 844, aspectRatio: '9:19.5', label: 'Mobile (iPhone 14)' },
    ],
    defaultDimension: { width: 1440, height: 900, aspectRatio: '16:10', label: 'Desktop (viewport)' },
    fields: [
      { key: 'meta_title', label: 'Meta Title', type: 'text', placeholder: 'Keyword principal | Marca', maxLength: 60, required: true, editableInPreview: false, helpText: 'Aparece na aba do navegador e no Google' },
      { key: 'meta_description', label: 'Meta Description', type: 'textarea', placeholder: 'Descrição com keyword + CTA + benefício', maxLength: 155, required: true, editableInPreview: false },
      { key: 'hero_headline', label: 'Headline do Hero', type: 'text', placeholder: 'Proposta de valor única em 1 frase', maxLength: 80, required: true, editableInPreview: true },
      { key: 'hero_subheadline', label: 'Subheadline do Hero', type: 'textarea', placeholder: 'Como você entrega a promessa da headline', maxLength: 180, required: true, editableInPreview: true },
      { key: 'cta_primary', label: 'CTA Primário', type: 'text', placeholder: 'Ex: Começar meu teste grátis', maxLength: 40, required: true, editableInPreview: true },
      { key: 'social_proof_hero', label: 'Prova social no Hero', type: 'text', placeholder: 'Ex: +3.847 empresas já transformaram seus resultados', maxLength: 80, required: false, editableInPreview: true },
      { key: 'sections', label: 'Seções da página', type: 'textarea', placeholder: 'JSON com array de seções', required: true, editableInPreview: true },
    ],
    previewComponent: 'LandingPagePreview',
    exportFormats: ['HTML', 'PDF'],
    jsonSchema: {
      meta: '{ title: string, description: string, keywords: string[] }',
      hero: '{ headline: string, subheadline: string, cta_primary: string, cta_secondary?: string, social_proof?: string }',
      sections: '{ type: "benefits" | "how-it-works" | "social-proof" | "pricing" | "faq" | "cta", headline: string, content: any }[]',
    },
    qualityBenchmarks: {
      single_objective: 'UMA conversão por landing page — sem links externos',
      above_fold: 'H1 + subheadline + CTA visíveis sem scroll',
      social_proof: 'Números específicos ("3.847") > vagos ("milhares")',
      load_speed: 'LCP < 2.5s, CLS < 0.1',
    },
  },

  email_marketing: {
    format: 'email_marketing',
    displayName: 'E-mail Marketing',
    description: 'E-mails de campanha com alta taxa de abertura e cliques',
    icon: '✉️',
    dimensions: [
      { width: 600, height: 800, aspectRatio: '3:4', label: 'Template e-mail (600px)' },
      { width: 390, height: 844, aspectRatio: '9:19.5', label: 'Mobile preview' },
    ],
    defaultDimension: { width: 600, height: 800, aspectRatio: '3:4', label: 'Template e-mail (600px)' },
    fields: [
      { key: 'subject_line', label: 'Subject Line', type: 'text', placeholder: 'Ex: Pedro, seu relatório de julho está pronto', maxLength: 50, required: true, editableInPreview: false, helpText: 'Determina 47% das taxas de abertura' },
      { key: 'preheader_text', label: 'Preheader Text', type: 'text', placeholder: 'Complementa o subject sem repeti-lo', maxLength: 100, required: true, editableInPreview: false },
      { key: 'header_headline', label: 'Headline do e-mail', type: 'text', placeholder: 'Ex: Sua campanha cresceu 40% esse mês 🎉', maxLength: 80, required: true, editableInPreview: true },
      { key: 'header_subheadline', label: 'Subheadline', type: 'text', placeholder: 'Veja o que funcionou e o que pode melhorar', maxLength: 120, required: false, editableInPreview: true },
      { key: 'body_sections', label: 'Seções do corpo', type: 'textarea', placeholder: 'JSON com seções do e-mail', required: true, editableInPreview: true },
      { key: 'cta_text', label: 'Texto do CTA', type: 'text', placeholder: 'Ex: Ver meu relatório completo', maxLength: 40, required: true, editableInPreview: true },
      { key: 'cta_url', label: 'URL do CTA', type: 'url', placeholder: 'https://...', required: false, editableInPreview: false },
    ],
    previewComponent: 'EmailMarketingPreview',
    exportFormats: ['HTML', 'TXT'],
    jsonSchema: {
      subject_line: 'string (max 50 chars)',
      preheader_text: 'string (max 100 chars)',
      header: '{ headline: string, subheadline?: string }',
      body_sections: '{ type: "text" | "image" | "cta" | "divider" | "list", content: any }[]',
      cta: '{ text: string, url_placeholder: string }',
      footer: '{ unsubscribe_text: string, company_info: string }',
    },
    qualityBenchmarks: {
      subject_line: '40-50 chars ideais — personalização aumenta abertura em 26%',
      text_image_ratio: 'Mínimo 60% texto para evitar filtros de spam',
      mobile_preview: 'Testar em largura 375px antes de enviar',
      cta_position: 'CTA visível sem scroll E no final do e-mail',
    },
  },

  generic: {
    format: 'generic',
    displayName: 'Conteúdo Genérico',
    description: 'Conteúdo de marketing não categorizado',
    icon: '📝',
    dimensions: [
      { width: 1200, height: 630, aspectRatio: '1.91:1', label: 'Padrão Open Graph' },
    ],
    defaultDimension: { width: 1200, height: 630, aspectRatio: '1.91:1', label: 'Padrão Open Graph' },
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', placeholder: 'Título principal', maxLength: 80, required: true, editableInPreview: true },
      { key: 'body', label: 'Conteúdo', type: 'textarea', placeholder: 'Conteúdo principal...', required: true, editableInPreview: true },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Call-to-action', maxLength: 40, required: false, editableInPreview: true },
    ],
    previewComponent: 'GenericContentPreview',
    exportFormats: ['PNG', 'TXT', 'HTML'],
    jsonSchema: {
      headline: 'string',
      body: 'string',
      cta: 'string | null',
    },
    qualityBenchmarks: {
      clarity: 'Mensagem compreensível em 5 segundos',
      cta: 'CTA presente e específico',
    },
  },
};

// ─── Utilitários ─────────────────────────────────────────────────────────────

/**
 * Retorna a spec de um tipo de conteúdo.
 */
export function getContentTypeSpec(format: ContentFormat): ContentTypeSpec {
  return CONTENT_TYPE_SPECS[format] ?? CONTENT_TYPE_SPECS['generic'];
}

/**
 * Retorna todos os formatos disponíveis com seus metadados básicos.
 */
export function listAvailableFormats(): Pick<ContentTypeSpec, 'format' | 'displayName' | 'description' | 'icon'>[] {
  return Object.values(CONTENT_TYPE_SPECS).map(({ format, displayName, description, icon }) => ({
    format,
    displayName,
    description,
    icon,
  }));
}

/**
 * Retorna o schema JSON esperado como string formatada,
 * para injetar no prompt do Ollama como instrução de output.
 */
export function getExpectedJSONSchema(format: ContentFormat): string {
  const spec = getContentTypeSpec(format);
  return JSON.stringify(spec.jsonSchema, null, 2);
}

/**
 * Valida se um objeto gerado pelo Ollama contém todos os campos
 * obrigatórios do tipo de conteúdo.
 */
export function validateContentStructure(
  format: ContentFormat,
  content: Record<string, unknown>
): { valid: boolean; missingFields: string[]; } {
  const spec = getContentTypeSpec(format);
  const requiredFields = spec.fields.filter((f) => f.required).map((f) => f.key);
  const missingFields = requiredFields.filter((field) => !(field in content) || !content[field]);

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
