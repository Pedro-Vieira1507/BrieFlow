import { expect, test } from "@playwright/test";
import { installMockBackend } from "./support/mockBackend";

test("briefing → direção → campanha → biblioteca → cópia", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Fluxo completo roda uma vez no desktop.",
  );

  const backend = await installMockBackend(page);
  await page.goto("/");

  const main = page.getByRole("main", { name: "Estúdio criativo BrieFlow" });
  const composer = main.getByLabel("Mensagem para o BrieFlow");
  await expect(composer).toBeVisible();
  await composer.pressSequentially(
    "A marca Atlas vende um painel de gestão operacional para gestores B2B. Quero agendar demonstrações. Use tom claro, direto e confiante. Não invente preços, clientes ou resultados.",
    { delay: 1 },
  );
  const sendButton = composer.locator("xpath=ancestor::form").getByRole("button", {
    name: "Enviar mensagem",
  });
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(
    page.getByRole("heading", { name: "Revise a direção da campanha" }),
  ).toBeVisible();
  await expect(page.getByText("Atlas", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(/decisões começam quando os dados deixam de ser caça/i),
  ).toBeVisible();

  await page.getByRole("button", { name: /Aprovar e gerar campanha/i }).click();

  await expect(page.getByRole("tab", { name: "Banner" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "E-mail" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Social" })).toBeVisible();
  await expect(
    page.getByText("Decidir sem caça ao dado", { exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "E-mail" }).click();
  await expect(
    page.getByText("Quanto tempo sua operação perde procurando contexto?", {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Social" }).click();
  await expect(
    page.getByText("Sua equipe encontra o dado ou caça o dado?", {
      exact: true,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Salvar na biblioteca" }).click();
  await expect(
    page.getByText("Salvo na biblioteca com sucesso!", { exact: true }),
  ).toBeVisible();
  expect(backend.assets).toHaveLength(1);

  await page.getByRole("button", { name: "Abrir menu do perfil" }).click();
  await page.getByRole("menuitem", { name: /Biblioteca/i }).click();
  await expect(page.getByRole("heading", { name: "Biblioteca" })).toBeVisible();

  const librarySearch = page.getByLabel("Buscar campanhas salvas");
  await librarySearch.fill("Atlas");
  await expect(
    page.getByText("Campanha Atlas", { exact: true }).first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "Criar cópia" }).click();
  await expect(
    page.getByText("Cópia carregada no Canvas", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Salvar na biblioteca" }).click();
  await expect.poll(() => backend.assets.length).toBe(2);
});

test("onboarding e assistente funcionam em viewport mobile sem overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Cenário dedicado ao layout mobile.",
  );

  await installMockBackend(page, { dismissOnboarding: false });
  await page.goto("/");

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Comece com um briefing curto e factual",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pular guia" }).click();

  await expect(
    page.getByRole("button", { name: "Abrir assistente BrieFlow" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir assistente BrieFlow" }).click();

  const mobileAssistant = page.getByRole("dialog", {
    name: "Assistente criativo BrieFlow",
  });
  await expect(mobileAssistant).toBeVisible();
  await expect(
    mobileAssistant.getByLabel("Mensagem para o BrieFlow"),
  ).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
