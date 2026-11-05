/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gaming: {
          dark: '#0b0f19',
          card: '#111827',
          accent: '#6366f1',
          gold: '#f59e0b',
          neon: '#10b981',
        },
      },
    },
  },
  plugins: [],
};
