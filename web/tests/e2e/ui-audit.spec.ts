import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const assetDir = path.resolve(process.cwd(), "../tmp/ui-audit/assets");

type ViewportScenario = {
  id: string;
  width: number;
  height: number;
};

const scenarios: ViewportScenario[] = [
  { id: "mobile", width: 390, height: 844 },
  { id: "tablet", width: 834, height: 1112 },
  { id: "desktop", width: 1440, height: 900 },
  { id: "ultrawide", width: 1920, height: 1080 }
];

const screenshot = async (page: Page, name: string) => {
  await page.screenshot({
    path: path.join(assetDir, `${name}.png`)
  });
};

for (const scenario of scenarios) {
  test(`ui audit - ${scenario.id}`, async ({ page }) => {
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Incident Command Deck" })).toBeVisible();
    await screenshot(page, `${scenario.id}-01-landing`);

    await page.getByRole("link", { name: /Create/ }).click();
    await expect(page.getByRole("heading", { name: "Manually trigger an event" })).toBeVisible();
    await screenshot(page, `${scenario.id}-02-composer-open`);

    await page.getByLabel("Search incidents").fill("db");
    await page.getByLabel("Sort order").selectOption("severity");
    await page.getByLabel("Status filter").selectOption("open");
    await screenshot(page, `${scenario.id}-03-filtered`);

    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    });
    await page.waitForTimeout(300);
    await screenshot(page, `${scenario.id}-04-scrolled-bottom`);
  });
}
