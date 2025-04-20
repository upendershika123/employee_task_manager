import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  // Dynamically set NODE_ENV based on the mode
  process.env.NODE_ENV = mode;

  // Only import lovable-tagger in development mode
  let componentTagger;
  if (mode === "development") {
    const taggerModule = await import("lovable-tagger");
    componentTagger = taggerModule.componentTagger;
  }

  // Get the base URL from environment variable or use default
  const base = process.env.VITE_APP_URL ? new URL(process.env.VITE_APP_URL).pathname : '/';

  return {
    base,
    publicDir: "public",
    server: {
      host: "::",
      port: 8080,
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      emptyOutDir: true,
      copyPublicDir: true,
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
