// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      // @huggingface/transformers v3 uses dynamic WASM — must be excluded from pre-bundling.
      // The Web Worker imports it directly at runtime.
      exclude: ["@huggingface/transformers", "onnxruntime-web"],
    },
    worker: {
      format: "es",
    },
  },
});
