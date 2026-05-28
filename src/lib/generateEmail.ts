import { callLLM } from "./generateMaterials";
import { type StructuredBrief } from "./store";
import { loadAIConfig, buildDistribuidoraContext } from "./aiConfig";

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

function repairControlChars(input: string): string {
  let out = "";
  let inStr = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (escaped) { out += c; escaped = false; continue; }
    if (c === "\\") { escaped = true; out += c; continue; }
    if (!inStr && c === '"') { inStr = true; out += c; continue; }
    if (inStr && c === '"') { inStr = false; out += c; continue; }
    if (inStr) {
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
    }
    out += c;
  }
  return out;
}

/**
 * Extrai o bloco { ... } externo usando depth-counter —
 * ignora } dentro de strings e de CSS, evitando o bug do lastIndexOf.
 */
function extractOuterObject(s: string): string {
  const start = s.indexOf("{");
  if (start === -1) return s;
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return s.slice(start, i + 1); }
  }
  return s.slice(start);
}

function sanitizeAndParse<T>(raw: string): T {
  let s = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim()
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  s = extractOuterObject(s);

  try { return JSON.parse(s) as T; } catch { /* continua */ }
  const repaired = repairControlChars(s);
  try { return JSON.parse(repaired) as T; } catch { /* continua */ }
  throw new Error("JSON inválido");
}

// ---------------------------------------------------------------------------
// Gera UM único e-mail por chamada — evita truncamento e JSON gigante
// ---------------------------------------------------------------------------

