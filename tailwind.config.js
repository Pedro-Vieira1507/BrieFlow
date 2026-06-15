/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:   '#003366',
          blue:   '#0099FF',
          light:  '#F0F4F8',
          orange: '#FF6B00',
          text:   '#1A1A2E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':   'fadeIn 0.2s ease-out',
        'slide-up':  'slideUp 0.25s ease-out',
        'pulse-dot': 'pulseDot 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseDot: { '0%,100%': { opacity: 0.3 }, '50%': { opacity: 1 } },
      },
    },
  },
  plugins: [],
}
