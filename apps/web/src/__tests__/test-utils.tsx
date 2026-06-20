import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ConvexProvider } from "convex/react";
import { ConvexReactClient } from "convex/react";

const mockClient = new ConvexReactClient("https://test.convex.cloud");

function Providers({ children }: { children: ReactNode }) {
  return <ConvexProvider client={mockClient}>{children}</ConvexProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: Providers, ...options });
}

export { screen, act, within } from "@testing-library/react";
