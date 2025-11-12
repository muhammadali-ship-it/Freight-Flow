import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Default API URL - can be overridden by environment variables
  const defaultApiUrl = mode === 'production' 
    ? 'https://freight-flow-steel.vercel.app'
    : 'http://localhost:5000';

  const apiUrl = process.env.VITE_API_URL || defaultApiUrl;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@shared": path.resolve(import.meta.dirname, "..", "server", "shared"),
      },
    },
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      exclude: ['drizzle-orm'],
    },
    ssr: {
      noExternal: ['drizzle-orm', 'drizzle-zod'],
    },
  };
});
