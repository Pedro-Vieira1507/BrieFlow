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

export const MATERIAL_META: Record<
  MaterialKey,
  { label: string; descricao: string; icone: string; ext: "txt" | "docx" | "pdf" | "pptx" }
> = {
  podcast_revendedores:  { label: "Podcast 5 min — Revendedores",       descricao: "Roteiro de podcast para revendedores",   icone: "mic",              ext: "docx" },
  apresentacao_slides:   { label: "Apresentação 10 slides",              descricao: "Slides estruturados para revendedores",  icone: "presentation",     ext: "pptx" },
  folheto_a4:            { label: "Folheto A4 — Cliente final",          descricao: "Folheto promocional A4",                 icone: "file-text",        ext: "pdf"  },
  ficha_tecnica:         { label: "Ficha técnica — Vendedores",          descricao: "Ficha técnica interna",                  icone: "clipboard-list",   ext: "pdf"  },
  emails_revendedores:   { label: "Sequência 2 e-mails — Revendedores",  descricao: "Sequência comercial",                    icone: "mail",             ext: "docx" },
  emails_cliente_final:  { label: "Sequência 3 e-mails — Cliente final", descricao: "Sequência de nutrição",                  icone: "mail",             ext: "docx" },
  posts_linkedin:        { label: "2 posts LinkedIn",                    descricao: "Conteúdo B2B",                           icone: "linkedin",         ext: "txt"  },
  posts_facebook:        { label: "2 posts Facebook",                    descricao: "Conteúdo social",                        icone: "facebook",         ext: "txt"  },
  posts_instagram:       { label: "2 posts Instagram",                   descricao: "Conteúdo visual",                        icone: "instagram",        ext: "txt"  },
  roteiro_video_curto:   { label: "Roteiro vídeo 15-30s",                descricao: "Roteiro curto para Reels/Shorts",        icone: "video",            ext: "txt"  },
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
  podcastAudioUrl?: string;
};

const initialCampaigns: Campaign[] = [];

// --- store ---
let state: { campaigns: Campaign[] } = { campaigns: initialCampaigns };
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
  // ✅ Persiste materiais gerados — recebe resultado já pronto de generateAllMaterials
  // Faz merge com materiais existentes para preservar os não regerados
  setMateriais: (
    id: string,
    materiais: Partial<Record<MaterialKey, string>>,
    options?: { merge?: boolean },
  ) => {
    const existing = options?.merge !== false
      ? (state.campaigns.find((c) => c.id === id)?.materiais ?? {})
      : {};
    store.update(id, {
      materiais: { ...existing, ...materiais },
      status: "materiais_gerados",
    });
  },
  /** Apenas para o botão "Usar exemplo (mock)" — explícito e intencional */
  generateMockMaterials: (id: string) => {
    store.update(id, { materiais: buildMockMaterials(), status: "materiais_gerados" });
  },
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
  const lower = transcricao.toLowerCase();

  function detectMarca(): string {
    const marcaMatch = transcricao.match(/\b(IKA|DLAB|Forlab|Sartorius|Eppendorf|Mettler|Thermo|Merck|Sigma)\b/i);
    return marcaMatch ? marcaMatch[1].toUpperCase() : "A identificar";
  }

  const equipamentos = [
    "chiller", "banho termostático", "banho de termostato", "circulador",
    "evaporador rotativo", "incubadora", "condensador", "destilação",
    "micropipeta", "monocanal", "multicanal", "dispensador", "bureta digital",
    "repipetador", "centrífuga", "estufa", "agitador", "balança",
    "espectrofotômetro", "ph-metro", "cromatógrafo",
  ];
  const subcats = equipamentos.filter((t) => lower.includes(t));

  const ofertaMatch = transcricao.match(/compre\s+\d+\s+leve\s+\d+|promo[çc][aã]o[^.]+|desconto[^.]+|oferta[^.]+/i);

  const tom = lower.includes("técn") ? "Técnico, informativo, confiável"
    : lower.includes("urgent") || lower.includes("promo") ? "Direto, com urgência"
    : "Profissional e acessível";

  return {
    marca: detectMarca(),
    campanha: nome,
    publico_alvo: "Revendedores e clientes finais do segmento laboratorial",
    proposta_comercial: transcricao.slice(0, 280) + (transcricao.length > 280 ? "…" : ""),
    oferta_promocional: ofertaMatch ? ofertaMatch[0] : "A definir conforme briefing",
    subcategorias: subcats.length ? subcats : ["A definir conforme conteúdo da transcrição"],
    diferenciais_tecnicos: ["A revisar conforme transcrição"],
    beneficios_revendedor: ["Margem ampliada", "Suporte técnico"],
    beneficios_cliente_final: ["Qualidade técnica", "Garantia e assistência"],
    objecoes_argumentos: [
      { objecao: "Já trabalho com outra marca", argumento: "Apresentar diferenciais técnicos e condições comerciais" },
    ],
    tom_comunicacao: tom,
    observacoes: "Brief gerado localmente a partir da transcrição. Revise antes de gerar materiais.",
    inferencias_ia: ["Campos preenchidos por inferência — confirme com o time comercial."],
  };
}

// Mock materials — usado APENAS quando o usuário clica em "Usar exemplo (mock)"
function buildMockMaterials(): Partial<Record<MaterialKey, string>> {
  return {
    podcast_revendedores:  "# Podcast de exemplo\n\nEste é um material de demonstração. Gere os materiais reais com IA.",
    apresentacao_slides:   "# Apresentação de exemplo\n\nSlide 1 — Capa\nSlide 2 — Conteúdo\n...\n\nGere os materiais reais com IA.",
    folheto_a4:            "# Folheto de exemplo\n\nConteúdo demonstrativo. Gere os materiais reais com IA.",
    ficha_tecnica:         "# Ficha técnica de exemplo\n\nConteúdo demonstrativo. Gere os materiais reais com IA.",
    emails_revendedores:   "# E-mails de exemplo\n\n=== E-MAIL 1 ===\nConteúdo demonstrativo.\n\n=== E-MAIL 2 ===\nConteúdo demonstrativo.",
    emails_cliente_final:  "# E-mails de exemplo\n\n=== E-MAIL 1 ===\nConteúdo demonstrativo.\n\n=== E-MAIL 2 ===\nConteúdo demonstrativo.\n\n=== E-MAIL 3 ===\nConteúdo demonstrativo.",
    posts_linkedin:        "# Posts LinkedIn de exemplo\n\n[POST 1]\nConteúdo demonstrativo.\n\n[POST 2]\nConteúdo demonstrativo.",
    posts_facebook:        "# Posts Facebook de exemplo\n\n[POST 1]\nConteúdo demonstrativo.\n\n[POST 2]\nConteúdo demonstrativo.",
    posts_instagram:       "# Posts Instagram de exemplo\n\n[POST 1 — Carrossel]\nConteúdo demonstrativo.\n\n[POST 2 — Reels]\nConteúdo demonstrativo.",
    roteiro_video_curto:   "# Roteiro de vídeo de exemplo\n\n[0–3s] Imagem do produto.\n[3–15s] Diferenciais técnicos.\n[15–30s] CTA final.",
  };
}