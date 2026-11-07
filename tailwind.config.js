/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        hair: 'var(--hair)',
        band: 'var(--band)',
        bandink: 'var(--band-ink)',
        ball: 'var(--ball)',
        ballink: 'var(--ball-ink)',
        sea: 'var(--sea)',
        sun: 'var(--sun)',
        court: 'var(--court)',
        win: 'var(--win)',
        danger: 'var(--danger)',
        ok: 'var(--ok)',
        tintwarn: 'var(--tint-warn)',
        tintok: 'var(--tint-ok)',
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', '"Arial Narrow"', 'Impact', 'sans-serif'],
        body: ['Barlow', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
    },
  },
  plugins: [],
};
