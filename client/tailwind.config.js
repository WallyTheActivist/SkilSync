/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        brand: {
          navy:  '#0f172a',
          dark:  '#1e293b',
          mid:   '#334155',
          light: '#64748b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.08)',
        hover: '0 4px 12px rgba(0,0,0,.1), 0 8px 24px rgba(0,0,0,.08)',
      },
      animation: {
        'fade-in':    'fadeIn .3s ease-in-out',
        'slide-up':   'slideUp .3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(.4,0,.6,1) infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' },                     '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
