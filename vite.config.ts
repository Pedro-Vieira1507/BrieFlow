import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "server" },
      nitro: {
        preset: "node-server",
        serveStatic: true,
      },
    }),
    react(),
    tailwindcss(),
    nitro(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    tsconfigPaths: true,
  },
});