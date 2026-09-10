import type { Config } from "tailwindcss";

const config: Config = {
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
        "obsidian-base": "#07090E",
        "navy-surface": "#0D152B",
        "navy-accent": "#142040",
        "navy-glow": "#1E2E5B",
        rosegold: "#B76E79",
        pearl: "#F4F5F8",
        ash: "#8B95A5",
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
