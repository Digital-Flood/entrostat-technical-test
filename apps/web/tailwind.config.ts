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
        background: '#0B1220',
        'border-active': 'rgba(96, 165, 250, 0.65)',
        'border-subtle': 'rgba(148, 163, 184, 0.18)',
        error: '#EF4444',
        input: 'rgba(15, 23, 42, 0.85)',
        'input-border': 'rgba(148, 163, 184, 0.22)',
        'input-focus': 'rgba(96, 165, 250, 0.75)',
        'input-strong': 'rgba(15, 23, 42, 0.9)',
        'info-blue': '#38BDF8',
        'primary-blue': '#2563EB',
        'soft-blue': '#60A5FA',
        success: '#22C55E',
        surface: '#111827',
        'surface-glass': 'rgba(15, 23, 42, 0.72)',
        'surface-raised': '#1E293B',
        'text-inverse': '#0B1220',
        'text-muted': '#64748B',
        'text-primary': '#E5E7EB',
        'text-secondary': '#9CA3AF',
        warning: '#FBBF24',
      },
      boxShadow: {
        action: '0 14px 32px rgb(37 99 235 / 0.28)',
        card: '0 28px 90px rgb(2 6 23 / 0.58), inset 0 1px 0 rgb(255 255 255 / 0.055)',
        drawer: '-28px 0 90px rgb(2 6 23 / 0.62)',
        focus: '0 0 0 3px rgb(96 165 250 / 0.16), 0 0 28px rgb(96 165 250 / 0.1)',
        input: 'inset 0 1px 0 rgb(255 255 255 / 0.035), 0 10px 28px rgb(2 6 23 / 0.16)',
        panel: '0 24px 80px rgb(2 6 23 / 0.38)',
      },
    },
  },
  plugins: [],
} satisfies Config;
