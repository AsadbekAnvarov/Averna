import type { Config } from "tailwindcss";
import themeTokens from "./lib/theme-tokens.json";

/**
 * Theme-aware colours: `white`, the grey scale, the bright accent shades and the
 * brand colours resolve to CSS variables whose values switch with the theme
 * (see lib/theme-tokens.json and scripts/theme-tokens.mjs). Opacity modifiers
 * (`bg-white/5`, `ring-averna-neon/40` …) keep working through <alpha-value>.
 */
type Palette = Record<string, string | Record<string, string>>;
const tokenColors = (themeTokens.tokens as [string, string, string][]).reduce<Palette>((out, [name]) => {
  const value = `rgb(var(--c-${name}) / <alpha-value>)`;
  if (name === "white") out.white = value;
  else {
    const [family, ...rest] = name.split("-");
    const shade = rest.join("-");
    const group = (out[family] as Record<string, string> | undefined) ?? {};
    group[shade] = value;
    out[family] = group;
  }
  return out;
}, {});

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Dynamic color classes used by AppSidebar — keep them in the final CSS.
  safelist: [
    "bg-averna-neon", "bg-averna-cyan", "bg-averna-purple", "bg-averna-pink",
    "text-averna-neon", "text-averna-cyan", "text-averna-purple", "text-averna-pink",
    "border-averna-neon", "border-averna-cyan", "border-averna-purple", "border-averna-pink",
    // Time-of-day ambient glow classes returned by getDaypart() in lib/utils.ts
    // (lib/ is outside Tailwind's content scan, so they must be safelisted).
    "bg-amber-400/10", "bg-averna-cyan/10", "bg-averna-purple/10", "bg-indigo-500/15",
    // Memory card accent gradients returned by getMemories() in lib/memories.ts.
    "from-averna-neon/30", "from-averna-cyan/30", "from-averna-purple/30",
    "from-averna-pink/30", "from-amber-500/30", "from-emerald-500/30",
  ],
  theme: {
    extend: {
      colors: {
        // white, grey, bright accent shades and the Averna brand colours
        // (neon green, cyan, purple, pink …) — dark/light values in lib/theme-tokens.json.
        ...tokenColors,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "neon-green": "0 0 20px rgba(0, 255, 148, 0.6), 0 0 40px rgba(0, 255, 148, 0.3)",
        "neon-red": "0 0 20px rgba(255, 50, 50, 0.6), 0 0 40px rgba(255, 50, 50, 0.3)",
        "neon-cyan": "0 0 20px rgba(0, 229, 255, 0.6), 0 0 40px rgba(0, 229, 255, 0.3)",
        "neon-purple": "0 0 20px rgba(177, 78, 255, 0.6), 0 0 40px rgba(177, 78, 255, 0.3)",
        "neon-pink": "0 0 20px rgba(255, 61, 187, 0.6), 0 0 40px rgba(255, 61, 187, 0.3)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.45)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(0, 255, 148, 0.5)" },
          "100%": { boxShadow: "0 0 20px rgba(0, 255, 148, 1), 0 0 30px rgba(0, 255, 148, 0.8)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
