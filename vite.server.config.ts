import path from "node:path";
import { defineConfig } from "vite";
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  build: {
    ssr: "server/commercial.ts",
    outDir: "server-dist",
    target: "node24",
    minify: false,
    rollupOptions: { output: { entryFileNames: "commercial.js" } },
  },
});
