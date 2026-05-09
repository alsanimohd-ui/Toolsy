import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        border: "var(--border)",
        "border-subtle": "var(--border-subtle)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-glow": "var(--accent-glow)",
      },
    },
  },
  plugins: [],
  safelist: [
    // Dynamic color patterns for threat levels & categories & log highlighting
    { pattern: /^(bg|text|border|decoration)-(red|amber|emerald|blue|cyan|purple|pink|muted)-(300|400|500|600|700)(\/10|\/20|\/30|\/5|\/80)?$/ },
    // Specific static classes used in JS logic
    "bg-red-500/10", "bg-amber-500/10", "bg-emerald-500/10", "bg-muted/10",
    "text-red-400", "text-amber-400", "text-emerald-400", "text-muted",
    "bg-white/5", "bg-white/10", "bg-black/20", "bg-black/40",
    "border-white/5", "border-white/10", "border-accent/10", "border-accent/20",
    "animate-pulse", "animate-bounce", "animate-spin",
    "decoration-blue-500/30", "decoration-blue-400/30",
    "text-emerald-400", "text-cyan-400", "text-blue-400", "text-blue-300", "text-amber-400/80"
  ],
};
export default config;
