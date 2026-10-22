import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("produção real permanece utilizável e sem violações WCAG bloqueadoras", async ({
  page,
}) => {
  test.skip(
    !process.env.E2E_BASE_URL,
    "Requer o deployment real em E2E_BASE_URL.",
  );

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(
    page.getByRole("main", { name: "Estúdio criativo BrieFlow" }),
  ).toBeVisible();

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(horizontalOverflow).toBe(false);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? ""),
  );

  expect(
    blocking,
    blocking
      .map(
        (violation) =>
          `${violation.id}: ${violation.help} (${violation.nodes.length} ocorrências)`,
      )
      .join("\n"),
  ).toEqual([]);
});

test("produção real preserva alvos de toque e composer legível no mobile", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.E2E_BASE_URL || testInfo.project.name !== "mobile-chromium",
    "Cenário dedicado ao deployment real em viewport mobile.",
  );

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const assistant = page.getByRole("button", {
    name: "Abrir assistente BrieFlow",
  });
  await expect(assistant).toBeVisible();

  const box = await assistant.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);

  await assistant.click();
  const composer = page.getByLabel("Mensagem para o BrieFlow");
  await expect(composer).toBeVisible();

  const fontSize = await composer.evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
  expect(fontSize).toBeGreaterThanOrEqual(16);
});
