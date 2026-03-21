// This file is kept for vitest + playwright compatibility.
// The actual Electron build is driven by electron.vite.config.ts via electron-vite.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer"),
      "@shared": path.resolve(__dirname, "./src/shared"),
    },
  },
  server: {
    port: 1420,
    host: "0.0.0.0",
    strictPort: true,
  },
  build: {
    outDir: "dist",
  },
});
