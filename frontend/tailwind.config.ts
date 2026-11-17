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
        // Brand palette (docs/27-ui-ux-redesign-brief.md). Values live in globals.css as RGB
        // channels so opacity modifiers (bg-brand-navy/10) keep working.
        "brand-navy": "rgb(var(--rgb-navy) / <alpha-value>)",
        "brand-primary": "rgb(var(--rgb-primary) / <alpha-value>)",
        "brand-primary-dark": "rgb(var(--rgb-navy) / <alpha-value>)",
        "brand-primary-light": "rgb(var(--rgb-secondary) / <alpha-value>)",
        "brand-primary-soft": "rgb(var(--rgb-light) / <alpha-value>)",
        "brand-secondary": "rgb(var(--rgb-secondary) / <alpha-value>)",
        "brand-light": "rgb(var(--rgb-light) / <alpha-value>)",
        "brand-deep": "rgb(var(--rgb-deep) / <alpha-value>)",
        "brand-blue": "rgb(var(--rgb-primary) / <alpha-value>)",
        "brand-blue-hover": "rgb(var(--rgb-secondary) / <alpha-value>)",
        "brand-blue-light": "rgb(var(--rgb-light) / <alpha-value>)",
        "brand-blue-accent": "rgb(var(--rgb-secondary) / <alpha-value>)",
        "brand-blue-dark": "rgb(var(--rgb-navy) / <alpha-value>)",
        "brand-footer-dark": "rgb(var(--rgb-deep) / <alpha-value>)",
        "brand-cream": "rgb(var(--rgb-cream) / <alpha-value>)",
        "brand-warm-white": "rgb(var(--rgb-warm) / <alpha-value>)",
        "brand-surface": "#FFFFFF",
        "brand-surface-muted": "rgb(var(--rgb-muted-bg) / <alpha-value>)",
        "brand-text": "rgb(var(--rgb-text) / <alpha-value>)",
        "brand-text-muted": "rgb(var(--rgb-text-muted) / <alpha-value>)",
        "brand-border": "rgb(var(--rgb-border) / <alpha-value>)",
        "brand-gold": "rgb(var(--rgb-gold) / <alpha-value>)",
        "brand-gold-soft": "rgb(var(--rgb-gold-light) / <alpha-value>)",
        "brand-gold-light": "rgb(var(--rgb-gold-light) / <alpha-value>)",
        "brand-gold-dark": "rgb(var(--rgb-gold-dark) / <alpha-value>)",
        "brand-rose": "#B76E79",
        "obsidian-base": "#07090E",
        "navy-surface": "#0D152B",
        "navy-accent": "#142040",
        "navy-glow": "#1E2E5B",
        rosegold: "#B76E79",
        pearl: "#F4F5F8",
        ash: "#8B95A5",
        // Semantic design system tokens
        "page-bg": "var(--page-bg, #F8FAFC)",
        "surface-bg": "var(--surface-bg, #FFFFFF)",
        "elevated-surface": "var(--elevated-surface, #F1F5F9)",
        "border-theme": "var(--border-color, #E2E8F0)",
        "text-primary": "var(--text-primary, #0F172A)",
        "text-secondary": "var(--text-secondary, #475569)",
        "text-muted": "var(--text-muted, #64748B)",
        "text-disabled": "var(--text-disabled, #94A3B8)",
        "primary-action": "var(--primary-action)",
        "primary-action-hover": "var(--primary-action-hover)",
        "gold-action": "var(--gold-action)",
        "gold-action-hover": "var(--gold-action-hover)",
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
