/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        highlight: 'var(--highlight)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        hair: 'var(--hair)',
        line: 'var(--line)',
        band: 'var(--band)',
        bandraised: 'var(--band-raised)',
        bandink: 'var(--band-ink)',
        podium: 'var(--podium-first)',
        podiumink: 'var(--podium-first-ink)',
        accent: 'var(--accent)',
        onaccent: 'var(--on-accent)',
        accentink: 'var(--accent-ink)',
        danger: 'var(--danger)',
        ondanger: 'var(--on-danger)',
        tintwarn: 'var(--tint-warn)',
        tintok: 'var(--tint-ok)',
      },
      fontFamily: {
        display: ['"Baloo 2"', 'ui-rounded', 'system-ui', 'sans-serif'],
        body: ['Barlow', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: 'var(--shadow)',
      },
    },
  },
  plugins: [],
};
