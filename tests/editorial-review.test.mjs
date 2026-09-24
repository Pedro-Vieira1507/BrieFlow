import test from "node:test";
import assert from "node:assert/strict";
import { reviewEditorialContent } from "../src/lib/editorialReview.ts";

const brief = {
  brandName: "Aurora",
  product: "Café brasileiro",
  offer: "15% de desconto",
  context: "Pacote de 250 g",
};
const content = {
  type: "banner",
  title: "O Brasil cabe na sua xícara",
  cta: "Conhecer o café",
};
const codes = (value, input = brief) =>
  reviewEditorialContent("banner", value, input).map((issue) => issue.code);
test("accepts a concrete headline without inventing a quality score", () =>
  assert.deepEqual(codes(content), []));
test("flags repeated banner support without penalizing complementary facts", () => {
  assert.ok(
    codes({
      ...content,
      subtitle: "Café brasileiro em grãos, 250 g",
      body: "café brasileiro em grãos, pacote de 250 g",
    }).includes("repeated_supporting_copy"),
  );
  assert.ok(
    !codes({
      ...content,
      subtitle: "Café brasileiro em grãos, 250 g",
      body: "Conheça a origem e escolha seu preparo.",
    }).includes("repeated_supporting_copy"),
  );
});
test("requires quantity evidence with exact value and unit", () => {
  assert.ok(
    codes({ ...content, subtitle: "50% de desconto em 500 g" }).includes(
      "unverified_quantity",
    ),
  );
  assert.ok(
    !codes({ ...content, subtitle: "15% de desconto em 250g" }).includes(
      "unverified_quantity",
    ),
  );
});
test("strategy and tone do not establish numeric evidence", () => {
  assert.ok(
    codes(
      { ...content, subtitle: "50% de desconto" },
      { ...brief, strategy: "50% de desconto", tone: "50% de desconto" },
    ).includes("unverified_quantity"),
  );
});
test("flags generic and placeholder copy and incomplete generation", () => {
  assert.ok(
    codes({ ...content, title: "Eleve sua experiência única" }).includes(
      "generic_copy",
    ),
  );
  assert.ok(
    codes({ ...content, subtitle: "[Inserir preço]" }).includes("placeholder"),
  );
  assert.deepEqual(codes({ ...content, generationError: "failed" }), [
    "generation_failed",
  ]);
});
test("does not confuse roteiro timings with product specifications", () => {
  const issues = reviewEditorialContent(
    "video",
    {
      structuredContent: {
        title: "Café",
        cta: "Conheça",
        sections: [
          { title: "Cena 1", body: "Veja o café", timing: "00:00–00:15" },
        ],
      },
    },
    brief,
  );
  assert.ok(!issues.some((issue) => issue.code === "unverified_quantity"));
});
test("flags duplicate headlines across channels and empty document sections", () => {
  assert.ok(
    reviewEditorialContent("banner", content, brief, [
      { type: "email", content },
    ]).some((issue) => issue.code === "repeated_headline"),
  );
  assert.ok(
    reviewEditorialContent(
      "slides",
      {
        structuredContent: {
          title: "Café",
          sections: [{ title: "Prova", body: "", items: [] }],
        },
      },
      brief,
    ).some((issue) => issue.code === "empty_section"),
  );
});
