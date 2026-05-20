import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        cream: "#FFF8EC",
        ink: "#24302D",
        mint: "#87D8B5",
        sunny: "#FFD166",
        coral: "#FF7A6B",
        blue: "#76B7F2"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(36, 48, 45, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
