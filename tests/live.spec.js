import { test, expect } from "@playwright/test";
test("real RSS refresh, source filtering and article details", async ({
  page,
}) => {
  test.skip(
    process.env.TEST_LIVE !== "1",
    "Opt-in: requires a running API, MongoDB, Python and internet access.",
  );
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: /Topic activity/ }),
  ).toBeVisible({ timeout: 75000 });
  await page.getByRole("button", { name: "Refresh Data" }).click();
  await expect(page.getByText(/Timeline updated\./)).toBeVisible({
    timeout: 120000,
  });
  await page.getByLabel("Filter by source").selectOption("BBC News");
  await expect(
    page.getByRole("region", { name: /Topic activity/ }),
  ).toBeVisible();
  await page.locator(".timeline-label").first().click();
  await expect(page.locator(".article-list li").first()).toBeVisible();
  await expect(page.locator(".article-list .source-badge").first()).toHaveText(
    "BBC News",
  );
  await expect(page.locator(".article-link").first()).toHaveAttribute(
    "href",
    /^https?:\/\//,
  );
  await page.screenshot({
    path: "docs/screenshots/live-story.png",
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(
    page.getByRole("region", { name: /Topic activity/ }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/screenshots/live-dashboard.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
