import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("the kitchen reprints a ticket and the print is logged", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "runs once");
  // Headless Chromium can't show a print dialog; stub it so the browser printer completes.
  await page.addInitScript(() => {
    window.print = () => undefined;
    HTMLIFrameElement.prototype.focus = () => undefined;
  });
  await page.addInitScript(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "contentWindow")!;
    Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
      get() {
        const w = original.get!.call(this) as Window | null;
        if (w) w.print = () => undefined;
        return w;
      },
    });
  });
  await login(page, "cocina@cafelucia.example", "/app/cafe-lucia/cocina");
  const reprint = page.getByRole("button", { name: /^Reimprimir #\d+/ }).first();
  await expect(reprint).toBeVisible({ timeout: 20_000 });
  const number = (await reprint.getAttribute("aria-label"))!.match(/#(\d+)/)![1];
  await reprint.click();
  await expect(page.getByText(`Ticket #${number} enviado a la impresora.`)).toBeVisible({ timeout: 20_000 });
});
