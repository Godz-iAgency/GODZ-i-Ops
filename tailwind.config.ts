import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#000000",
        surface: "#141414",
        surfaceRaised: "#1F1F1F",
        border: "#2C2C2C",
        muted: "#999999",
        accent: "#F0451F",
        teal: "#4FD1C5",
        pink: "#FF5D8F",
      },
    },
  },
  plugins: [],
};
export default config;
