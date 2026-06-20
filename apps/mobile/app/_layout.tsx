import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Slot } from "expo-router";

const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL as string,
);

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <Slot />
    </ConvexProvider>
  );
}
