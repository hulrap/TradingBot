import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ["@trading-bot/types", "@trading-bot/crypto"],
  treeshake: true,
  target: "es2022",
  outDir: "dist",
  tsconfig: "./tsconfig.json",
});
