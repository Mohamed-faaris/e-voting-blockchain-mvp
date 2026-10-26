import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "public",
    emptyOutDir: false
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/chain": "http://localhost:3000",
      "/demo": "http://localhost:3000"
    }
  }
});
