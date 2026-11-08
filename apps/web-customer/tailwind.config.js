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
        "slate": {
                "50": "rgb(var(--asaas-slate-50) / <alpha-value>)",
                "100": "rgb(var(--asaas-slate-100) / <alpha-value>)",
                "200": "rgb(var(--asaas-slate-200) / <alpha-value>)",
                "300": "rgb(var(--asaas-slate-300) / <alpha-value>)",
                "400": "rgb(var(--asaas-slate-400) / <alpha-value>)",
                "500": "rgb(var(--asaas-slate-500) / <alpha-value>)",
                "600": "rgb(var(--asaas-slate-600) / <alpha-value>)",
                "700": "rgb(var(--asaas-slate-700) / <alpha-value>)",
                "800": "rgb(var(--asaas-slate-800) / <alpha-value>)",
                "900": "rgb(var(--asaas-slate-900) / <alpha-value>)",
                "950": "rgb(var(--asaas-slate-950) / <alpha-value>)"
        },
        "indigo": {
                "50": "rgb(var(--asaas-indigo-50) / <alpha-value>)",
                "100": "rgb(var(--asaas-indigo-100) / <alpha-value>)",
                "200": "rgb(var(--asaas-indigo-200) / <alpha-value>)",
                "300": "rgb(var(--asaas-indigo-300) / <alpha-value>)",
                "400": "rgb(var(--asaas-indigo-400) / <alpha-value>)",
                "500": "rgb(var(--asaas-indigo-500) / <alpha-value>)",
                "600": "rgb(var(--asaas-indigo-600) / <alpha-value>)",
                "700": "rgb(var(--asaas-indigo-700) / <alpha-value>)",
                "800": "rgb(var(--asaas-indigo-800) / <alpha-value>)",
                "900": "rgb(var(--asaas-indigo-900) / <alpha-value>)",
                "950": "rgb(var(--asaas-indigo-950) / <alpha-value>)"
        },
        "violet": {
                "50": "rgb(var(--asaas-indigo-50) / <alpha-value>)",
                "100": "rgb(var(--asaas-indigo-100) / <alpha-value>)",
                "200": "rgb(var(--asaas-indigo-200) / <alpha-value>)",
                "300": "rgb(var(--asaas-indigo-300) / <alpha-value>)",
                "400": "rgb(var(--asaas-indigo-400) / <alpha-value>)",
                "500": "rgb(var(--asaas-indigo-500) / <alpha-value>)",
                "600": "rgb(var(--asaas-indigo-600) / <alpha-value>)",
                "700": "rgb(var(--asaas-indigo-700) / <alpha-value>)",
                "800": "rgb(var(--asaas-indigo-800) / <alpha-value>)",
                "900": "rgb(var(--asaas-indigo-900) / <alpha-value>)",
                "950": "rgb(var(--asaas-indigo-950) / <alpha-value>)"
        },
        "gaming": {
                "dark": "rgb(var(--asaas-slate-950) / <alpha-value>)",
                "card": "rgb(var(--asaas-slate-900) / <alpha-value>)",
                "accent": "rgb(var(--asaas-indigo-500) / <alpha-value>)",
                "gold": "rgb(var(--asaas-indigo-400) / <alpha-value>)",
                "neon": "#10b981"
        }
},
    },
  },
  plugins: [],
};
