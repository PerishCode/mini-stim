import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiEndpoint = process.env.SANTI_API_ENDPOINT ?? "http://127.0.0.1:43307";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: apiEndpoint,
        changeOrigin: true,
      },
    },
  },
});
