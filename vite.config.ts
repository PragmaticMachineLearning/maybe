import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.MAYBE_API_ORIGIN ?? "http://localhost:3000";

function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("/node_modules/echarts/")) {
    if (id.includes("/lib/chart/")) {
      return "vendor-echarts-charts";
    }

    if (id.includes("/lib/component/")) {
      return "vendor-echarts-components";
    }

    if (id.includes("/lib/coord/") || id.includes("/lib/scale/")) {
      return "vendor-echarts-coordinates";
    }

    if (id.includes("/lib/data/")) {
      return "vendor-echarts-data";
    }

    return "vendor-echarts-core";
  }

  if (id.includes("/node_modules/zrender/")) {
    return "vendor-zrender";
  }

  if (id.includes("/node_modules/gaussformula/")) {
    if (id.includes("/interpreter/plugin/")) {
      return "vendor-gaussformula-plugins";
    }

    if (id.includes("/parser/") || id.includes("/i18n/")) {
      return "vendor-gaussformula-parser";
    }

    return "vendor-gaussformula-core";
  }

  if (
    id.includes("/node_modules/chevrotain/") ||
    id.includes("/node_modules/regexp-to-ast/")
  ) {
    return "vendor-formula-parser";
  }

  if (id.includes("/node_modules/zod/")) {
    return "vendor-zod";
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
    rolldownOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
