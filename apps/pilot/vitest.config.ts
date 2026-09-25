import { defineConfig } from "vitest/config";

// tsconfig keeps `jsx: "preserve"` for Next.js, which leaves JSX untransformed in
// tests. Compile it with the automatic runtime so component tests can render.
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
});
