import { expect, test } from "@playwright/test";

test.describe("public page", () => {
  test("has every required section and no horizontal overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("BLACKFRIDAY.");
    await expect(page.getByRole("heading", { name: "XÁC MINH ĐƠN HÀNG" })).toBeVisible();
    await expect(page.getByLabel("SĐT HOẶC EMAIL ĐẶT HÀNG")).toBeVisible();
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

  test("order check shows a friendly message", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("MÃ ĐƠN HÀNG").fill("#999999");
    await page.getByLabel("SĐT HOẶC EMAIL ĐẶT HÀNG").fill("0901234567");
    await page.getByRole("button", { name: "KIỂM TRA LƯỢT QUAY" }).click();
    // Without NEXT_PUBLIC_SHEET_API_URL the page is a preview: "chưa bắt đầu"; with it: "Không tìm thấy đơn".
    await expect(page.locator("#code-error")).toContainText(/không tìm thấy|chưa bắt đầu|quá nhanh/i);
  });

  test("order number from the e-mail link is pre-filled", async ({ page }) => {
    await page.goto("/?order=1284");
    await expect(page.getByLabel("MÃ ĐƠN HÀNG")).toHaveValue("#1284");
  });

  test("picking a size darkens gifts that do not fit", async ({ page }) => {
    await page.goto("/");
    const dark = page.locator(".wheel-artwork svg title", { hasText: "không phù hợp" });
    await expect(dark).toHaveCount(0);
    await page.locator("#size-picker button", { hasText: /^L/ }).click();
    await expect(page.locator("#size-picker button[aria-pressed=true]")).toHaveCount(1);
    expect(await dark.count()).toBeGreaterThan(0);
  });

  // The old database admin and APIs are retired (src/proxy.ts): operations live in the Google Sheet.
  test("legacy APIs are closed and return no customer data", async ({ request }) => {
    for (const path of ["/api/winners", "/api/manage/codes", "/api/lucky/validate"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(410);
      expect(Object.keys(await response.json()).sort()).toEqual(["message", "ok"]);
    }
  });

  test("legacy admin is closed", async ({ request }) => {
    expect((await request.get("/admin")).status()).toBe(410);
    expect((await request.get("/admin/codes")).status()).toBe(410);
  });
});
