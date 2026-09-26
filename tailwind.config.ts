import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          coral: '#F77F6F',
          'coral-dark': '#E5634F',
          teal: '#4AB6B7',
          'teal-dark': '#35999A',
          sand: '#FFF8F1',
          sun: '#F9C74F',
          cocoa: '#8D6E63',
          blush: '#FFE9E5',
        },
      },
      keyframes: {
        'toast-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'toast-in': 'toast-in .2s ease-out',
      },
    },
  },
  plugins: [],
}

export default config
