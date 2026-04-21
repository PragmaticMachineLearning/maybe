import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { assistantApiPlugin } from "./src/server/viteAssistantPlugin";

export default defineConfig({
  plugins: [assistantApiPlugin(), react()],
  build: {
    sourcemap: true,
  },
});
