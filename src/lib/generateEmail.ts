import { callLLM } from "./generateMaterials";
import { type StructuredBrief } from "./store";

export interface EmailData {
  assunto: string;
  preheader: string;
  html: string;
}

export interface EmailSequencia {
  emails: EmailData[];
  tipo: "revendedores" | "cliente_final";
}

export async function generateEmailSequencia(
  textoRaw: string,
  brief: StructuredBrief,
  nomeCampanha: string,
  tipo: "revendedores" | "cliente_final",
): Promise<EmailSequencia> {
  const qtd = tipo === "revendedores" ? 2 : 3;
  const tipoLabel = tipo === "revendedores" ? "revendedores B2B" : "clientes finais (laboratórios)";

  const sequenciaInstrucao = tipo === "revendedores"
    ? `E-mail 1: Apresentação da linha ${brief.marca} com diferenciais técnicos e benefícios para o revendedor.\nE-mail 2: Urgência da oferta "${brief.oferta_promocional}" com CTA forte e prazo.`
    : `E-mail 1 (Topo): Apresentação de ${brief.marca}, ecossistema e autoridade técnica.\nE-mail 2 (Meio): Diferenciais vs. concorrentes, subcategorias: ${brief.subcategorias?.join(", ") ?? ""}.\nE-mail 3 (Fundo): Oferta "${brief.oferta_promocional}" + urgência + CTA direto.`;

  const prompt = `Você é especialista em email marketing para o setor laboratorial e científico.\n\nCrie ${qtd} e-mails HTML profissionais completos para ${tipoLabel}.\n\nCONTEXTO:\n- Marca: ${brief.marca}\n- Campanha: ${nomeCampanha}\n- Oferta: ${brief.oferta_promocional}\n- Público: ${brief.publico_alvo}\n- Tom: ${brief.tom_comunicacao}\n- Diferenciais: ${brief.diferenciais_tecnicos?.join("; ") ?? ""}\n- Benefícios revendedor: ${brief.beneficios_revendedor?.join("; ") ?? ""}\n- Benefícios cliente final: ${brief.beneficios_cliente_final?.join("; ") ?? ""}\n- Subcategorias: ${brief.subcategorias?.join(", ") ?? ""}\n\nTEXTO DE REFERÊNCIA:\n${textoRaw}\n\nSEQUÊNCIA:\n${sequenciaInstrucao}\n\nRetorne SOMENTE JSON válido sem markdown:\n{\n  "emails": [\n    {\n      "assunto": "Assunto chamativo max 60 chars",\n      "preheader": "Preheader complementar max 90 chars",\n      "html": "HTML COMPLETO inline CSS aqui"\n    }\n  ]\n}\n\nREQUISITOS HTML:\n- Tabela 600px centralizada, fundo externo #f0f2f5\n- Header fundo #0F172A, marca branco bold 22px, subtítulo #A78BFA\n- Hero: título grande, descrição, botão CTA #F59E0B border-radius 8px\n- Seção benefícios com emojis\n- Destaque oferta: borda #6C63FF fundo #F5F3FF\n- Footer #1E293B, texto cinza, link descadastro\n- TODO CSS inline, sem tag style\n- Responsivo max-width 600px`;

  const raw = await callLLM(prompt);
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON válido para os e-mails. Tente novamente.");

  let parsed: { emails?: EmailData[] };
  try {
    parsed = JSON.parse(match[0]) as { emails?: EmailData[] };
  } catch {
    throw new Error("Erro ao interpretar JSON dos e-mails. Tente novamente.");
  }

  if (!Array.isArray(parsed.emails) || parsed.emails.length === 0) {
    throw new Error("Nenhum e-mail foi gerado. Verifique o conteúdo e tente novamente.");
  }

  return { emails: parsed.emails, tipo };
}

export function downloadEmailHtml(
  html: string,
  index: number,
  nomeCampanha: string,
  tipo: string,
): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeCampanha.replace(/[^a-z0-9]+/gi, "_")}_email_${tipo}_${index + 1}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
