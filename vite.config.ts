import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { getProjectEnvValue } from "./src/server/projectEnv";
import { assistantApiPlugin } from "./src/server/viteAssistantPlugin";

const openAiApiKey = getProjectEnvValue("OPENAI_API_KEY");

export default defineConfig({
  plugins: [
    assistantApiPlugin({
      getApiKey: () => openAiApiKey,
    }),
    react(),
  ],
  build: {
    sourcemap: true,
  },
});
