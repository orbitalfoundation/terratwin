import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      // @orbitalfoundation/orbital-volume is a file: link to a sibling repo;
      // pin its three/three-addons imports to this project's copy of three
      "three/addons": path.resolve(import.meta.dirname, "node_modules/three/examples/jsm"),
      "three": path.resolve(import.meta.dirname, "node_modules/three"),
    },
    dedupe: ["three"],
  },
  optimizeDeps: {
    // the file:-linked volume package must be served raw in dev - prebundling
    // a symlinked package breaks its dynamic three/addons imports (504s)
    exclude: ["@orbitalfoundation/orbital-volume"],
    include: ["three", "three/examples/jsm/controls/OrbitControls.js"],
  },
  root: path.resolve(import.meta.dirname, "client"),
  // Use relative base for GitHub Pages static builds; default '/' for server mode
  base: process.env.GITHUB_PAGES ? './' : '/',
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
