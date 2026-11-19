import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { installMockBackend } from "./support/mockBackend";

async function openLibrary(page: Page) {
  await page.getByRole("button", { name: "Abrir menu do perfil" }).click();
  await page.getByRole("menuitem", { name: /Biblioteca/i }).click();
  return page.getByRole("dialog", { name: "Biblioteca", exact: true });
}
async function openDemo(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Abrir menu do perfil" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Testar com o café de exemplo" })
    .click();
  await expect(page.getByText("Textos conferidos com a fonte.")).toBeVisible();
}
async function downloadText(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent("download");
  await click();
  return readFile((await (await download).path())!, "utf8");
}

test("catalog price review blocks obsolete files, preserves manual copy and survives a save and reopen", async ({
  page,
  isMobile,
}) => {
  const backend = await installMockBackend(page);
  await openDemo(page);
  const panel = page.getByRole("region", { name: "Produto da campanha" });
  await page.getByRole("tab", { name: "WhatsApp", exact: true }).click();
  const manual =
    "Reserve pelo WhatsApp. Café da Serra por R$ 39,90. Eu separei o seu!";
  await page.getByLabel("Conteúdo da seção 1", { exact: true }).fill(manual);
  await page.getByRole("button", { name: "Salvar na biblioteca" }).click();
  await expect.poll(() => backend.assets.length).toBe(1);
  await panel.getByRole("button", { name: "Editar cadastro" }).click();
  const catalog = page.getByRole("dialog", { name: "Catálogo de produtos" });
  await expect(
    catalog.getByLabel("Produto do catálogo").locator("option"),
  ).toHaveCount(11);
  await catalog.getByLabel("Preço em reais").fill("44,90");
  await catalog.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(
    panel.getByRole("heading", { name: "Revisar 2 menções" }),
  ).toBeVisible();
  await expect(panel).toContainText("Peças afetadas");
  await expect(panel.locator("li")).toHaveCount(2);
  const files: string[] = [];
  page.on("download", (file) => files.push(file.suggestedFilename()));
  await page.getByRole("button", { name: "Exportar campanha" }).click();
  await expect(
    page.getByText(/Há valores pendentes para DEMO-CAFE/).last(),
  ).toBeVisible();
  const wa = page.getByRole("tabpanel", { name: "WhatsApp" });
  await wa.getByRole("button", { name: "TXT", exact: true }).click();
  if (!isMobile)
    await wa.getByRole("button", { name: "JSON", exact: true }).click();
  await wa.getByRole("button", { name: "Copiar", exact: true }).click();
  expect(files).toEqual([]);
  // The same outdated saved campaign can also be accessed directly from the library.
  if (!isMobile) {
    const library = await openLibrary(page);
    await library.getByLabel("Buscar campanhas salvas").fill("DEMO-CAFE");
    await library.getByLabel("Só campanhas com revisão de SKU").check();
    await expect(
      library.getByText("DEMO-CAFE · 2 peças para revisar"),
    ).toBeVisible();
    await library.getByRole("tab", { name: "WhatsApp", exact: true }).click();
    await library.getByRole("button", { name: "TXT", exact: true }).click();
    await expect(
      page.getByText(/Há valores pendentes para DEMO-CAFE/).last(),
    ).toBeVisible();
    await library.getByRole("button", { name: "Continuar original" }).click();
    await expect(
      panel.getByRole("heading", { name: "Revisar 2 menções" }),
    ).toBeVisible();
  }
  await page.getByRole("tab", { name: "Banner", exact: true }).click();
  await page.getByRole("button", { name: "Exportar campanha" }).click();
  const exporter = page.getByRole("dialog", { name: "Central de exportação" });
  await expect(exporter).toBeVisible();
  await exporter.getByRole("tab", { name: "E-mail", exact: true }).click();
  await exporter
    .getByLabel("Link de destino do botão")
    .fill("https://example.org/cafe");
  await exporter
    .getByRole("button", { name: "Baixar HTML para envio" })
    .click();
  await expect(
    page.getByText(/Há valores pendentes para DEMO-CAFE/).last(),
  ).toBeVisible();
  await exporter.getByRole("button", { name: "Fechar", exact: true }).click();
  expect(files).toEqual([]);
  await panel.getByRole("button", { name: "Aprovar revisão" }).click();
  await expect(panel).toContainText("Textos conferidos com a fonte.");
  await page.getByRole("tab", { name: "WhatsApp", exact: true }).click();
  expect(
    await downloadText(page, () =>
      wa.getByRole("button", { name: "TXT", exact: true }).click(),
    ),
  ).toBe(manual.replace("39,90", "44,90"));
  await page.getByRole("tab", { name: "E-mail", exact: true }).click();
  await page.getByRole("button", { name: "Exportar campanha" }).click();
  await exporter
    .getByLabel("Link de destino do botão")
    .fill("https://example.org/cafe");
  const html = await downloadText(page, () =>
    exporter.getByRole("button", { name: "Baixar HTML para envio" }).click(),
  );
  expect(html).toContain("R$ 44,90");
  expect(html).not.toContain("39,90");
  await exporter.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Salvar na biblioteca" }).click();
  await expect
    .poll(() => JSON.stringify(backend.assets[0]?.content))
    .toContain(manual.replace("39,90", "44,90"));
  await page.reload();
  const library = await openLibrary(page);
  await library.getByRole("button", { name: "Continuar original" }).click();
  await expect(panel).toContainText("Textos conferidos com a fonte.");
  expect(backend.actions).toEqual([]);
});

