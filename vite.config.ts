import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  // Relative so the same build works at a domain root and at a /repo-name/ path.
  base: "./",
  plugins: [react()],
  server: { port: 5180 },
});
