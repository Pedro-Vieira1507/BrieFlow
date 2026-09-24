import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import { normalizePptxPackage } from "../src/lib/pptxPackage.ts";

test("exported PPTX declares existing masters and preserves slide contents", async () => {
  const deck = new PptxGenJS();
  deck.addSlide().addText("Café Aurora", { x: 1, y: 1, w: 5, h: 1 });
  deck.addSlide().addText("Pacote de 250 g", { x: 1, y: 1, w: 5, h: 1 });
  const original = await deck.write({ outputType: "arraybuffer" });
  const input = await JSZip.loadAsync(original);
  const output = await JSZip.loadAsync(await normalizePptxPackage(original));
  const types = await output.file("[Content_Types].xml").async("string");
  for (const match of types.matchAll(/PartName="([^"]+)"/g)) {
    assert.ok(
      output.file(match[1].slice(1)),
      `Missing declared part ${match[1]}`,
    );
  }
  for (const [path, file] of Object.entries(input.files)) {
    if (file.dir || path === "[Content_Types].xml") continue;
    assert.deepEqual(
      await output.file(path).async("uint8array"),
      await file.async("uint8array"),
    );
  }
});

test("a valid PPTX package is returned unchanged", async () => {
  const deck = new PptxGenJS();
  deck.addSlide().addText("Café", { x: 1, y: 1, w: 5, h: 1 });
  const valid = await normalizePptxPackage(
    await deck.write({ outputType: "arraybuffer" }),
  );
  assert.equal(await normalizePptxPackage(valid), valid);
});
