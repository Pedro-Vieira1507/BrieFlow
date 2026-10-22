import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { installMockBackend } from "./support/mockBackend";

test("estúdio não possui violações WCAG sérias ou críticas no estado inicial", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Auditoria completa roda no projeto desktop.",
  );

  await installMockBackend(page);
  await page.goto("/");
  await expect(
    page.getByRole("main", { name: "Estúdio criativo BrieFlow" }),
  ).toBeVisible();

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
