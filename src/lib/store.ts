// Mock store for campaigns — pure client state for MVP. Easy to swap with real API.
import { useSyncExternalStore } from "react";

export type CampaignStatus =
  | "recebido"
  | "transcrito"
  | "brief_gerado"
  | "materiais_gerados"
  | "erro";

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  recebido: "Recebido",
  transcrito: "Transcrito",
  brief_gerado: "Brief gerado",
  materiais_gerados: "Materiais gerados",
  erro: "Erro",
};

export type SourceFile = {
  name: string;
  type: "video" | "audio" | "texto" | "json" | "drive";
  sizeKb?: number;
};

export type StructuredBrief = {
  marca: string;
  campanha: string;
  publico_alvo: string;
  proposta_comercial: string;
  oferta_promocional: string;
  subcategorias: string[];
  diferenciais_tecnicos: string[];
  beneficios_revendedor: string[];
  beneficios_cliente_final: string[];
  objecoes_argumentos: { objecao: string; argumento: string }[];
  tom_comunicacao: string;
  observacoes: string;
  inferencias_ia?: string[];
};

export type MaterialKey =
  | "podcast_revendedores"
  | "apresentacao_slides"
  | "folheto_a4"
  | "ficha_tecnica"
  | "emails_revendedores"
  | "emails_cliente_final"
  | "posts_linkedin"
  | "posts_facebook"
  | "posts_instagram"
  | "roteiro_video_curto";

export const MATERIAL_META: Record<MaterialKey, { label: string; descricao: string; icone: string; ext: "txt" | "docx" | "pdf" | "pptx" }> = {
  podcast_revendedores: { label: "Podcast 5 min — Revendedores", descricao: "Roteiro de podcast para revendedores", icone: "mic", ext: "docx" },
  apresentacao_slides: { label: "Apresentação 10 slides", descricao: "Slides estruturados para revendedores", icone: "presentation", ext: "pptx" },
  folheto_a4: { label: "Folheto A4 — Cliente final", descricao: "Folheto promocional A4", icone: "file-text", ext: "pdf" },
  ficha_tecnica: { label: "Ficha técnica — Vendedores", descricao: "Ficha técnica interna", icone: "clipboard-list", ext: "pdf" },
  emails_revendedores: { label: "Sequência 2 e-mails — Revendedores", descricao: "Sequência comercial", icone: "mail", ext: "docx" },
  emails_cliente_final: { label: "Sequência 3 e-mails — Cliente final", descricao: "Sequência de nutrição", icone: "mail", ext: "docx" },
  posts_linkedin: { label: "2 posts LinkedIn", descricao: "Conteúdo B2B", icone: "linkedin", ext: "txt" },
  posts_facebook: { label: "2 posts Facebook", descricao: "Conteúdo social", icone: "facebook", ext: "txt" },
  posts_instagram: { label: "2 posts Instagram", descricao: "Conteúdo visual", icone: "instagram", ext: "txt" },
  roteiro_video_curto: { label: "Roteiro vídeo 15-30s", descricao: "Roteiro curto para Reels/Shorts", icone: "video", ext: "txt" },
};

export type Campaign = {
  id: string;
  nome: string;
  status: CampaignStatus;
  createdAt: string;
  source: SourceFile;
  transcricao: string;
  brief?: StructuredBrief;
  materiais?: Partial<Record<MaterialKey, string>>;
  /** data URL `data:audio/wav;base64,...` gerado pelo Groq TTS para o podcast */
  podcastAudioUrl?: string;
};

