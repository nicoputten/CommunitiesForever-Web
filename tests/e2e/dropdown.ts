import { expect, type Locator, type Page } from "@playwright/test";

// Picking in the site's dropdown (WEB-48) the way a user does: open it, then click the option. Works for the menu on
// desktop and the bottom sheet on phones. `option` is the option's accessible name: label and " · meta".

export async function pick(page: Page, trigger: Locator, option: string | RegExp): Promise<void> {
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const name = typeof option === "string" ? new RegExp(`^${escape(option)}( ·|$)`) : option;
  await page.getByRole("option", { name }).first().click();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
