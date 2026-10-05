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
        // NOTE: the palettes (the pink `primary` scale and the editorial
        // `--mq-*` tokens) live in src/app/globals.css (@theme / @theme
        // inline) — that CSS is the single source of truth. This JS config is
        // intentionally not loaded by Tailwind 4 (no `@config` directive).
        // The old orange `primary` scale that used to live here contradicted
        // globals.css and has been removed so there is only one source.
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
