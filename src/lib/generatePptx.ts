import PptxGenJS from "pptxgenjs";
import { callLLM } from "./generateMaterials"; // reutiliza a função de chamada da IA
import { type StructuredBrief } from "./store";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SlideData {
  titulo: string;
  subtitulo?: string;
  bullets: string[];
  imagemQuery: string; // termo para buscar imagem no Unsplash
  notas?: string;      // notas do apresentador
  tipo: "capa" | "conteudo" | "destaque" | "encerramento";
}

// ─── Prompt para a IA gerar os slides estruturados ───────────────────────────

function buildPptxPrompt(roteiro: string, brief: StructuredBrief, nomeCampanha: string): string {
  return `Você é um especialista em apresentações executivas e marketing.

Com base no ROTEIRO e BRIEF abaixo, crie uma apresentação PowerPoint profissional e completa.

ROTEIRO:
${roteiro}

BRIEF:
- Campanha: ${nomeCampanha}
- Marca: ${brief.marca}
- Produto: ${brief.produto}
- Público-alvo: ${brief.publicoAlvo}
- Objetivo: ${brief.objetivo}

INSTRUÇÕES:
- Gere entre 8 e 12 slides
- Expanda cada tópico do roteiro com conteúdo real e detalhado
- Os bullets devem ter frases completas e informativas (não apenas palavras soltas)
- Inclua dados, percentuais ou argumentos de venda quando relevante
- O primeiro slide é sempre a CAPA
- O último slide é sempre o ENCERRAMENTO com call-to-action
- Slides de DESTAQUE (apenas 1 frase impactante) podem ser usados para separar seções

Retorne SOMENTE um JSON válido, sem markdown, sem explicações, no seguinte formato:
{
  "slides": [
    {
      "titulo": "Título do slide",
      "subtitulo": "Subtítulo opcional (só para capa ou destaque)",
      "bullets": ["Bullet 1 detalhado", "Bullet 2 detalhado"],
      "imagemQuery": "termo em inglês para buscar imagem relevante no Unsplash",
      "notas": "Notas do apresentador com dicas de fala",
      "tipo": "capa" | "conteudo" | "destaque" | "encerramento"
    }
  ]
}`;
}

// ─── Busca imagem no Unsplash (gratuito, sem API key) ────────────────────────

