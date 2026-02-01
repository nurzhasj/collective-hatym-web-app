import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"]
      },
      colors: {
        "hatym-gray": "#c8c8c8",
        "hatym-yellow": "#f2c94c",
        "hatym-green": "#27ae60",
        "hatym-dark": "#101010",
        "hatym-ink": "#1f2933"
      }
    }
  },
  plugins: []
} satisfies Config;
