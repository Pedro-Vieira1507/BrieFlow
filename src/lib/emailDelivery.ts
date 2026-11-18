import { escapeHtml } from "./export-utils.ts";
import type { BuilderState } from "../types/builder";

export function webDestination(value: string | null | undefined): string {
  try {
    const url = new URL(value?.trim() || "");
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}

export function publicEmailImage(value: string | null | undefined): string {
  const href = webDestination(value);
  if (!href) return "";
  const url = new URL(href);
  if (
    url.protocol !== "https:" ||
    /\/(?:object|render\/image)\/sign\//i.test(url.pathname)
  )
    return "";
  const temporary = [...url.searchParams.keys()].some((key) =>
    /^(?:token|sig|signature|expires|x-amz-signature|x-goog-signature|se)$/i.test(
      key,
    ),
  );
  return temporary ? "" : href;
}

export function buildDeliveryEmail(
  email: BuilderState,
  destination: string,
  imageUrl: string,
  offer?: string,
): string {
  const link = webDestination(destination);
  if (email.cta?.trim() && !link)
    throw new Error("Informe um link HTTP ou HTTPS para o botão.");
  const image = publicEmailImage(imageUrl);
  if (imageUrl.trim() && !image)
    throw new Error("Informe uma URL HTTPS permanente para a imagem.");
  const text = (value?: string) =>
    escapeHtml(value?.trim()).replace(/\r?\n/g, "<br>");
  const paragraph = (value?: string) =>
    value?.trim() ? "<p>" + text(value) + "</p>" : "";
  const list = (items?: string[]) =>
    items?.length
      ? "<ul>" +
        items.map((item) => "<li>" + text(item) + "</li>").join("") +
        "</ul>"
      : "";
  const accent = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(email.themeColor ?? "")
    ? email.themeColor
    : "#42337b";
  const contents = [
    paragraph(email.brandName),
    image &&
      '<img src="' +
        escapeHtml(image) +
        '" alt="' +
        text(email.brandName) +
        '" width="560" style="display:block;width:100%;max-width:560px;height:auto">',
    paragraph(email.heroBadge),
    "<h1>" + text(email.subtitle || email.title) + "</h1>",
    ...(email.body || "").split(/\n\s*\n/).map(paragraph),
    paragraph(offer),
    paragraph(email.benefitTitle),
    list(email.keyBenefits),
    list(email.objectionsHandled),
    ...(email.testimonials || []).map(paragraph),
    paragraph(email.urgencyText),
    email.cta &&
      '<p><a href="' +
        escapeHtml(link) +
        '" style="display:inline-block;border-radius:6px;background:' +
        accent +
        ';color:#fff;padding:12px 20px;font-weight:bold;text-decoration:none">' +
        text(email.cta) +
        "</a></p>",
    email.secondaryCta &&
      link &&
      email.secondaryCta !== email.cta &&
      '<p><a href="' +
        escapeHtml(link) +
        '">' +
        text(email.secondaryCta) +
        "</a></p>",
    paragraph(email.footerInfo || email.footerText),
  ]
    .filter(Boolean)
    .join("\n");
  return [
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      text(email.title) +
      "</title></head>",
    '<body style="margin:0;background:#f4f4f5;font:16px/1.5 Arial,sans-serif;color:#20232a">',
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">' +
      text(email.preheader) +
      "</div>",
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">',
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff"><tr><td style="padding:24px">' +
      contents +
      "</td></tr></table>",
    "</td></tr></table></body></html>",
  ].join("\n");
}
