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
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
      },
      fontFamily: {
        display: ['Newsreader', 'Iowan Old Style', 'Georgia', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgb(0 0 0 / 0.04), 0 12px 32px -20px rgb(0 0 0 / 0.35)',
        lift: '0 2px 4px rgb(0 0 0 / 0.05), 0 20px 40px -24px rgb(0 0 0 / 0.45)',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        120: '120ms',
        200: '200ms',
        320: '320ms',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        wave: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        sheen: {
          '0%': { transform: 'translateX(0) skewX(-12deg)', opacity: '0' },
          '15%': { opacity: '0.9' },
          '100%': { transform: 'translateX(420%) skewX(-12deg)', opacity: '0' },
        },
        bubble: {
          '0%': { transform: 'translateY(0) scale(0.7)', opacity: '0' },
          '15%': { opacity: '0.7' },
          '100%': { transform: 'translateY(-110px) scale(1.25)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 320ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        wave: 'wave 7s linear infinite',
        'wave-slow': 'wave 11s linear infinite reverse',
        sheen: 'sheen 900ms ease-out',
        bubble: 'bubble 4.5s ease-in infinite',
      },
    },
  },
  plugins: [],
};