async function fetchUnsplashImage(query: string): Promise<string | null> {
  try {
    const url = `https://source.unsplash.com/1280x720/?${encodeURIComponent(query)}`;
    // Converte para base64 para embutir no PPTX
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Gera slides estruturados via IA ─────────────────────────────────────────

export async function generateSlidesWithAI(
  roteiro: string,
  brief: StructuredBrief,
  nomeCampanha: string,
): Promise<SlideData[]> {
  const prompt = buildPptxPrompt(roteiro, brief, nomeCampanha);
  const raw = await callLLM(prompt, "Você é um especialista em apresentações PowerPoint.");

  // Extrai o JSON da resposta (remove possível markdown)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("A IA não retornou um JSON válido para os slides.");

  const parsed = JSON.parse(jsonMatch[0]);
  if (!parsed.slides || !Array.isArray(parsed.slides)) {
    throw new Error("Formato de slides inválido retornado pela IA.");
  }

  return parsed.slides as SlideData[];
}

// ─── Tema visual ──────────────────────────────────────────────────────────────

const T = {
  bg: "0F172A",           // fundo azul-escuro
  bgCard: "1E293B",       // card cinza-azulado
  accent: "6C63FF",       // violeta BriefFlow
  accentLight: "A78BFA",
  accentGreen: "10B981",  // verde para destaques positivos
  white: "F8FAFC",
  gray: "94A3B8",
  font: "Calibri",
};

// ─── Builder do PPTX ─────────────────────────────────────────────────────────

export async function generatePptx(
  slides: SlideData[],
  brief: StructuredBrief,
  nomeCampanha: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "BriefFlow";
  pptx.title = nomeCampanha;

  const totalSlides = slides.length;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    onProgress?.(i + 1, totalSlides);

    // Busca imagem para o slide
    const imgData = await fetchUnsplashImage(slide.imagemQuery);

    if (slide.tipo === "capa") {
      buildCapaSlide(pptx, slide, nomeCampanha, brief, imgData);
    } else if (slide.tipo === "destaque") {
      buildDestaqueSlide(pptx, slide, imgData);
    } else if (slide.tipo === "encerramento") {
      buildEncerramentoSlide(pptx, slide, brief, imgData);
    } else {
      buildConteudoSlide(pptx, slide, i, imgData);
    }
  }

  const fileName = `${nomeCampanha.replace(/[^a-z0-9]+/gi, "_")}_apresentacao.pptx`;
  await pptx.writeFile({ fileName });
}

// ─── Templates de slide ───────────────────────────────────────────────────────

function buildCapaSlide(
  pptx: PptxGenJS,
  slide: SlideData,
  nomeCampanha: string,
  brief: StructuredBrief,
  imgData: string | null,
) {
  const s = pptx.addSlide();
  s.background = { color: T.bg };

  // Imagem de fundo com overlay escuro
  if (imgData) {
    s.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%", transparency: 60 });
  }

  // Overlay gradiente (retângulo escuro na metade esquerda)
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 7.5, h: "100%",
    fill: { color: T.bg, transparency: 10 },
    line: { color: T.bg },
  });

  // Barra de destaque vertical
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.22, h: "100%",
    fill: { color: T.accent },
    line: { color: T.accent },
  });

  // Marca/empresa
  s.addText(brief.marca?.toUpperCase() || "BRIEFFLOW", {
    x: 0.5, y: 1.2, w: 6.5, h: 0.4,
    fontSize: 11, bold: true, color: T.accentLight,
    fontFace: T.font, charSpacing: 4,
  });

  // Título principal
  s.addText(slide.titulo, {
    x: 0.5, y: 1.8, w: 6.5, h: 2.0,
    fontSize: 38, bold: true, color: T.white,
    fontFace: T.font, wrap: true,
  });

  // Subtítulo
  if (slide.subtitulo) {
    s.addText(slide.subtitulo, {
      x: 0.5, y: 4.0, w: 6.5, h: 0.7,
      fontSize: 18, color: T.accentLight,
      fontFace: T.font,
    });
  }

  // Linha separadora
  s.addShape(pptx.ShapeType.rect, {
    x: 0.5, y: 5.0, w: 3.0, h: 0.05,
    fill: { color: T.accent },
    line: { color: T.accent },
  });

  // Nome da campanha
  s.addText(nomeCampanha, {
    x: 0.5, y: 5.2, w: 6.5, h: 0.4,
    fontSize: 13, color: T.gray,
    fontFace: T.font,
  });

  // Rodapé
  s.addText("Gerado por BriefFlow", {
    x: 0.5, y: 7.1, w: 12.3, h: 0.3,
    fontSize: 9, color: T.gray,
    fontFace: T.font, align: "right",
  });

  if (slide.notas) s.addNotes(slide.notas);
}