const seed: Campaign[] = [
  {
    id: "cmp_001",
    nome: "Pipetadores DLAB — Compre 3 Leve 4",
    status: "materiais_gerados",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    source: { name: "reuniao-dlab-pipetadores.mp4", type: "video", sizeKb: 184320 },
    transcricao:
      "Pessoal, hoje vamos falar da campanha dos pipetadores DLAB. A proposta principal é Compre 3 Leve 4, válida até o fim do mês. " +
      "Foco em revendedores que já trabalham com a linha DLAB. As subcategorias dessa campanha são: micropipetas monocanal, multicanal, " +
      "auxiliar de pipetagem, micropipetas eletrônicas, dispensadores, buretas digitais e repipetadores. Diferenciais técnicos: calibração " +
      "rastreável ISO, ergonomia, baixo esforço de pipetagem, autoclavável. Argumentos: ganho de margem para o revendedor de até 30%, " +
      "exclusividade DLAB no Brasil, suporte técnico Forlab. Tom de comunicação: técnico, confiável, direto.",
    brief: {
      marca: "DLAB (distribuída por Forlab)",
      campanha: "Pipetadores DLAB — Compre 3 Leve 4",
      publico_alvo: "Revendedores de equipamentos laboratoriais e clientes finais (laboratórios de análises, pesquisa, indústria farmacêutica)",
      proposta_comercial: "Promoção sazonal Compre 3 Leve 4 em toda a linha de pipetadores DLAB, com margem ampliada para o revendedor.",
      oferta_promocional: "A cada 3 unidades adquiridas da linha DLAB, o revendedor leva 1 unidade adicional sem custo. Válido até o fim do mês.",
      subcategorias: [
        "Micropipetas monocanal",
        "Micropipetas multicanal",
        "Auxiliar de pipetagem",
        "Micropipetas eletrônicas",
        "Dispensadores",
        "Buretas digitais",
        "Repipetadores",
      ],
      diferenciais_tecnicos: [
        "Calibração rastreável ISO",
        "Ergonomia com baixo esforço de pipetagem",
        "Autoclavável (componentes selecionados)",
        "Compatibilidade ampla com ponteiras universais",
      ],
      beneficios_revendedor: [
        "Margem ampliada de até 30%",
        "Exclusividade da marca DLAB no Brasil via Forlab",
        "Material de apoio comercial pronto",
        "Suporte técnico e treinamento",
      ],
      beneficios_cliente_final: [
        "Precisão e reprodutibilidade",
        "Conforto em rotinas de alta repetição",
        "Custo-benefício pela bonificação",
        "Garantia e assistência nacional",
      ],
      objecoes_argumentos: [
        { objecao: "Já trabalho com outra marca de pipetadores.", argumento: "DLAB oferece calibração ISO rastreável e bonificação Compre 3 Leve 4, melhorando margem sem comprometer qualidade." },
        { objecao: "Preço inicial parece alto.", argumento: "Com a promoção, o custo unitário cai significativamente, ampliando margem ou competitividade no preço final." },
      ],
      tom_comunicacao: "Técnico, confiável, direto — linguagem de especialista B2B.",
      observacoes: "Campanha sazonal, com data limite no fim do mês. Reforçar urgência sem apelo agressivo.",
      inferencias_ia: ["Garantia e assistência nacional inferida pelo padrão Forlab — confirmar com time comercial."],
    },
    materiais: buildMockMaterials(),
  },
  {
    id: "cmp_002",
    nome: "Centrífugas DLAB — Lançamento DM0412",
    status: "brief_gerado",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    source: { name: "briefing-centrifugas.docx", type: "texto", sizeKb: 42 },
    transcricao: "Lançamento da centrífuga DM0412, foco em laboratórios clínicos de pequeno e médio porte...",
  },
  {
    id: "cmp_003",
    nome: "Estufas Forlab — Campanha técnica",
    status: "transcrito",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    source: { name: "audio-reuniao-estufas.mp3", type: "audio", sizeKb: 12800 },
    transcricao: "Campanha técnica para linha de estufas com ênfase em uniformidade térmica...",
  },
];

