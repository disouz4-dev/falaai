// PT-BR: Config do Vite — build vai para dist/ (servido pelo FastAPI) e o dev usa proxy pra API.
// EN: Vite config — builds to dist/ (served by FastAPI); dev proxies the API to the backend.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // PT-BR: no modo dev, encaminha /api para o backend FastAPI. EN: proxy /api to FastAPI in dev.
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
