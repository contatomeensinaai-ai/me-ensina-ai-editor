import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { codexKeywordPlugin } from "../runtime/server/codex-keywords.mjs";
import { localArtifactPlugin } from "../runtime/server/local-artifacts.mjs";
import { supportingImagePlanningPlugin } from "../runtime/server/supporting-image-planning.mjs";
import { supportingImageGenerationPlugin } from "../runtime/server/supporting-image-generation.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        editor: resolve(projectRoot, "index.html"),
      },
    },
  },
  test: {
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["src/**/*.test.*", "src/**/__fixtures__/**"],
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  worker: {
    format: "es",
  },
  server: {
    headers: isolationHeaders,
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  preview: {
    headers: isolationHeaders,
  },
  plugins: [react(), codexKeywordPlugin(), localArtifactPlugin(), supportingImageGenerationPlugin({origin:'http://127.0.0.1:5201'}), supportingImagePlanningPlugin({origin:'http://127.0.0.1:5201'})],
});
