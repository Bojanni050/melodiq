import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#ff530c",
          50: "#fff5f0",
          100: "#ffe8dc",
          200: "#ffd1b8",
          300: "#ffb894",
          400: "#ff8550",
          500: "#ff530c",
          600: "#e64a0b",
          700: "#cc4109",
          800: "#b33808",
          900: "#992f07",
        },
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        soundwave: {
          "0%, 100%": { height: "4px" },
          "50%": { height: "24px" },
        },
        "aurora-move": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      },
      animation: {
        shimmer: "shimmer 2s linear infinite",
        soundwave: "soundwave 1.2s ease-in-out infinite",
        "aurora-move": "aurora-move 8s ease infinite",
      },
    },
  },
  plugins: [],
};

export default config;
