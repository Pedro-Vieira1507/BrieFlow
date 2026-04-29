// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      // Include Transformers.js so Vite pre-bundles it and resolves it inside Web Workers
      include: ["@xenova/transformers"],
      // Exclude native WASM binaries from pre-bundling (they must be loaded at runtime)
      exclude: [
        "onnxruntime-web",
      ],
    },
    worker: {
      format: "es",
    },
  },
});
