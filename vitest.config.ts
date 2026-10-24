import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // 避免加载 Next/Tailwind 的 PostCSS 配置（单测不需要 CSS）
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