function buildMockMaterials(): Partial<Record<MaterialKey, string>> {
  return {
    podcast_revendedores: `# Podcast — Pipetadores DLAB Compre 3 Leve 4 (5 min)

[INTRO 0:00–0:20]
Olá, revendedor Forlab! Hoje vamos falar de uma campanha que vai impulsionar a sua margem: Compre 3 Leve 4 na linha completa de pipetadores DLAB.

[BLOCO 1 — Oportunidade 0:20–1:30]
A DLAB é exclusividade Forlab no Brasil. A cada 3 unidades adquiridas, você leva 1 sem custo — e isso vale para toda a família: monocanal, multicanal, eletrônicas, auxiliar de pipetagem, dispensadores, buretas digitais e repipetadores.

[BLOCO 2 — Diferenciais técnicos 1:30–3:00]
Calibração rastreável ISO, ergonomia testada para reduzir esforço repetitivo, autoclaváveis e compatíveis com ponteiras universais.

[BLOCO 3 — Argumentos comerciais 3:00–4:20]
Margem ampliada de até 30%. Material de apoio pronto. Suporte técnico Forlab a um clique.

[CTA 4:20–5:00]
Acesse o portal do revendedor, baixe o kit completo e fale com seu consultor. Campanha por tempo limitado.`,

    apresentacao_slides: `# Apresentação — 10 slides

Slide 1 — Capa: Pipetadores DLAB | Compre 3 Leve 4
Slide 2 — A oportunidade: bonificação 25% em volume
Slide 3 — Sobre a DLAB: exclusividade Forlab
Slide 4 — Linha completa: monocanal, multicanal, eletrônicas, auxiliar, dispensadores, buretas digitais, repipetadores
Slide 5 — Diferenciais técnicos: calibração ISO, ergonomia, autoclavável
Slide 6 — Para o revendedor: margem +30%, suporte, treinamento
Slide 7 — Para o cliente final: precisão, conforto, garantia
Slide 8 — Quebra de objeções
Slide 9 — Como participar (passo a passo)
Slide 10 — Próximos passos & contato`,

    folheto_a4: `# Folheto A4 — Cliente final

TÍTULO: Pipetadores DLAB — A cada 3, você leva 4.

SUBTÍTULO: Precisão de laboratório com bonificação exclusiva.

BLOCO PRINCIPAL:
Linha completa de pipetadores DLAB, distribuída com exclusividade pela Forlab.
- Monocanal e Multicanal
- Eletrônicas
- Auxiliares de pipetagem
- Dispensadores e Repipetadores
- Buretas digitais

DESTAQUES TÉCNICOS:
✔ Calibração rastreável ISO
✔ Ergonomia para alta repetição
✔ Compatibilidade universal de ponteiras

CTA: Fale com seu revendedor Forlab. Promoção válida até o fim do mês.`,

    ficha_tecnica: `# Ficha técnica — Uso interno vendedores

Marca: DLAB
Distribuição BR: Forlab (exclusivo)
Linha: Pipetadores
SKUs envolvidos: monocanal, multicanal, eletrônicas, auxiliar, dispensadores, buretas digitais, repipetadores

Mecânica: Compre 3 Leve 4 (bonificação 1:3)
Vigência: até o fim do mês corrente
Margem revendedor: até +30%

Pontos fortes para argumentação:
• Calibração ISO rastreável
• Autoclavável (linhas selecionadas)
• Suporte técnico nacional

Quebra de objeções:
- "Já uso outra marca" → bonificação melhora margem sem perda de qualidade
- "Preço alto" → custo unitário efetivo cai com a bonificação`,

    emails_revendedores: `# Sequência — 2 e-mails para revendedores

==== E-MAIL 1 — Anúncio ====
Assunto: Sua margem acabou de crescer: Compre 3 Leve 4 em pipetadores DLAB

Olá, [Nome],
A campanha Compre 3 Leve 4 da linha DLAB já começou. A cada 3 unidades, você leva 1 sem custo — válido para toda a família de pipetadores.
[CTA] Acessar condições

==== E-MAIL 2 — Reforço/urgência ====
Assunto: Última semana — bonificação DLAB encerra em breve

[Nome], a campanha encerra em poucos dias. Aproveite para girar estoque com margem ampliada.
[CTA] Falar com consultor`,

    emails_cliente_final: `# Sequência — 3 e-mails para cliente final

==== E-MAIL 1 — Apresentação ====
Assunto: Precisão DLAB com condição especial este mês
...

==== E-MAIL 2 — Diferenciais técnicos ====
Assunto: Por que laboratórios de ponta escolhem pipetadores DLAB
...

==== E-MAIL 3 — Conversão ====
Assunto: Última chamada — fale com um revendedor autorizado
...`,

    posts_linkedin: `# 2 posts LinkedIn

[POST 1]
Precisão analítica não é luxo — é requisito. A linha de pipetadores DLAB, com calibração ISO rastreável, agora em condição especial Compre 3 Leve 4. #Forlab #DLAB #Laboratorio

[POST 2]
Para o revendedor laboratorial: margem ampliada, suporte técnico nacional e linha completa DLAB com bonificação. Fale com seu consultor Forlab.`,

    posts_facebook: `# 2 posts Facebook

[POST 1]
🧪 Pipetadores DLAB com Compre 3 Leve 4 — só este mês! Toda a linha incluída.

[POST 2]
Seu laboratório merece precisão e conforto. Conheça a família DLAB e aproveite a bonificação exclusiva Forlab.`,

    posts_instagram: `# 2 posts Instagram

[POST 1] Carrossel
Capa: "Compre 3, Leve 4" • Slides: linha completa, diferenciais, CTA.

[POST 2] Reels
Roteiro 15s: produto em uso → selo da promoção → CTA "fale com seu revendedor".`,

    roteiro_video_curto: `# Roteiro de vídeo curto (15–30s)

[0–3s] Plano fechado da micropipeta DLAB em uso.
[3–8s] Texto na tela: "Precisão ISO. Ergonomia DLAB."
[8–18s] Selo grande: "Compre 3, Leve 4."
[18–25s] Linha completa em montagem rápida.
[25–30s] Locução: "Fale com seu revendedor Forlab. Por tempo limitado."`,
  };
}

