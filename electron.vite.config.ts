import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-main",
      rollupOptions: {
        input: { index: resolve(__dirname, "src/main/index.ts") },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
    resolve: {
      alias: { "@shared": resolve(__dirname, "src/shared") },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: "dist-preload",
      rollupOptions: {
        input: { index: resolve(__dirname, "src/preload/index.ts") },
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    root: ".",
    build: {
      outDir: "dist",
      rollupOptions: {
        input: { index: resolve(__dirname, "index.html") },
      },
    },
    server: {
      port: 1420,
      host: "0.0.0.0",
      strictPort: true,
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer"),
        "@shared": resolve(__dirname, "src/shared"),
      },
    },
  },
});
