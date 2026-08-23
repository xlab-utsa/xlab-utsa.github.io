import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone dev tool — deliberately has no relationship to the main site's build.
export default defineConfig({
  plugins: [react()],
});
