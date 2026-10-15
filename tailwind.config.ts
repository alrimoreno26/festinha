import type { Config } from 'tailwindcss'

// Identidade do catálogo: arco-íris pastel (rosa, pêssego, amarelo, menta, azul, lilás) sobre fundo creme.
// Os pastéis servem para fundos e enfeites; texto e botões usam os tons fortes (rose/grape/ink), com contraste AA.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Pastéis do catálogo
          pink: '#FFABE4',
          'pink-light': '#FFCCEF',
          peach: '#FFC2AF',
          sun: '#FFDB8A',
          mint: '#B5E7D5',
          sky: '#A6DEF5',
          lilac: '#D9C7F5',
          blush: '#FFEAF6',
          cream: '#FFFAFA',
          // Tons fortes (texto, botões, links)
          rose: '#CC3A85',
          'rose-dark': '#B82F74',
          grape: '#6E4FB8',
          'grape-dark': '#5B3F9E',
          ink: '#4A3360',
          text: '#535353',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'toast-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        'toast-in': 'toast-in .2s ease-out',
        float: 'float 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

export default config
