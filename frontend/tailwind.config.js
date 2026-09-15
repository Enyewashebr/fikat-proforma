/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        quarry: {
          50: "#f6f7f7",
          100: "#e7e9ea",
          200: "#cfd3d6",
          300: "#a9b0b5",
          400: "#7c868d",
          500: "#5f6a72",
          600: "#4c555c",
          700: "#3f464c",
          800: "#363c41",
          900: "#24282b",
          950: "#16181a",
        },
        moss: {
          500: "#4f7a63",
          600: "#3e6250",
          700: "#334f41",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
