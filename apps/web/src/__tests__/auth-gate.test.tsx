import { describe, it, expect } from "vitest";
import { renderWithProviders, screen, waitFor } from "./test-utils";
import Home from "../app/page";

describe("dashboard auth gate", () => {
  it("gates the dashboard behind the sign-in form", async () => {
    renderWithProviders(<Home />);

    // With no session, the gate settles to the auth UI, not the dashboard.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /sign in/i })).toBeDefined();
    });
    expect(screen.queryByText(/your buildings/i)).toBeNull();
  });
});