async function generateSingleEmail(
  brief: StructuredBrief,
  nomeCampanha: string,
  tipo: "revendedores" | "cliente_final",
  numero: number,
  total: number,
  instrucao: string,
  textoRaw: string,
): Promise<EmailData> {
  const tipoLabel = tipo === "revendedores" ? "revendedores B2B" : "clientes finais (laboratórios)";

  // Carrega contexto da distribuidora configurada
  const config = loadAIConfig();
  const distCtx = buildDistribuidoraContext(config.distribuidora);
  const dist = config.distribuidora;

  // Monta as cores do header/CTA usando as cores da distribuidora (com fallback)
  const corHeader  = dist.coresMarca?.match(/#[0-9a-fA-F]{3,6}/)?.[0] ?? "#0F172A";
  const corCTA     = dist.coresMarca?.match(/#[0-9a-fA-F]{3,6}/g)?.[1] ?? "#F59E0B";
  const nomeRem    = dist.nome       || "[Nome da Distribuidora]";
  const siteRem    = dist.siteUrl    || "#";
  const endRem     = dist.endereco   || "";
  const emailRem   = dist.emailContato || "";
  const telRem     = dist.contato    || "";
  const razaoRem   = dist.razaoSocial || "";

  const rodapeInfo = [
    razaoRem && `Razão social: ${razaoRem}`,
    endRem   && `Endereço: ${endRem}`,
    telRem   && `Contato: ${telRem}`,
    emailRem && `E-mail: ${emailRem}`,
  ].filter(Boolean).join(" · ");

  const prompt = `Você é especialista em email marketing para o setor laboratorial e científico.

Gere o E-MAIL ${numero} de ${total} para ${tipoLabel}.

${distCtx ? distCtx + "\n" : ""}
CONTEXTO DA CAMPANHA (produto/marca divulgada):
- Marca do produto: ${brief.marca}
- Campanha: ${nomeCampanha}
- Oferta: ${brief.oferta_promocional}
- Público: ${brief.publico_alvo}
- Tom da campanha: ${brief.tom_comunicacao}
- Diferenciais técnicos: ${brief.diferenciais_tecnicos?.join("; ") ?? ""}
- Benefícios revendedor: ${brief.beneficios_revendedor?.join("; ") ?? ""}
- Benefícios cliente final: ${brief.beneficios_cliente_final?.join("; ") ?? ""}
- Subcategorias: ${brief.subcategorias?.join(", ") ?? ""}

TEXTO DE REFERÊNCIA:
${textoRaw}

INSTRUÇÃO DESTE E-MAIL:
${instrucao}

Retorne SOMENTE o JSON abaixo, sem markdown, sem explicações extras.
USE ASPAS SIMPLES em TODOS os atributos HTML.

{
  "assunto": "Assunto chamativo max 60 chars",
  "preheader": "Preheader complementar max 90 chars",
  "html": "<table style='border-collapse:collapse;width:100%;max-width:600px;margin:0 auto;background:#f0f2f5'> ... HTML COMPLETO com aspas simples ... </table>"
}

REQUISITOS HTML:
- Tabela 600px centralizada, fundo externo #f0f2f5
- Header: fundo ${corHeader}, nome "${nomeRem}" em branco bold 22px (o remetente é a distribuidora)
- Subtítulo no header referenciando a marca do produto divulgada
- Hero: título grande sobre a campanha, descrição, botão CTA cor ${corCTA} border-radius 8px
- Seção benefícios com emojis
- Destaque oferta com borda e fundo suave
- Footer: fundo escuro, logo/nome "${nomeRem}", site ${siteRem}${rodapeInfo ? ", " + rodapeInfo : ""}, link descadastro
- TODO CSS inline com ASPAS SIMPLES (style='...')
- Sem tag <style> separada
- Responsivo max-width 600px`;

  const raw = await callLLM(prompt);

  let parsed: EmailData;
  try {
    parsed = sanitizeAndParse<EmailData>(raw);
  } catch {
    // Fallback: extrai campos individualmente por regex
    const assuntoM  = raw.match(/"assunto"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    const preheaderM = raw.match(/"preheader"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    const htmlM     = raw.match(/<table[\s\S]*<\/table>/i) ?? raw.match(/<html[\s\S]*<\/html>/i);
    parsed = {
      assunto:  assuntoM?.[1]  ?? `E-mail ${numero}`,
      preheader: preheaderM?.[1] ?? "",
      html: htmlM?.[0] ?? "",
    };
  }

  return {
    ...parsed,
    html: parsed.html?.replace(/&quot;/g, '"') ?? "",
  };
}

// ---------------------------------------------------------------------------
// Função principal — dispara uma chamada por e-mail
// ---------------------------------------------------------------------------

export async function generateEmailSequencia(
  textoRaw: string,
  brief: StructuredBrief,
  nomeCampanha: string,
  tipo: "revendedores" | "cliente_final",
): Promise<EmailSequencia> {
  const instrucoes =
    tipo === "revendedores"
      ? [
          `E-mail 1 de 2 — APRESENTAÇÃO: Apresente a linha ${brief.marca} com diferenciais técnicos e benefícios exclusivos para o revendedor. Tom consultivo e profissional.`,
          `E-mail 2 de 2 — URGÊNCIA/CTA: Destaque a oferta "${brief.oferta_promocional}". Crie sensação de escassez e prazo. CTA forte e direto ao revendedor.`,
        ]
      : [
          `E-mail 1 de 3 — TOPO: Apresente ${brief.marca}, ecossistema completo e autoridade técnica. Tom educativo.`,
          `E-mail 2 de 3 — MEIO: Diferenciais vs. concorrentes. Destaque subcategorias: ${brief.subcategorias?.join(", ") ?? ""}. Tom comparativo e consultivo.`,
          `E-mail 3 de 3 — FUNDO/CTA: Oferta "${brief.oferta_promocional}" com urgência, prazo e CTA direto para compra ou contato.`,
        ];

  const total = instrucoes.length;
  const emails: EmailData[] = [];

  for (let i = 0; i < instrucoes.length; i++) {
    const email = await generateSingleEmail(
      brief, nomeCampanha, tipo,
      i + 1, total, instrucoes[i], textoRaw,
    );
    emails.push(email);
  }

  if (emails.length === 0) {
    throw new Error("Nenhum e-mail foi gerado. Verifique o conteúdo e tente novamente.");
  }

  return { emails, tipo };
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

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
