import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        foreground: "#f4f4f5",
        bg: "#050507",
        surface: "#08080d",
        surface2: "#0c0c12",
        surface3: "#101018",
        surfaceElevated: "#16161f",
        border: "rgba(255,255,255,0.05)",
        borderHover: "rgba(255,255,255,0.1)",
        muted: "#71717a",
        textSecondary: "#a1a1aa",
        accent: "#e8430a",
        accentDark: "#c93a08",
        accentLight: "#ff6b35",
      },
      fontFamily: {
        sans: ["Montserrat", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SF Mono", "monospace"],
      },
      borderRadius: {
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
export default config;
