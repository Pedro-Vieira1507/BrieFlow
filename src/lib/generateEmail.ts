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

// ---------------------------------------------------------------------------
// Helpers de parse robusto
// ---------------------------------------------------------------------------

/**
 * Percorre o JSON char a char e escapa caracteres de controle LITERAIS
 * (\n, \r, \t) que estejam DENTRO de strings JSON — sem tocar em nada fora.
 * Isso resolve a maioria dos JSON quebrados pela IA.
 */
function repairControlChars(input: string): string {
  let out = "";
  let inStr = false;
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (!inStr) {
      if (c === '"') inStr = true;
      out += c; i++; continue;
    }
    if (c === "\\") { out += c; i++; if (i < input.length) { out += input[i]; i++; } continue; }
    if (c === '"') { inStr = false; out += c; i++; continue; }
    if (c === "\n") { out += "\\n"; i++; continue; }
    if (c === "\r") { out += "\\r"; i++; continue; }
    if (c === "\t") { out += "\\t"; i++; continue; }
    out += c; i++;
  }
  return out;
}

/**
 * Extrai o bloco JSON principal, remove markdown fences e conserta
 * aspas tipográficas. Tenta JSON.parse em várias camadas.
 */
function sanitizeAndParse<T>(raw: string): T {
  // Remove markdown fences
  let s = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  // Aspas tipográficas → ASCII
  s = s
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  // Extrai o bloco { ... } externo
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) s = s.slice(start, end + 1);

  // Camada 1 — parse direto
  try { return JSON.parse(s) as T; } catch { /* continua */ }

  // Camada 2 — repara chars de controle
  const repaired = repairControlChars(s);
  try { return JSON.parse(repaired) as T; } catch { /* continua */ }

  // Camada 3 — substitui aspas duplas DENTRO de valores de atributo HTML
  // (ex: style="color:#fff" → style='color:#fff') para não quebrar o JSON
  const htmlSafe = repaired.replace(
    /("html"\s*:\s*")([\s\S]*?)(",?\s*(?:"assunto"|"preheader"|\}))/g,
    (_match, prefix, htmlContent: string, suffix) => {
      // Dentro do valor HTML, troca aspas duplas por entidade HTML
      const escaped = htmlContent.replace(/"/g, "&quot;");
      return `${prefix}${escaped}${suffix}`;
    }
  );
  try { return JSON.parse(htmlSafe) as T; } catch { /* continua */ }

  throw new Error("Erro ao interpretar JSON dos e-mails. Tente novamente.");
}

/**
 * Extração manual de fallback: captura assunto, preheader e html
 * de cada bloco de e-mail sem depender de JSON.parse.
 */
function extractEmailsManually(raw: string): EmailData[] {
  const emails: EmailData[] = [];

  // Divide nos separadores que a IA costuma usar
  const blocks = raw.split(/(?:===\s*E-?MAIL\s*\d+\s*===|"assunto"\s*:)/i);

  // Alternativa: tenta capturar cada objeto {assunto, preheader, html} por regex
  const objRe = /\{[^{}]*"assunto"\s*:[\s\S]*?(?:(?="assunto"\s*:)|(?=\]\s*[,}])|$)/g;
  let m;
  while ((m = objRe.exec(raw)) !== null) {
    const block = m[0];
    const assunto = block.match(/"assunto"\s*:\s*"([^"\\]*)"/) ;
    const preheader = block.match(/"preheader"\s*:\s*"([^"\\]*)"/);
    const html = block.match(/"html"\s*:\s*"([\s\S]*?)"(?:\s*[,}])/);
    if (assunto) {
      emails.push({
        assunto: assunto[1] ?? "",
        preheader: preheader?.[1] ?? "",
        html: html?.[1]?.replace(/\\n/g, "\n").replace(/\\t/g, "") ?? "",
      });
    }
  }

  // Se não encontrou objetos, tenta extrair HTMLs soltos com separadores de texto
  if (emails.length === 0 && blocks.length > 1) {
    for (const block of blocks.slice(1)) {
      const htmlMatch = block.match(/<html[\s\S]*<\/html>/i) ?? block.match(/<table[\s\S]*<\/table>/i);
      if (htmlMatch) {
        emails.push({ assunto: "E-mail gerado", preheader: "", html: htmlMatch[0] });
      }
    }
  }

  return emails;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

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

  // ⚠️ CRÍTICO: solicitamos aspas simples nos atributos HTML para não quebrar o JSON
  const prompt = `Você é especialista em email marketing para o setor laboratorial e científico.

Crie ${qtd} e-mails HTML profissionais completos para ${tipoLabel}.

CONTEXTO:
- Marca: ${brief.marca}
- Campanha: ${nomeCampanha}
- Oferta: ${brief.oferta_promocional}
- Público: ${brief.publico_alvo}
- Tom: ${brief.tom_comunicacao}
- Diferenciais: ${brief.diferenciais_tecnicos?.join("; ") ?? ""}
- Benefícios revendedor: ${brief.beneficios_revendedor?.join("; ") ?? ""}
- Benefícios cliente final: ${brief.beneficios_cliente_final?.join("; ") ?? ""}
- Subcategorias: ${brief.subcategorias?.join(", ") ?? ""}

TEXTO DE REFERÊNCIA:
${textoRaw}

SEQUÊNCIA:
${sequenciaInstrucao}

Retorne SOMENTE JSON válido, sem markdown, sem explicações.
IMPORTANTE PARA O JSON: use ASPAS SIMPLES em todos os atributos HTML (ex: style='color:#fff' e NÃO style="color:#fff"). Isso é obrigatório para o JSON não quebrar.

{
  "emails": [
    {
      "assunto": "Assunto chamativo max 60 chars",
      "preheader": "Preheader complementar max 90 chars",
      "html": "<table ...> todo HTML com aspas simples nos atributos </table>"
    }
  ]
}

REQUISITOS HTML:
- Tabela 600px centralizada, fundo externo #f0f2f5
- Header fundo #0F172A, marca branco bold 22px, subtítulo #A78BFA
- Hero: título grande, descrição, botão CTA #F59E0B border-radius 8px
- Seção benefícios com emojis
- Destaque oferta: borda #6C63FF fundo #F5F3FF
- Footer #1E293B, texto cinza, link descadastro
- TODO CSS inline com ASPAS SIMPLES, sem tag style separada
- Responsivo max-width 600px`;

  const raw = await callLLM(prompt);

  // Camadas de parse robusto
  let parsed: { emails?: EmailData[] };
  try {
    parsed = sanitizeAndParse<{ emails?: EmailData[] }>(raw);
  } catch {
    // Fallback: extração manual campo a campo
    console.warn("[BriefFlow] JSON de e-mails inválido — tentando extração manual.");
    const manual = extractEmailsManually(raw);
    if (manual.length > 0) {
      console.warn(`[BriefFlow] Extração manual obteve ${manual.length} e-mail(s).`);
      return { emails: manual, tipo };
    }
    throw new Error(
      "A IA retornou um formato que não conseguimos processar.\n" +
      "Tente: 1) Clicar em Gerar E-mails novamente  2) Trocar o modelo em ⚙️ Configurações"
    );
  }

  if (!Array.isArray(parsed.emails) || parsed.emails.length === 0) {
    throw new Error("Nenhum e-mail foi gerado. Verifique o conteúdo e tente novamente.");
  }

  // Converte &quot; de volta para aspas duplas no HTML final (para renderização correta)
  const emails = parsed.emails.map((e) => ({
    ...e,
    html: e.html?.replace(/&quot;/g, '"') ?? "",
  }));

  return { emails, tipo };
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
