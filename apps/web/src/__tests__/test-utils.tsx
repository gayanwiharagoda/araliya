import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

const mockClient = new ConvexReactClient("https://test.convex.cloud");

function Providers({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={mockClient}>{children}</ConvexAuthProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: Providers, ...options });
}

export { screen, act, within, waitFor } from "@testing-library/react";
