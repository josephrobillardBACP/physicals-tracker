import type { Config } from "tailwindcss";
import { fileURLToPath } from "node:url";

// Absolute paths so the config works regardless of the launch directory.
const here = fileURLToPath(new URL(".", import.meta.url)).split("\\").join("/");

export default {
  content: [`${here}index.html`, `${here}src/**/*.{ts,tsx}`],
  theme: {
    extend: {
      colors: {
        cream: "#F6F1E9",
        sand: "#EFE7DA",
        navy: { DEFAULT: "#063862", 900: "#04263F", 800: "#063862", 700: "#0B4E82", 600: "#12669F" },
        azure: { DEFAULT: "#3773A5", light: "#5B93BF", dark: "#2C5D86" },
        gold: "#BA832F",
        teal: "#3D7A6E",
        slate: "#354450",
        ink: "#263D4F",
        muted: "#5B6B7C",
      },
      fontFamily: {
        serif: ['"Cormorant"', "Georgia", "serif"],
        sans: ['"Montserrat"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 24px -8px rgba(14, 42, 71, 0.15)",
        soft: "0 10px 40px -12px rgba(14, 42, 71, 0.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