// --- store ---
let state: { campaigns: Campaign[] } = { campaigns: seed };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const store = {
  getState: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  list: () => state.campaigns,
  get: (id: string) => state.campaigns.find((c) => c.id === id),
  create: (input: { nome: string; source: SourceFile; transcricao?: string }) => {
    const id = "cmp_" + Math.random().toString(36).slice(2, 8);
    const c: Campaign = {
      id,
      nome: input.nome,
      status: input.transcricao ? "transcrito" : "recebido",
      createdAt: new Date().toISOString(),
      source: input.source,
      transcricao: input.transcricao ?? "",
    };
    state = { campaigns: [c, ...state.campaigns] };
    emit();
    return c;
  },
  update: (id: string, patch: Partial<Campaign>) => {
    state = {
      campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    };
    emit();
  },
  setTranscricao: (id: string, transcricao: string) => {
    store.update(id, { transcricao, status: "transcrito" });
  },
  setBrief: (id: string, brief: StructuredBrief) => {
    store.update(id, { brief, status: "brief_gerado" });
  },
  generateMaterials: (id: string) => {
    const c = store.get(id);
    if (!c) return;
    store.update(id, { materiais: buildMockMaterials(), status: "materiais_gerados" });
  },
  /** Persiste a data URL do áudio do podcast (gerado pelo Groq TTS) */
  setPodcastAudio: (id: string, podcastAudioUrl: string) => {
    store.update(id, { podcastAudioUrl });
  },
  remove: (id: string) => {
    state = { campaigns: state.campaigns.filter((c) => c.id !== id) };
    emit();
  },
};

export function useCampaigns() {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => store.getState().campaigns,
    () => store.getState().campaigns,
  );
}

export function useCampaign(id: string | undefined) {
  const list = useCampaigns();
  return id ? list.find((c) => c.id === id) : undefined;
}

export function inferBriefFromTranscript(nome: string, transcricao: string): StructuredBrief {
  // Lightweight heuristic — picks up keywords from text. NOT hardcoded categories.
  const lower = transcricao.toLowerCase();
  const found = (terms: string[]) => terms.filter((t) => lower.includes(t.toLowerCase()));
  const candidatos = [
    "monocanal", "multicanal", "eletrônicas", "auxiliar de pipetagem",
    "dispensadores", "buretas digitais", "repipetadores",
    "centrífuga", "estufa", "agitador", "balança", "ph", "espectrofotômetro",
  ];
  const subcats = found(candidatos);
  return {
    marca: lower.includes("dlab") ? "DLAB (distribuída por Forlab)" : "Forlab",
    campanha: nome,
    publico_alvo: "Revendedores e clientes finais do segmento laboratorial",
    proposta_comercial: transcricao.slice(0, 220) + (transcricao.length > 220 ? "…" : ""),
    oferta_promocional: lower.includes("compre 3") ? "Compre 3 Leve 4 na linha indicada" : "Oferta a definir conforme briefing",
    subcategorias: subcats.length ? subcats : ["A definir conforme conteúdo do briefing"],
    diferenciais_tecnicos: ["A revisar conforme transcrição"],
    beneficios_revendedor: ["Margem ampliada", "Suporte Forlab"],
    beneficios_cliente_final: ["Qualidade técnica", "Garantia e assistência"],
    objecoes_argumentos: [{ objecao: "Já trabalho com outra marca", argumento: "Apresentar diferenciais técnicos e bonificação" }],
    tom_comunicacao: "Técnico, confiável, direto",
    observacoes: "Brief gerado por IA a partir da transcrição. Revise antes de gerar materiais.",
    inferencias_ia: ["Campos preenchidos por inferência onde a transcrição não trouxe dados explícitos."],
  };
}
