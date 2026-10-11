import { test, expect } from "@playwright/test";

// Critical path: a committee admin signs up, creates a building, and sees it
// listed. Requires a live Convex deployment (NEXT_PUBLIC_CONVEX_URL) — runs
// via `pnpm test:e2e`, not part of `pnpm validate`.
test("sign up then create a building and see it listed", async ({ page }) => {
  await page.goto("/");

  // Switch to the sign-up flow and register a fresh admin.
  const email = `admin+${Date.now()}@example.com`;
  await page
    .getByRole("button", { name: /need an account\? sign up/i })
    .click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("hunter2-strong");
  await page.getByRole("button", { name: /^sign up$/i }).click();

  // Dashboard appears once authenticated.
  await expect(
    page.getByRole("heading", { name: /your buildings/i }),
  ).toBeVisible();

  // Create a building and see it listed.
  const name = `Tower ${Date.now()}`;
  await page.getByPlaceholder(/building name/i).fill(name);
  await page.getByRole("button", { name: /create building/i }).click();
  await expect(page.getByRole("button", { name })).toBeVisible();
});
