import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom + a react-native primitive mock (see app/index.test.tsx) lets us render
    // the screen without pulling in react-native-web.
    environment: "jsdom",
  },
});
