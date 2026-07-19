import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Text: (p: Record<string, unknown>) => React.createElement("span", p),
    View: (p: Record<string, unknown>) => React.createElement("div", p),
    StyleSheet: { create: (styles: unknown) => styles },
  };
});
vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({}) }));
vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn() }),
}));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));

import { render, screen } from "@testing-library/react";
import InviteScreen from "./invite";

describe("invite screen", () => {
  it("shows a clear error when the token is missing", () => {
    render(<InviteScreen />);
    expect(screen.getByRole("alert").textContent).toMatch(/invalid/i);
  });
});
