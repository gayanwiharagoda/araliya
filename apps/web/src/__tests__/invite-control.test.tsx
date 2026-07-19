import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateInvite = vi.fn().mockResolvedValue({
  fallbackUrl: "/invite?token=token",
});

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => generateInvite),
  useQuery: vi.fn((_: unknown, args?: { buildingId?: string }) => {
    if (!args) return [{ _id: "building", name: "Palm Court" }];
    return args.buildingId ? [{ _id: "unit", label: "A-1" }] : [];
  }),
}));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
}));

import { Dashboard } from "../app/Dashboard";

describe("invite control", () => {
  beforeEach(() => {
    generateInvite.mockClear();
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  });

  it("generates and copies a unit invite link", async () => {
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: "Palm Court" }));
    fireEvent.click(screen.getByRole("button", { name: /create invite/i }));

    await waitFor(() => expect(generateInvite).toHaveBeenCalled());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "/invite?token=token",
    );
    expect(screen.getByText(/invite link copied/i)).toBeDefined();
  });
});
