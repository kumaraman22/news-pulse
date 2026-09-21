import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("sample timeline, detail drawer, source filter, search and mobile layout", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await expect(
    page.getByRole("region", { name: /Topic activity timeline/ }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await expect(
    page.getByRole("button", { name: "Refresh Data" }),
  ).toBeDisabled();
  await page.locator(".timeline-bar").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".article-list li")).toHaveCount(12);
  const drawerAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    drawerAccessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Filter by source").selectOption("BBC News");
  await page.locator(".timeline-bar").first().click();
  await expect(page.locator(".article-list li")).toHaveCount(4);
  await page.getByRole("button", { name: "Close story explorer" }).click();
  await page.getByLabel("Search topics").fill("nothing-matches-this");
  await expect(page.getByText("No stories match these filters")).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(
      page.getByRole("region", { name: /Topic activity/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `docs/screenshots/dashboard-${width}.png`,
      fullPage: true,
    });
  }
});
test("live error is recoverable and date validation is visible", async ({
  page,
}) => {
  await page.route("**/api/timeline?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "Temporarily unavailable" } }),
    }),
  );
  await page.goto("/");
  await expect(page.getByText("Temporarily unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.getByLabel("Start date").fill("2026-09-22");
  await page.getByLabel("End date").fill("2026-09-20");
  await expect(page.getByText("Check your date range")).toBeVisible();
});
