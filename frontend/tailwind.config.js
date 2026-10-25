/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--surface) / <alpha-value>)',
        raised: 'rgb(var(--surface-2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          strong: 'rgb(var(--accent-strong) / <alpha-value>)',
          fg: 'rgb(var(--accent-fg) / <alpha-value>)',
        },
        lavender: 'rgb(var(--lavender) / <alpha-value>)',
        pop: {
          pink: 'rgb(var(--pink) / <alpha-value>)',
          yellow: 'rgb(var(--yellow) / <alpha-value>)',
        },
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        display: [
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        sans: [
          'Plus Jakarta Sans',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        panel: '0 1px 2px rgb(17 16 24 / 0.03), 0 14px 34px -26px rgb(17 16 24 / 0.28)',
        lift: '0 2px 4px rgb(17 16 24 / 0.04), 0 22px 48px -26px rgb(17 16 24 / 0.3)',
        frame: '0 44px 110px -48px rgb(17 16 24 / 0.38)',
        glow: '0 18px 42px -18px rgb(91 33 232 / 0.55)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        120: '120ms',
        200: '200ms',
        320: '320ms',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        wave: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        bubble: {
          '0%': { transform: 'translateY(0) scale(0.7)', opacity: '0' },
          '15%': { opacity: '0.7' },
          '100%': { transform: 'translateY(-110px) scale(1.25)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-8px) rotate(-1deg)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        wave: 'wave 7s linear infinite',
        'wave-slow': 'wave 11s linear infinite reverse',
        bubble: 'bubble 4.5s ease-in infinite',
        float: 'float 7s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
