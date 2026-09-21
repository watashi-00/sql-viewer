/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0D10',
        surface: '#111418',
        'surface-secondary': '#161A20',
        border: '#272C33',
        primary: '#E6E8EB',
        secondary: '#9299A3',
        muted: '#626A75',
        accent: '#7C9CFF',
        success: '#62C58A',
        warning: '#D9A441',
        error: '#E06C75',
        info: '#6EA8FE',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
