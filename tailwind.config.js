/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        ink: {
          950: '#0a0e14',
          900: '#111827',
          800: '#1a2332',
          700: '#243042',
        },
        paper: {
          50:  '#f8f6f2',
          100: '#f0ece4',
          200: '#e0d8cc',
        },
        cyan:   { DEFAULT: '#00d4ff', dark: '#0099bb' },
        amber:  { DEFAULT: '#f59e0b', dark: '#b45309' },
        emerald:{ DEFAULT: '#10b981', dark: '#065f46' },
        rose:   { DEFAULT: '#f43f5e', dark: '#9f1239' },
        violet: { DEFAULT: '#8b5cf6', dark: '#5b21b6' },
      },
    },
  },
  plugins: [],
}
