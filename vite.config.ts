import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig({
  // Use VITE_BASE to override base path for GitHub Pages or sub-path hosting
  base: process.env.VITE_BASE ?? (process.env.NODE_ENV === 'development' ? '/' : '/'),
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // componentTagger(), // Disabled for troubleshooting build issues
  ].filter(Boolean),
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
