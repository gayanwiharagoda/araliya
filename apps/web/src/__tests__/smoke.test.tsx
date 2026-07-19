import { describe, it, expect, vi } from "vitest";

// convex ships its own nested React copy, so the real useQuery would run hooks against
// a second React instance in jsdom. Stub the client surface — the point of this test is
// that the real Home page renders the data it's given, not to exercise convex itself.
vi.mock("convex/react", () => ({
  ConvexProvider: ({ children }: { children: React.ReactNode }) => children,
  ConvexReactClient: vi.fn(),
  useQuery: () => [{ _id: "1", text: "Buy milk", isCompleted: false }],
}));

vi.mock("@domus/backend/convex/_generated/api", () => ({
  api: { tasks: { list: "tasks:list" } },
}));

import { renderWithProviders, screen, act } from "./test-utils";
import Home from "../app/page";

describe("web app", () => {
  it("renders the Home page with tasks through the Convex provider", async () => {
    await act(async () => {
      renderWithProviders(<Home />);
    });
    expect(screen.getByText("DomusOS")).toBeDefined();
    expect(screen.getByText(/Buy milk/)).toBeDefined();
  });
});
