import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://coverview.ch",
  output: "static",
  trailingSlash: "never",
  integrations: [mdx()],
  server: { host: "127.0.0.1", port: 4103 },
  vite: { envDir: "../..", plugins: [tailwindcss()], server: { strictPort: true } },
  devToolbar: { enabled: false },
});
