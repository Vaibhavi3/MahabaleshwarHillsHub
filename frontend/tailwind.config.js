/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#ff3f6c',
          dark: '#e0325a',
          light: '#ff9eb4',
        },
        ink: '#282c3f',
        muted: '#94969f',
        surface: '#f5f5f6',
      },
      fontFamily: {
        sans: [
          'Assistant',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
