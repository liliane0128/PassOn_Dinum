import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef3ff",
          100: "#dce6ff",
          200: "#b8ccff",
          300: "#8aa9ff",
          400: "#5c81ff",
          500: "#3d63f5",
          600: "#2f4fd6",
          700: "#2740ab",
          800: "#213687",
          900: "#1c2e6b",
        },
        marianne: {
          blue: "#000091",
          red: "#e1000f",
        },
      },
      fontFamily: {
        sans: [
          "Marianne",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(16, 24, 40, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
