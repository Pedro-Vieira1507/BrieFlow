import { expect, test } from "@playwright/test";

test("produção publica metadados e shell principal", async ({
  page,
}, testInfo) => {
  test.skip(
    !process.env.E2E_BASE_URL || testInfo.project.name !== "chromium",
    "Smoke de produção roda somente quando E2E_BASE_URL é informado.",
  );

  await page.goto("/");

  await expect(page).toHaveTitle(/BrieFlow.*Estúdio criativo/i);
  await expect(
    page.getByRole("main", { name: "Estúdio criativo BrieFlow" }),
  ).toBeVisible();

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute(
    "href",
    "https://brieflow-ai.vercel.app",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://brieflow-ai.vercel.app/app-preview.jpg",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /index,follow/,
  );
  await expect(
    page.locator('script[type="application/ld+json"]'),
  ).toContainText("SoftwareApplication");
});
