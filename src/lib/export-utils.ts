const DEFAULT_ASSET_TIMEOUT_MS = 12_000;
const DOWNLOAD_URL_LIFETIME_MS = 1_000;

export interface SocialExportContent {
  brandName?: unknown;
  caption?: unknown;
  hashtags?: unknown;
}

export function sanitizeFilenamePart(
  value: unknown,
  fallback = "marca",
): string {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || fallback;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeHashtag(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/^#+/, "")
    .replace(/[^\p{Letter}\p{Number}_]/gu, "");
}

export function buildSocialExportText(content: SocialExportContent): string {
  const brandName = String(content.brandName ?? "").trim() || "Marca";
  const caption = String(content.caption ?? "").trim();
  const captionTags = Array.from(
    caption.matchAll(/(?:^|\s)#([\p{Letter}\p{Number}_]+)/gu),
    (match) => match[1],
  );
  const stateTags = Array.isArray(content.hashtags) ? content.hashtags : [];

  const uniqueTags = new Map<string, string>();
  for (const rawTag of [...captionTags, ...stateTags]) {
    const tag = normalizeHashtag(rawTag);
    const key = tag.toLocaleLowerCase("pt-BR");
    if (tag && !uniqueTags.has(key)) uniqueTags.set(key, tag);
  }

  const captionWithoutTags = caption
    .replace(/(?:^|\s)#[\p{Letter}\p{Number}_]+/gu, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const hashtagLine = Array.from(uniqueTags.values(), (tag) => `#${tag}`).join(
    " ",
  );

  return [brandName, captionWithoutTags, hashtagLine]
    .filter(Boolean)
    .join("\n\n");
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForFonts(deadline: number): Promise<void> {
  if (!("fonts" in document)) return;

  const remaining = Math.max(0, deadline - Date.now());
  await Promise.race([
    document.fonts.ready.then(() => undefined),
    new Promise<void>((_, reject) => {
      window.setTimeout(
        () =>
          reject(new Error("Tempo esgotado ao carregar as fontes do design.")),
        remaining,
      );
    }),
  ]);
}

async function waitForImages(
  root: HTMLElement,
  deadline: number,
): Promise<void> {
  while (Date.now() < deadline) {
    if (root.querySelector('[data-export-image-error="true"]')) {
      throw new Error(
        "A imagem da arte não pôde ser carregada. Troque a imagem ou tente regenerá-la antes de exportar.",
      );
    }

    const images = Array.from(root.querySelectorAll("img"));
    const allReady = images.every(
      (image) => image.complete && image.naturalWidth > 0,
    );

    if (allReady) {
      await Promise.all(
        images.map(async (image) => {
          if (typeof image.decode !== "function") return;
          try {
            await image.decode();
          } catch {
            if (!image.complete || image.naturalWidth === 0) throw new Error();
          }
        }),
      );
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }

  throw new Error(
    "Uma ou mais imagens não terminaram de carregar. Aguarde a prévia aparecer e tente novamente.",
  );
}

export async function waitForExportAssets(
  root: HTMLElement,
  timeoutMs = DEFAULT_ASSET_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  root.classList.add("export-rendering");
  await Promise.all([waitForFonts(deadline), waitForImages(root, deadline)]);
  await nextFrame();
  await nextFrame();

  if (root.scrollWidth <= 0 || root.scrollHeight <= 0) {
    throw new Error("O design está sem dimensões válidas para exportação.");
  }
}

export function finishExport(root: HTMLElement): void {
  root.classList.remove("export-rendering");
}

export function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  triggerDownload(objectUrl, filename);
  window.setTimeout(
    () => URL.revokeObjectURL(objectUrl),
    DOWNLOAD_URL_LIFETIME_MS,
  );
}

function inlineComputedStyles(source: Element, clone: Element): void {
  const computed = window.getComputedStyle(source);
  const cloneWithStyle = clone as HTMLElement | SVGElement;

  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    cloneWithStyle.style.setProperty(
      property,
      computed.getPropertyValue(property),
      computed.getPropertyPriority(property),
    );
  }

  clone.removeAttribute("class");
  clone.removeAttribute("contenteditable");
  clone.removeAttribute("tabindex");
  clone.removeAttribute("draggable");

  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);

  sourceChildren.forEach((sourceChild, index) => {
    const cloneChild = cloneChildren[index];
    if (!cloneChild) return;

    if (sourceChild.matches('script, style, [data-export-exclude="true"]')) {
      cloneChild.remove();
      return;
    }

    inlineComputedStyles(sourceChild, cloneChild);
  });
}

export function serializeElementWithInlineStyles(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  inlineComputedStyles(element, clone);
  clone.classList.remove("export-rendering");
  clone.removeAttribute("contenteditable");
  return clone.outerHTML;
}
