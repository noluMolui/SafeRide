/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#1d46d8",
        ink: "#0c1529",
        muted: "#526987",
        canvas: "#f6f8fa",
        soft: "#f0f2ff",
      },
    },
  },
  plugins: [],
};