test("catalog imports are reviewed, isolated by SKU and reject a stale update from another tab", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(isMobile, "Concorrência de abas verificada no desktop.");
  await installMockBackend(page);
  await openDemo(page);
  await page.getByRole("button", { name: "Editar cadastro" }).click();
  const first = page.getByRole("dialog", { name: "Catálogo de produtos" });
  await first.getByLabel("Preço em reais").fill("40,00");
  const other = await context.newPage();
  await installMockBackend(other);
  await openDemo(other);
  await other.getByRole("button", { name: "Editar cadastro" }).click();
  const editor = other.getByRole("dialog", { name: "Catálogo de produtos" });
  const csv =
    "sku;nome;preco;unidade;fonte\nDEMO-CAFE;Café da Serra;44,90;250 g;Tabela teste\nDEMO-CHA;Chá da Horta;24,50;60 g;Tabela teste";
  await editor.getByLabel("Arquivo CSV do catálogo").setInputFiles({
    name: "catalogo.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await expect(
    editor.getByRole("heading", { name: "Conferir importação" }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Confirmar importação (2)" })
    .click();
  await expect(
    other.getByText("Importação concluída.", { exact: true }),
  ).toBeVisible();
  await first.getByRole("button", { name: "Salvar cadastro" }).click();
  await expect(first.getByRole("alert")).toContainText("mudou");
  await first.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Revisar 2 menções" }),
  ).toBeVisible();
  await editor.getByLabel("Produto do catálogo").selectOption("DEMO-CHA");
  await expect(editor.getByLabel("Unidade ou embalagem")).toHaveValue("60 g");
  await other.close();
});
test("a shop product can be created from its briefing and its current catalog facts reach generation", async ({
  page,
  isMobile,
}) => {
  const backend = await installMockBackend(page);
  const ai: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().endsWith("/functions/v1/ai-proxy") &&
      request.postDataJSON()?.action === "email"
    )
      ai.push(request.postData() ?? "");
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Abrir menu do perfil" }),
  ).toBeVisible();
  if (isMobile)
    await page
      .getByRole("button", { name: "Abrir assistente BrieFlow" })
      .click();
  await page
    .getByRole("textbox", { name: "Mensagem para o BrieFlow" })
    .fill("Crie uma campanha de e-mail para o meu produto.");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  if (isMobile)
    await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Vincular produto", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Catálogo de produtos" });
  await editor.getByLabel("SKU", { exact: true }).fill("TESTE-01");
  await editor.getByLabel("Nome do produto").fill("Moedor manual");
  await editor.getByLabel("Preço em reais").fill("128,90");
  await editor.getByLabel("Unidade ou embalagem").fill("1 unidade");
  await editor.getByLabel("Fonte do cadastro").fill("Tabela do empório");
  await editor.getByRole("button", { name: "Salvar cadastro" }).click();
  await editor.getByRole("button", { name: "Vincular à campanha" }).click();
  await page.getByRole("button", { name: "Aprovar e gerar campanha" }).click();
  await expect(
    page.getByRole("tab", { name: "E-mail", exact: true }),
  ).toBeEnabled();
  await expect.poll(() => ai.length).toBe(1);
  expect(ai[0]).toContain("TESTE-01");
  expect(ai[0]).toContain("R$ 128,90");
  expect(ai[0]).toContain("1 unidade");
  await expect(
    page.getByRole("region", { name: "Produto da campanha" }),
  ).toContainText("Moedor manual");
  expect(backend.actions).toContain("email");
});
