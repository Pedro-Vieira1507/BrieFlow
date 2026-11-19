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
  const results = page.getByRole("dialog", { name: "Resultados do piloto" });
  const openResults = () =>
    panel.getByRole("button", { name: "Resultados do piloto" }).click();
  const closeResults = () =>
    results.getByRole("button", { name: "Fechar", exact: true }).click();
  await openResults();
  await expect(results).toContainText("As medições começam");
  await closeResults();
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
  await openResults();
  await expect(results).toContainText("0 de 2 peças exportadas");
  await expect(results).toContainText("Biblioteca e campanha aberta");
  await expect(results).toContainText("3 peças conferidas");
  await closeResults();
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
  await openResults();
  await expect(results).toContainText("0 de 2 peças exportadas");
  await closeResults();
  await panel.getByRole("button", { name: "Aprovar revisão" }).click();
  await expect(panel).toContainText("Textos conferidos com a fonte.");
  await page.getByRole("tab", { name: "WhatsApp", exact: true }).click();
  expect(
    await downloadText(page, () =>
      wa.getByRole("button", { name: "TXT", exact: true }).click(),
    ),
  ).toBe(manual.replace("39,90", "44,90"));
  await downloadText(page, () =>
    wa.getByRole("button", { name: "TXT", exact: true }).click(),
  );
  await openResults();
  await expect(results).toContainText("1 de 2 peças exportadas");
  await expect(results.getByText(/Revisão aprovada ·/)).toHaveCount(2);
  await expect(results).not.toContainText("Até a última exportação");
  await closeResults();
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
  await openResults();
  await expect(results).toContainText("Concluída");
  await expect(results).toContainText("2 de 2 peças exportadas");
  await expect(results).toContainText("Até a última exportação");
  await expect(results).toContainText("Primeiro arquivo HTML");
  await expect(results).toContainText("Primeiro arquivo TXT");
  const baseline = results.getByLabel("Tempo manual das mesmas peças (min)");
  await expect(baseline).toHaveValue("");
  await baseline.fill("12,5");
  await results.getByRole("button", { name: "Salvar tempo manual" }).click();
  await expect(results).toContainText("a menos com o BrieFlow");
  const csv = await downloadText(page, () =>
    results.getByRole("button", { name: "Baixar medições (CSV)" }).click(),
  );
  expect(csv.split("\r\n")).toHaveLength(3);
  expect(csv).toContain('"Demonstração"');
  expect(csv).toContain('"750"');
  const rows = csv
    .trim()
    .split("\r\n")
    .slice(1)
    .map((row) => row.slice(1, -1).split('";"'));
  expect(rows.map((r) => r[20]).sort()).toEqual(["HTML", "TXT"]);
  expect(
    rows.every(
      (r) =>
        Number(r[22]) ===
        Math.round((Date.parse(r[21]) - Date.parse(r[10])) / 1000),
    ),
  ).toBe(true);
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
test("the pilot includes other saved campaigns and identifies incomplete library reads", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "As duas campanhas e a leitura parcial são verificadas no desktop.",
  );
  const backend = await installMockBackend(page);
  await openDemo(page);
  await page.getByRole("button", { name: "Salvar na biblioteca" }).click();
  await expect.poll(() => backend.assets.length).toBe(1);
  const original = backend.assets[0];
  const copy = structuredClone(original);
  copy.id = "00000000-0000-4000-8000-000000000002";
  copy.name = "Campanha de inverno";
  const copyState = copy.content as { skuLink: { campaignId: string } };
  copyState.skuLink.campaignId = "campanha-de-inverno";
  backend.assets.push(copy);
  const edit = async (field: string, value: string) => {
    await page.getByRole("button", { name: "Editar cadastro" }).click();
    const catalog = page.getByRole("dialog", { name: "Catálogo de produtos" });
    await catalog.getByLabel(field).fill(value);
    await catalog.getByRole("button", { name: "Salvar cadastro" }).click();
    await expect(catalog).toBeHidden();
  };
  const open = () =>
    page.getByRole("button", { name: "Resultados do piloto" }).click();
  const results = page.getByRole("dialog", { name: "Resultados do piloto" });
  const close = () =>
    results.getByRole("button", { name: "Fechar", exact: true }).click();
  await edit("Preço em reais", "44,90");
  await edit("Fonte do cadastro", "Revisão da fonte do empório");
  await open();
  await expect(results.getByRole("option")).toHaveCount(1);
  await expect(results).toContainText("6 peças conferidas");
  await expect(results).toContainText("0 de 4 peças exportadas");
  await expect(
    results.getByRole("listitem").filter({ hasText: "Campanha de inverno" }),
  ).toHaveCount(2);
  await close();
  await page.route("**/rest/v1/assets?**", (route) =>
    new URL(route.request().url()).searchParams.has("content->skuLink")
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"message":"unavailable"}',
        })
      : route.fallback(),
  );
  await edit("Preço em reais", "47,90");
  await open();
  await expect(results).toContainText("Amostra parcial");
  await expect(results).toContainText("0 de 2 peças exportadas");
  await expect(results.getByRole("option")).toHaveCount(2);
  await results.getByRole("combobox").selectOption({ index: 1 });
  await expect(results).toContainText("Uma nova mudança substituiu esta");
  await expect(results).not.toContainText("Até a última exportação");
});
test("a merchant opens the exact pending piece in the original campaign, preserves a draft and receives the download in the first tab", async ({
  page,
  context,
  isMobile,
}) => {
  const backend = await installMockBackend(page, { includeNewTabs: true });
  await openDemo(page);
  await page.getByRole("button", { name: "Salvar na biblioteca" }).click();
  await expect.poll(() => backend.assets.length).toBe(1);
  const original = backend.assets[0];
  const other = structuredClone(original);
  other.id = "00000000-0000-4000-8000-000000000074";
  other.name = "Campanha de inverno";
  const otherState = other.content as {
    skuLink: { campaignId?: string };
    campaignAssets: { type: string; content: { body?: string } }[];
  };
  // This saved original predates campaign identities. Both campaigns use identical piece IDs.
  delete otherState.skuLink.campaignId;
  const email = otherState.campaignAssets.find(
    (a) => a.type === "email",
  )!.content;
  email.body = "Lote de inverno por R$ 39,90. Reserve sua unidade.";
  backend.assets.push(other);
  const manualText = "Texto exclusivo do rascunho. Café por R$ 39,90.";
  await page.getByRole("tab", { name: "WhatsApp", exact: true }).click();
  await page
    .getByLabel("Conteúdo da seção 1", { exact: true })
    .fill(manualText);
  await page.getByRole("button", { name: "Editar cadastro" }).click();
  const catalog = page.getByRole("dialog", { name: "Catálogo de produtos" });
  await catalog.getByLabel("Preço em reais").fill("48,90");
  await catalog.getByRole("button", { name: "Salvar cadastro" }).click();
  await page.getByRole("button", { name: "Resultados do piloto" }).click();
  const panel = page.getByRole("dialog", { name: "Resultados do piloto" });
  const winter = panel
    .getByRole("listitem")
    .filter({ hasText: "E-mail · Campanha de inverno" });
  const link = winter.getByRole("link", { name: "Abrir E-mail em nova aba" });
  const fragment = await link.getAttribute("href");
  expect(fragment).toMatch(/^#revisar-peca=/);
  expect(fragment).not.toContain("DEMO-CAFE");
  const [detail] = await Promise.all([
    context.waitForEvent("page"),
    link.click(),
  ]);
  await expect(
    detail.getByRole("heading", { name: "E-mail · Campanha de inverno" }),
  ).toBeVisible();
  await expect(
    detail.getByRole("tab", { name: "E-mail", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(detail.getByRole("tab", { name: "WhatsApp" })).toHaveCount(0);
  const competing = isMobile ? undefined : await context.newPage();
  if (competing) {
    await competing.goto("/" + fragment);
    await expect(
      competing.getByRole("heading", { name: "E-mail · Campanha de inverno" }),
    ).toBeVisible();
  }
  await detail
    .getByRole("button", { name: "Aprovar revisão da campanha" })
    .click();
  await detail.getByRole("button", { name: "Salvar na biblioteca" }).click();
  await expect
    .poll(() =>
      JSON.stringify(backend.assets.find((a) => a.id === other.id)?.content),
    )
    .toContain("Lote de inverno por R$ 48,90");
  expect(
    JSON.stringify(backend.assets.find((a) => a.id === original.id)?.content),
  ).toContain("39,90");
  if (competing) {
    await competing
      .getByRole("button", { name: "Aprovar revisão da campanha" })
      .click();
    await competing
      .getByRole("button", { name: "Salvar na biblioteca" })
      .click();
    await expect(
      competing.getByText(/A versão salva mudou ou foi removida/),
    ).toBeVisible();
    await expect(
      competing.getByText("Não salvo", { exact: true }),
    ).toBeVisible();
    await competing.close();
  }
  await detail.getByRole("button", { name: "Exportar campanha" }).click();
  const exporter = detail.getByRole("dialog", {
    name: "Central de exportação",
  });
  await exporter
    .getByLabel("Link de destino do botão")
    .fill("https://example.org/inverno");
  const html = await downloadText(detail, () =>
    exporter.getByRole("button", { name: "Baixar HTML para envio" }).click(),
  );
  expect(html).toContain("Lote de inverno por R$ 48,90");
  await expect(panel).toContainText("1 de 4 peças exportadas");
  await expect(winter).toContainText("Primeiro arquivo HTML");
  await expect(winter.getByRole("link")).toHaveCount(0);
  await panel
    .getByRole("button", { name: "Abrir WhatsApp", exact: true })
    .click();
  await expect(
    page.getByLabel("Conteúdo da seção 1", { exact: true }),
  ).toHaveValue(manualText);
  await expect(
    page.getByRole("button", { name: "Ver campanha inteira" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Aprovar revisão da campanha" })
    .click();
  const txt = await downloadText(page, () =>
    page
      .getByRole("tabpanel", { name: "WhatsApp" })
      .getByRole("button", { name: "TXT", exact: true })
      .click(),
  );
  expect(txt).toBe(manualText.replace("39,90", "48,90"));
  await page.getByRole("button", { name: "Voltar às pendências" }).click();
  await expect(panel).toContainText("2 de 4 peças exportadas");
  await expect(
    panel.getByRole("link", { name: "Abrir WhatsApp em nova aba" }),
  ).toHaveCount(1);
  const [winterWhatsApp] = await Promise.all([
    context.waitForEvent("page"),
    panel.getByRole("link", { name: "Abrir WhatsApp em nova aba" }).click(),
  ]);
  await expect(
    winterWhatsApp.getByRole("heading", {
      name: "WhatsApp · Campanha de inverno",
    }),
  ).toBeVisible();
  const winterTxt = await downloadText(winterWhatsApp, () =>
    winterWhatsApp
      .getByRole("tabpanel", { name: "WhatsApp" })
      .getByRole("button", { name: "TXT", exact: true })
      .click(),
  );
  expect(winterTxt).toContain("R$ 48,90");
  expect(winterTxt).not.toContain("Texto exclusivo do rascunho");
  await expect(panel).toContainText("3 de 4 peças exportadas");
  await panel
    .getByRole("button", { name: "Abrir E-mail", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "E-mail", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Exportar campanha" }).click();
  const originalExporter = page.getByRole("dialog", {
    name: "Central de exportação",
  });
  await originalExporter
    .getByLabel("Link de destino do botão")
    .fill("https://example.org/cafe");
  const originalHtml = await downloadText(page, () =>
    originalExporter
      .getByRole("button", { name: "Baixar HTML para envio" })
      .click(),
  );
  expect(originalHtml).toContain("R$ 48,90");
  expect(originalHtml).not.toContain("Lote de inverno");
  await originalExporter
    .getByRole("button", { name: "Fechar", exact: true })
    .click();
  await page.getByRole("button", { name: "Voltar às pendências" }).click();
  await expect(panel).toContainText("4 de 4 peças exportadas");
  await expect(panel).toContainText("Concluída");
  await expect(panel.getByRole("link")).toHaveCount(0);
  await winterWhatsApp.close();
  // An old link cannot re-open a completed task or advance its receipt again.
  const stale = await context.newPage();
  await stale.goto("/" + fragment);
  await expect(stale.getByRole("alert")).toContainText(
    "Esta peça já foi exportada",
  );
  await expect(
    stale.getByRole("button", { name: "Ver campanha inteira" }),
  ).toHaveCount(0);
  await stale.close();
  await detail.close();
});
