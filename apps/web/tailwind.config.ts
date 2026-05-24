import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        ink: '#17202a',
        muted: '#64748b',
        line: '#d7dde5',
        panel: '#f7f9fb',
        signal: '#166f6b',
        warning: '#b7791f',
      },
      boxShadow: {
        shell: '0 20px 60px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
