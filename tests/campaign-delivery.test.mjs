import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import JSZip from "jszip";

import {
  requestedMaterials,
  selectedMaterials,
} from "../src/lib/campaignGeneration.ts";
import { buildDeliveryEmail } from "../src/lib/emailDelivery.ts";
import { reviewEditorialContent } from "../src/lib/editorialReview.ts";
import { formatStructuredContentText } from "../src/lib/structuredContent.ts";
import {
  buildSlideDeck,
  buildTechnicalSheet,
} from "../src/lib/structuredDocumentExport.ts";

const section = {
  id: "1",
  title: "Produto",
  body: "Pacote de 250 g.",
  visualDirection: "Luz lateral",
  speakerNotes: "Pausa curta",
  timing: "15 s",
};

test("the review suggests explicit formats and keeps an intentionally empty selection", () => {
  assert.deepEqual(
    new Set(
      requestedMaterials(
        "Gere um artigo para blog, roteiro de Reel, vídeo e podcast. Não quero banner.",
      ),
    ),
    new Set(["blog", "reel", "video", "podcast"]),
  );
  assert.deepEqual(
    requestedMaterials("Gere apenas um blog, sem vídeo ou slides."),
    ["blog"],
  );
  assert.deepEqual(selectedMaterials(["reel", "old", "reel", "blog"]), [
    "reel",
    "blog",
  ]);
  assert.deepEqual(selectedMaterials([]), []);
  assert.deepEqual(selectedMaterials(undefined), ["banner", "email", "social"]);
});

test("review matches a confirmed price before punctuation and flags an unsupported product claim", () => {
  const brief = {
    brandName: "Aurora",
    confirmedFacts: "Café moído, 250 g. Preço de R$ 39,90.",
  };
  const content = {
    type: "banner",
    title: "Café moído",
    cta: "Conheça o café",
    body: "Pacote de 250g por R$39,90, com grãos selecionados.",
  };
  const codes = reviewEditorialContent("banner", content, brief).map(
    (i) => i.code,
  );
  assert.ok(codes.includes("unsupported_claim"));
  assert.ok(!codes.includes("unverified_quantity"));
  assert.ok(
    reviewEditorialContent(
      "banner",
      { ...content, body: "Pacote por R$ 49,90." },
      brief,
    ).some((i) => i.code === "unverified_quantity"),
  );
});

test("WhatsApp exports the customer message and one action, without production notes", () => {
  const document = {
    format: "whatsapp",
    title: "Plano da peça",
    summary: "Enviar à tarde",
    sections: [
      { ...section, title: "Mensagem", body: "Conheça o café!" },
      { ...section, title: "Instruções de envio", body: "Enviar à tarde." },
    ],
    cta: "Conheça o café",
  };
  assert.equal(formatStructuredContentText(document), "Conheça o café!");
  assert.equal(
    formatStructuredContentText({ ...document, sections: [section] }),
    "Pacote de 250 g.\n\nConheça o café",
  );
});

test("delivery HTML contains a real link, escaped copy and only a permanent image chosen for sending", () => {
  const asset = {
    type: "email",
    title: "Café & pão",
    subtitle: "Oferta <especial>",
    cta: "Conheça o café",
    body: "Pacote de 250 g",
    backgroundImageUrl: "https://example.org/object/sign/photo?token=short",
  };
  const html = buildDeliveryEmail(
    asset,
    "https://example.org/produto?a=1&b=2",
    "https://example.org/foto.jpg",
  );
  assert.match(html, /href="https:\/\/example.org\/produto\?a=1&amp;b=2"/);
  assert.match(html, /Oferta &lt;especial&gt;/);
  assert.match(html, /src="https:\/\/example.org\/foto.jpg"/);
  assert.doesNotMatch(html, /token=|<button|contenteditable/);
  assert.ok(Buffer.byteLength(html) < 4096);
  assert.throws(() => buildDeliveryEmail(asset, "", ""), /link/);
  assert.throws(
    () =>
      buildDeliveryEmail(
        asset,
        "https://example.org",
        asset.backgroundImageUrl,
      ),
    /permanente/,
  );
});

test("each approved section yields one slide and production cues appear only in speaker notes", async () => {
  const sections = Array.from({ length: 8 }, (_, index) => ({
    ...section,
    title: "Etapa " + (index + 1),
  }));
  const archive = await JSZip.loadAsync(
    await buildSlideDeck(
      { format: "slides", title: "Aurora", sections, cta: "Conheça o café" },
      "Aurora",
    ),
  );
  assert.equal(archive.file(/^ppt\/slides\/slide\d+\.xml$/).length, 8);
  const first = await archive.file("ppt/slides/slide1.xml").async("text");
  assert.match(first, /Etapa 1/);
  assert.doesNotMatch(first, /Luz lateral|Pausa curta/);
  assert.match(
    await archive.file("ppt/notesSlides/notesSlide1.xml").async("text"),
    /Luz lateral/,
  );
  assert.match(
    await archive.file("ppt/slides/slide8.xml").async("text"),
    /Conheça o café/,
  );
});

test("technical PDF contains product specifications and omits the staging instructions", async () => {
  const pdf = await buildTechnicalSheet({
    format: "technical_sheet",
    title: "Ficha Aurora",
    sections: [section],
  });
  const bytes = Buffer.from(await pdf.arrayBuffer()).toString("latin1");
  assert.match(bytes, /^%PDF/);
  const pages = [...bytes.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
    .map((match) =>
      inflateSync(Buffer.from(match[1], "latin1")).toString("latin1"),
    )
    .join("\n");
  assert.match(pages, /Pacote de 250 g/);
  assert.doesNotMatch(pages, /Luz lateral|Pausa curta/);
});
