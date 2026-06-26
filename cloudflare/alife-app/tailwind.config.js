/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        desktop: '1024px',
      },
      colors: {
        'home-dark': '#21160e',
        'home-surface': '#f7efe2',
        'home-gold': '#f5d798',
        'home-gold-text': '#2b2015',
        'home-accent': '#9a6a2d',
        'home-green': '#2f6f62',
        'home-green-hover': '#24584e',
        'home-muted': '#675846',
        'home-border': '#ead7b6',
      },
    },
  },
  plugins: [],
}
