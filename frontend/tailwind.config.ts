import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@medusajs/ui/dist/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        "brand-primary": "#1D2F5D",
        "brand-primary-dark": "#0F1A36",
        "brand-primary-light": "#2A4380",
        "brand-primary-soft": "#EAEFF8",
        "brand-cream": "#FDFBF7",
        "brand-warm-white": "#FAFAF9",
        "brand-surface": "#FFFFFF",
        "brand-surface-muted": "#F4F5F7",
        "brand-text": "#111827",
        "brand-text-muted": "#64748B",
        "brand-border": "#E2E8F0",
        "brand-gold": "#D4AF37",
        "brand-gold-soft": "#FDF9EF",
        "brand-gold-dark": "#997A1E",
        "brand-rose": "#B76E79",
        "obsidian-base": "#07090E",
        "navy-surface": "#0D152B",
        "navy-accent": "#142040",
        "navy-glow": "#1E2E5B",
        rosegold: "#B76E79",
        pearl: "#F4F5F8",
        ash: "#8B95A5",
        // Semantic design system tokens
        "page-bg": "var(--page-bg, #FDFBF7)",
        "surface-bg": "var(--surface-bg, #FFFFFF)",
        "elevated-surface": "var(--elevated-surface, #F8FAFC)",
        "border-theme": "var(--border-color, #E2E8F0)",
        "text-primary": "var(--text-primary, #111827)",
        "text-secondary": "var(--text-secondary, #475569)",
        "text-muted": "var(--text-muted, #64748B)",
        "text-disabled": "var(--text-disabled, #94A3B8)",
        "primary-action": "#1D2F5D",
        "primary-action-hover": "#152347",
        "gold-action": "#D4AF37",
        "gold-action-hover": "#C5A059",
      },
      boxShadow: {
        ambient: "0 0 25px -5px rgba(20, 32, 64, 0.4)",
        "ambient-lg": "0 0 40px -10px rgba(30, 46, 91, 0.5)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [require("tailwind-scrollbar-hide")],
  presets: [require("@medusajs/ui-preset")],
  darkMode: "class",
};
export default config;
