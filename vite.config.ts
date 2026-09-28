// Independent build. Only VITE_* values may be exposed in browser code.
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
      tanstackStart({ server: { entry: "server" } }),
      nitro(),
      react(),
    ],
    resolve: { dedupe: ["react", "react-dom"] },
  };
});
