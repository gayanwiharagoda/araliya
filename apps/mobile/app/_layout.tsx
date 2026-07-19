import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Slot } from "expo-router";

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string,
);

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex}>
      <Slot />
    </ConvexAuthProvider>
  );
}
