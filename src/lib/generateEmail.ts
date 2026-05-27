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

// ─── Prompt ────────────────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #f0f2f5;
  margin: 0; padding: 0;
`;

export async function generateEmailSequencia(
  textoRaw: string,
  brief: StructuredBrief,
  nomeCampanha: string,
  tipo: "revendedores" | "cliente_final",
): Promise<EmailSequencia> {
  const qtd = tipo === "revendedores" ? 2 : 3;
  const prompt = `Você é um especialista em email marketing B2B para o setor laboratorial.

Com base no TEXTO e BRIEF abaixo, gere ${qtd} e-mails HTML profissionais completos e modernos.

TEXTO:
${textoRaw}

BRIEF:
- Campanha: ${nomeCampanha}
- Marca: ${brief.marca}
- Oferta: ${brief.oferta_promocional}
- Público: ${brief.publico_alvo}
- Tom: ${brief.tom_comunicacao}
- Benefícios revendedor: ${brief.beneficios_revendedor?.join("; ") ?? ""}
- Benefícios cliente final: ${brief.beneficios_cliente_final?.join("; ") ?? ""}

Retorne SOMENTE um JSON válido sem markdown:
{
  "emails": [
    {
      "assunto": "Linha de assunto do e-mail (chamativa, max 60 chars)",
      "preheader": "Texto de preheader (max 90 chars)",
      "html": "HTML COMPLETO do e-mail responsivo aqui"
    }
  ]
}

REQUISITOS DO HTML:
- Use tabela de largura 600px centralizada com fundo branco
- Fundo externo: #f0f2f5
- Header com fundo #0F172A (azul escuro), logo em texto branco bold 22px, subtitulo em #A78BFA
- Hero section com título grande (#1E293B), descrição, botão CTA laranja (#F59E0B) com cantos arredondados
- Seção de benefícios/features com ícones emoji e texto
- Destaque da oferta em caixa com borda roxa (#6C63FF) e fundo #F5F3FF
- Footer com fundo #1E293B, texto cinza, link de descadastro
- CSS inline em todos os elementos (não use <style> tag)
- Totalmente responsivo com max-width: 600px
- Use emojis estrategicamente
- ${tipo === "revendedores" ? "E-mail 1: Apresentação da linha com diferenciais. E-mail 2: Urgencia da oferta com CTA forte" : "E-mail 1: Apresentação e autoridade. E-mail 2: Diferenciais vs concorrentes. E-mail 3: Oferta + urgência + CTA direto"}`;

  const raw = await callLLM(prompt);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("IA não retornou JSON válido para os e-mails.");
  const parsed = JSON.parse(match[0]) as EmailSequencia;
  parsed.tipo = tipo;
  return parsed;
}

export function downloadEmailHtml(html: string, index: number, nomeCampanha: string, tipo: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeCampanha.replace(/[^a-z0-9]+/gi, "_")}_email_${tipo}_${index + 1}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export { BASE_STYLE };
