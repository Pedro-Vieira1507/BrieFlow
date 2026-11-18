import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { installMockBackend } from "./support/mockBackend";

test("an immediate generation request waits for approval and delivers the four requested files", async ({
  page,
  isMobile,
}) => {
  const backend = await installMockBackend(page, {
    discoveryAction: "generate_all",
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
    .fill(
      "Gere um artigo para blog, Reel, roteiro de vídeo e podcast para o painel Atlas.",
    );
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(
    page
      .getByText(/Revise os dados e os formatos no canvas/)
      .filter({ visible: true }),
  ).toBeVisible();
  if (isMobile)
    await page.getByRole("button", { name: "Close", exact: true }).click();
  const formats = page.getByRole("group", { name: "Formatos da campanha" });
  await expect(formats.getByRole("checkbox", { checked: true })).toHaveCount(4);
  await expect(formats).toContainText("32 créditos");
  expect(backend.actions).toEqual(["discovery"]);
  await page
    .getByLabel("Fatos confirmados por você", { exact: false })
    .fill("Pacote de 250 g.");
  await page.getByRole("button", { name: "Aprovar e gerar campanha" }).click();
  await expect(
    page.getByRole("tab", { name: "Blog", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvar na biblioteca" }),
  ).toBeEnabled();
  expect(backend.actions.filter((a) => a !== "discovery").sort()).toEqual([
    "blog",
    "podcast",
    "reel",
    "video",
  ]);
  for (const name of ["Reel", "Vídeo", "Podcast", "Blog"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    const panel = page.getByRole("tabpanel", { name });
    const download = page.waitForEvent("download");
    await panel.getByRole("button", { name: "TXT", exact: true }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.txt$/);
    expect(await readFile((await file.path())!, "utf8")).toContain(
      "Conheça o painel Atlas.",
    );
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});

test("visual exports read an existing signed image and the delivery email keeps the chosen link", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Verifica o tamanho do banner desktop e a dimensão fixa do social.",
  );
  const signed = "https://images.example.test/art.svg?token=fixture";
  await installMockBackend(page, { imageUrl: signed });
  await page.route("https://images.example.test/**", (route) => {
    if (route.request().url() !== signed)
      return route.fulfill({ status: 403, body: "Link inválido" });
    return route.fulfill({
      contentType: "image/svg+xml",
      headers: { "access-control-allow-origin": "*" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#94135d"/></svg>',
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Abrir menu do perfil" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Mensagem para o BrieFlow" })
    .fill("Quero criar uma campanha Atlas, com banner, e-mail e post social.");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await page.getByRole("button", { name: "Aprovar e gerar campanha" }).click();
  await expect(
    page.getByRole("tab", { name: "Social", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exportar campanha" }),
  ).toBeEnabled();
  await page.getByRole("tab", { name: "Banner", exact: true }).click();
  await page.getByRole("button", { name: "Exportar campanha" }).click();
  const dialog = page.getByRole("dialog", { name: "Central de exportação" });
  for (const [name, width] of [
    ["Banner", 2400],
    ["Social", 1080],
  ] as const) {
    await dialog.getByRole("tab", { name, exact: true }).click();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: /PNG/ }).click();
    const file = await readFile((await (await download).path())!);
    expect(file.toString("hex", 0, 8)).toBe("89504e470d0a1a0a");
    expect(file.readUInt32BE(16)).toBe(width);
  }
  await dialog.getByRole("tab", { name: "E-mail", exact: true }).click();
  await dialog
    .getByLabel("Link de destino do botão")
    .fill("https://example.org/atlas");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Baixar HTML para envio" }).click();
  const html = await readFile((await (await download).path())!, "utf8");
  expect(html).toContain('href="https://example.org/atlas"');
  expect(html).not.toContain("token=fixture");
});

test("product photo and a product link reach the brief from the chat", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Fluxo de referência validado no desktop.");
  await installMockBackend(page);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const origin = "https://test.supabase.co";
  const product = "https://catalogo.example/produtos/atlas";
  const object = "/object/sign/campaign-assets/test/produto.png?token=fixture";
  await page.route(origin + "/storage/v1/object/**", async (route) => {
    const req = route.request();
    if (req.method() === "GET")
      return route.fulfill({
        contentType: "image/png",
        body: png,
        headers: { "access-control-allow-origin": "*" },
      });
    await route.fulfill({
      json: req.url().includes("/sign/")
        ? { signedURL: object }
        : { Key: "campaign-assets/test/produto.png" },
    });
  });
  await page.route(origin + "/functions/v1/scrape-proxy", async (route) => {
    expect(route.request().postDataJSON().url).toBe(product);
    await route.fulfill({
      json: {
        url: product,
        rawTitle: "Atlas 250",
        brandName: "Atlas",
        description: "Referência do catálogo de demonstração",
        headings: [],
        colors: [],
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Abrir menu do perfil" }),
  ).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Anexar foto do produto" }).click();
  await (
    await chooser
  ).setFiles({ name: "produto.png", mimeType: "image/png", buffer: png });
  const photo = page.getByRole("img", { name: "Produto anexado" });
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", /produto\.png/);
  const discovery = page.waitForRequest(
    (req) => req.url().endsWith("/ai-proxy") && req.method() === "POST",
  );
  await page
    .getByRole("textbox", { name: "Mensagem para o BrieFlow" })
    .fill("Prepare o briefing com a foto e o link " + product);
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  const payload = (await discovery).postData() || "";
  expect(payload).toContain("Referência do catálogo de demonstração");
  expect(payload).toContain("A FOTO REAL JÁ FOI RECEBIDA");
  expect(payload).not.toContain("token=fixture");
  await expect(
    page.getByRole("heading", { name: "Revise a direção da campanha" }),
  ).toBeVisible();
});
