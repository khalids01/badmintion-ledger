/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    env: { NODE_ENV: "test" },
  },
  server: { host: "0.0.0.0", port: 3000, strictPort: true },
  clearScreen: false,
});
