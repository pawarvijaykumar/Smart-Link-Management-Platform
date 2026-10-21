
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // CHANGE: Forward API requests to backend — 2026-10-21
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});

/*
This is the configuration file for Vite, the development tool that runs your React frontend.

Think of Vite as the server that helps your frontend code run in your browser.*/