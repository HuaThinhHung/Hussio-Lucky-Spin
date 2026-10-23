import { expect, test } from "@playwright/test";

test.describe("public page", () => {
  test("has every required section and no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("BLACKFRIDAY.");
    await expect(page.getByRole("heading", { name: "NHẬP MÃ MAY MẮN" })).toBeVisible();
    await expect(page.locator("input[type=tel]")).toHaveCount(0);
    await expect(page.getByRole("img", { name: /Vòng quay HUSSIO/ })).toBeVisible();

    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    await page.screenshot({ path: `test-results/home-${innerWidth}.png`, fullPage: true });
  });

  test("wheel fits the screen", async ({ page }) => {
    await page.goto("/");
    const wheel = page.getByRole("img", { name: /Vòng quay HUSSIO/ });
    const box = await wheel.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport).toBeTruthy();
    if (box && viewport) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
  });

  test("invalid code shows a friendly error", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("MÃ QUAY").fill("HUSSIO-BF26-ZZZZZZ");
    await page.getByRole("button", { name: "KIỂM TRA LƯỢT QUAY" }).click();
    await expect(page.locator("#code-error")).toContainText(/không hợp lệ|chưa bắt đầu|quá nhanh/);
  });

  test("winner API never exposes PII fields", async ({ request }) => {
    const response = await request.get("/api/winners");
    expect((await request.get("/api/manage/codes")).status()).toBe(401);
    expect((await request.post("/api/manage/codes", { data: { action: "batch" } })).status()).toBe(401);
    expect(response.ok()).toBeTruthy();
    const { winners } = (await response.json()) as { winners: Record<string, unknown>[] };
    for (const winner of winners) {
      expect(Object.keys(winner).sort()).toEqual(["city", "createdAt", "displayName", "id", "prizeName", "prizeType"]);
    }
  });

  test("admin requires login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
