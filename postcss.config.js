import { fileURLToPath } from "node:url";

// Resolve the Tailwind config next to this file so the dev server works
// no matter which directory it was launched from.
const tailwindConfig = fileURLToPath(new URL("./tailwind.config.ts", import.meta.url));

export default {
  plugins: {
    tailwindcss: { config: tailwindConfig },
    autoprefixer: {},
  },
};
