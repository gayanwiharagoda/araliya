import { describe, it, expect, vi } from "vitest";

// react-native's entry needs a native runtime, so map its primitives to host
// elements. This keeps the test dependency-light (no react-native-web).
vi.mock("react-native", async () => {
  const React = await import("react");
  return {
    Text: (p: Record<string, unknown>) => React.createElement("span", p),
    View: (p: Record<string, unknown>) => React.createElement("div", p),
    StyleSheet: { create: (s: unknown) => s },
  };
});

import { render, screen } from "@testing-library/react";
import Home from "./index";

describe("mobile Home", () => {
  it("renders the invite-landing screen", () => {
    render(<Home />);
    expect(screen.getByText("DomusOS")).toBeDefined();
    expect(screen.getByText(/Enter via your building invite/i)).toBeDefined();
  });
});
