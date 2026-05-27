import { callLLM } from "./generateMaterials";
import { type StructuredBrief } from "./store";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface EmailData {
  assunto: string;
  preheader: string;
  html: string;
}

export interface EmailSequencia {
  emails: EmailData[];
  tipo: "revendedores" | "cliente_final";
}

// Helper de parse JSON seguro (mesmo padrão de generateSocialPosts)
function parseJSON<T>(raw: string, label: string): T {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`IA não retornou JSON válido para ${label}.`);
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    throw new Error(`Erro ao interpretar JSON de ${label}: resposta malformada.`);
  }
}

// ─── Gerador ──────────────────────────────────────────────────────────────────

export async function generateEmailSequencia(
  textoRaw: string,
  brief: StructuredBrief,
  nomeCampanha: string,
  tipo: "revendedores" | "cliente_final",
): Promise<EmailSequencia> {
  const qtd = tipo === "revendedores" ? 2 : 3;

  const contextoPublico = tipo === "revendedores"
    ? `Público: Revendedores de equipamentos laboratoriais.\nBenefícios foco: ${brief.beneficios_revendedor.join("; ")}`
    : `Público: Laboratórios e clientes finais.\nBenefícios foco: ${brief.beneficios_cliente_final.join("; ")}`;

  const estrutura = tipo === "revendedores"
    ? "E-mail 1: Apresentação da linha com diferenciais técnicos e oportunidade de negócio.\nE-mail 2: Urgência da oferta com CTA forte e condições comerciais."
    : "E-mail 1 (Topo): Apresentação de " + brief.marca + " + ecossistema Forlab + autoridade.\nE-mail 2 (Meio): Diferenciais técnicos vs. concorrentes + casos de uso.\nE-mail 3 (Fundo): Oferta " + brief.oferta_promocional + " + urgência + CTA direto para compra.";

  const prompt = `Você é especialista em email marketing B2B para o setor laboratorial. Responda SOMENTE com JSON válido, sem markdown.

Com base no TEXTO e BRIEF abaixo, gere ${qtd} e-mails HTML profissionais, modernos e responsivos.

TEXTO:
${textoRaw}

BRIEF:
- Campanha: ${nomeCampanha}
- Marca: ${brief.marca}
- Oferta: ${brief.oferta_promocional}
- Tom: ${brief.tom_comunicacao}
- Diferenciais: ${brief.diferenciais_tecnicos.join("; ")}
- ${contextoPublico}

ESTRUTURA DOS E-MAILS:
${estrutura}

Retorne SOMENTE este JSON válido (sem texto antes ou depois):
{
  "emails": [
    {
      "assunto": "Linha de assunto chamativa (max 60 chars)",
      "preheader": "Texto de preheader complementar (max 90 chars)",
      "html": "HTML COMPLETO do e-mail aqui"
    }
  ]
}

REQUISITOS DO HTML DE CADA E-MAIL:
- Tabela centralizada, max-width 600px, bgcolor="#f0f2f5" no body
- Header: bgcolor="#0F172A", logo da marca em texto branco bold 22px, subtítulo em cor #A78BFA
- Hero: título grande (#1E293B bold), descrição, botão CTA bgcolor="#F59E0B" border-radius 6px texto branco
- Seção de benefícios/features: ícones emoji + texto descritivo por item
- Destaque da oferta: caixa com border 2px solid #6C63FF, bgcolor #F5F3FF, texto da oferta em destaque
- Footer: bgcolor="#1E293B", texto cinza claro, link de descadastro
- TODOS os estilos inline (sem tag <style>)
- Totalmente responsivo
- Use emojis estrategicamente nos títulos e benefícios`;

  const raw = await callLLM(prompt);
  const parsed = parseJSON<{ emails: EmailData[] }>(raw, `e-mails (${tipo})`);
  return { emails: parsed.emails, tipo };
}

// ─── Download ─────────────────────────────────────────────────────────────────

export function downloadEmailHtml(html: string, index: number, nomeCampanha: string, tipo: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeCampanha.replace(/[^a-z0-9]+/gi, "_")}_email_${tipo}_${index + 1}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
