import { test } from "@playwright/test";
import { bootNamespacedDashboard } from "../helpers/namespaced-dashboard.js";
test("ispeziona", async ({ page }, testInfo) => {
  await page.route("https://**", (r) => r.fulfill({ status: 200, body: "" }));
  await bootNamespacedDashboard(page, "dashboard.html", testInfo, { schema_version: 4, sections: {}, visibility: { home: true } });
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => [...document.querySelectorAll("nav.bottom-nav-bar .tab")].map((t) => ({ tab: t.dataset.tab, icon: t.querySelector(".icon")?.outerHTML.slice(0, 300) })));
  console.log(JSON.stringify(out, null, 1));
});
