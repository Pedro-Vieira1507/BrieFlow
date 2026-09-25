import JSZip from "jszip";

/** PptxGenJS 4.0.1 declares one master per slide but writes only existing masters. */
export async function normalizePptxPackage(
  input: ArrayBuffer,
): Promise<ArrayBuffer> {
  const archive = await JSZip.loadAsync(input);
  const types = archive.file("[Content_Types].xml");
  if (!types) throw new Error("Arquivo de apresentação inválido.");
  const original = await types.async("string");
  const normalized = original.replace(
    /<Override\b[^>]*\bPartName="([^"]+)"[^>]*\/>/g,
    (entry, part: string) =>
      /^\/ppt\/slideMasters\/slideMaster\d+\.xml$/.test(part) &&
      !archive.file(part.slice(1))
        ? ""
        : entry,
  );
  if (normalized === original) return input;
  archive.file("[Content_Types].xml", normalized);
  return archive.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