function buildConteudoSlide(
  pptx: PptxGenJS,
  slide: SlideData,
  index: number,
  imgData: string | null,
) {
  const s = pptx.addSlide();
  s.background = { color: T.bg };

  const hasImage = !!imgData;

  // Imagem no lado direito (se disponível)
  if (hasImage) {
    s.addImage({ data: imgData!, x: 7.2, y: 0, w: 6.13, h: "100%", transparency: 20 });
    // Gradiente sobre a imagem
    s.addShape(pptx.ShapeType.rect, {
      x: 6.8, y: 0, w: 6.53, h: "100%",
      fill: { color: T.bg, transparency: 30 },
      line: { color: T.bg },
    });
  }

  // Barra topo
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: "100%", h: 0.1,
    fill: { color: T.accent },
    line: { color: T.accent },
  });

  // Número do slide
  s.addText(`${index}`, {
    x: 12.5, y: 0.2, w: 0.7, h: 0.35,
    fontSize: 10, color: T.gray,
    fontFace: T.font, align: "right",
  });

  // Título
  s.addText(slide.titulo, {
    x: 0.4, y: 0.25, w: hasImage ? 6.4 : 12.4, h: 0.85,
    fontSize: 26, bold: true, color: T.white,
    fontFace: T.font, wrap: true,
  });

  // Linha abaixo do título
  s.addShape(pptx.ShapeType.rect, {
    x: 0.4, y: 1.15, w: hasImage ? 6.2 : 12.0, h: 0.04,
    fill: { color: T.accent },
    line: { color: T.accent },
  });

  // Bullets como caixas individuais
  const maxBullets = hasImage ? 5 : 6;
  const bulletsToShow = slide.bullets.slice(0, maxBullets);
  const bulletAreaW = hasImage ? 6.2 : 12.0;
  const bulletH = 0.82;
  const startY = 1.35;

  bulletsToShow.forEach((bullet, bi) => {
    const y = startY + bi * (bulletH + 0.08);

    // Fundo da caixa do bullet
    s.addShape(pptx.ShapeType.rect, {
      x: 0.4, y, w: bulletAreaW, h: bulletH,
      fill: { color: T.bgCard },
      line: { color: "2D3748", width: 0.5 },
      rectRadius: 0.05,
    });

    // Marcador colorido
    s.addShape(pptx.ShapeType.rect, {
      x: 0.4, y: y + 0.15, w: 0.06, h: bulletH - 0.3,
      fill: { color: bi % 2 === 0 ? T.accent : T.accentGreen },
      line: { color: bi % 2 === 0 ? T.accent : T.accentGreen },
    });

    // Texto do bullet
    s.addText(bullet, {
      x: 0.65, y, w: bulletAreaW - 0.4, h: bulletH,
      fontSize: 14, color: T.white,
      fontFace: T.font, valign: "middle", wrap: true,
    });
  });

  if (slide.notas) s.addNotes(slide.notas);
}

function buildDestaqueSlide(
  pptx: PptxGenJS,
  slide: SlideData,
  imgData: string | null,
) {
  const s = pptx.addSlide();
  s.background = { color: T.accent };

  if (imgData) {
    s.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%", transparency: 75 });
  }

  // Frase de destaque centralizada
  s.addText(slide.titulo, {
    x: 1.0, y: 2.0, w: 11.33, h: 3.5,
    fontSize: 40, bold: true, color: T.white,
    fontFace: T.font, align: "center", valign: "middle",
    wrap: true,
  });

  if (slide.subtitulo) {
    s.addText(slide.subtitulo, {
      x: 1.0, y: 5.7, w: 11.33, h: 0.6,
      fontSize: 18, color: "E0E7FF",
      fontFace: T.font, align: "center",
    });
  }

  if (slide.notas) s.addNotes(slide.notas);
}

function buildEncerramentoSlide(
  pptx: PptxGenJS,
  slide: SlideData,
  brief: StructuredBrief,
  imgData: string | null,
) {
  const s = pptx.addSlide();
  s.background = { color: T.bg };

  if (imgData) {
    s.addImage({ data: imgData, x: 0, y: 0, w: "100%", h: "100%", transparency: 70 });
  }

  // Barra lateral
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.22, h: "100%",
    fill: { color: T.accentGreen },
    line: { color: T.accentGreen },
  });

  s.addText(slide.titulo, {
    x: 0.5, y: 1.5, w: 12.3, h: 1.5,
    fontSize: 36, bold: true, color: T.white,
    fontFace: T.font, align: "center", wrap: true,
  });

  if (slide.bullets.length > 0) {
    s.addText(slide.bullets.join("  ·  "), {
      x: 0.5, y: 3.3, w: 12.3, h: 0.8,
      fontSize: 16, color: T.accentLight,
      fontFace: T.font, align: "center", wrap: true,
    });
  }

  s.addText(brief.marca || "BriefFlow", {
    x: 0.5, y: 6.5, w: 12.3, h: 0.5,
    fontSize: 14, color: T.gray,
    fontFace: T.font, align: "center",
  });

  if (slide.notas) s.addNotes(slide.notas);
}