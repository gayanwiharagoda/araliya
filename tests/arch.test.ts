import { describe, it, expect } from "vitest";
import { projectFiles } from "archunit";

// ponytail: ArchUnitTS handles boundary enforcement declaratively.
// Upgrade to dependency-cruiser if you need cross-workspace cycle detection or dep graphs.

describe("architecture boundaries", () => {
  it("backend must not depend on web app", async () => {
    const rule = projectFiles("../packages/backend/convex/tsconfig.json")
      .inPath("packages/backend")
      .shouldNot()
      .dependOnFiles()
      .inPath("apps/web");

    await expect(rule).toPassAsync({ allowEmptyTests: true });
  });

  it("backend must not depend on mobile app", async () => {
    const rule = projectFiles("../packages/backend/convex/tsconfig.json")
      .inPath("packages/backend")
      .shouldNot()
      .dependOnFiles()
      .inPath("apps/mobile");

    await expect(rule).toPassAsync({ allowEmptyTests: true });
  });

  it("web must not depend on mobile app", async () => {
    const rule = projectFiles("../apps/web/tsconfig.json")
      .inPath("apps/web")
      .shouldNot()
      .dependOnFiles()
      .inPath("apps/mobile");

    await expect(rule).toPassAsync({ allowEmptyTests: true });
  });

  it("mobile must not depend on web app", async () => {
    const rule = projectFiles("../apps/mobile/tsconfig.json")
      .inPath("apps/mobile")
      .shouldNot()
      .dependOnFiles()
      .inPath("apps/web");

    await expect(rule).toPassAsync({ allowEmptyTests: true });
  });

  // The SDLC orchestrator (ADR 0010) is dev-tooling: it shells out to git/gh/pnpm/claude
  // and must stay isolated from app code — imports nothing from apps/backend, imported by none.
  it("sdlc orchestrator must not depend on apps or backend", async () => {
    const rule = projectFiles("../tooling/sdlc/tsconfig.json")
      .inPath("tooling/sdlc")
      .shouldNot()
      .dependOnFiles()
      .inPath(/apps\/|packages\/backend/);

    await expect(rule).toPassAsync({ allowEmptyTests: true });
  });

  it("backend must not depend on sdlc orchestrator", async () => {
    const rule = projectFiles("../packages/backend/convex/tsconfig.json")
      .inPath("packages/backend")
      .shouldNot()
      .dependOnFiles()
      .inPath("tooling/sdlc");

    await expect(rule).toPassAsync({ allowEmptyTests: true });
  });
});
