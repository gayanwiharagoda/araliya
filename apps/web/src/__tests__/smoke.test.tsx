import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";

function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}</h1>;
}

describe("web app", () => {
  it("renders a react component", async () => {
    await act(async () => {
      render(<Greeting name="DomusOS" />);
    });
    expect(screen.getByText("Hello, DomusOS")).toBeDefined();
  });
});
