import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        border: 'var(--border)',
        'border-hi': 'var(--border-hi)',

        text: 'var(--text)',
        'text-dim': 'var(--text-dim)',
        'text-sub': 'var(--text-sub)',
        'text-muted': 'var(--text-muted)',

        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'on-ink': 'var(--on-ink)',
        'on-ink-dim': 'var(--on-ink-dim)',
        'on-ink-sub': 'var(--on-ink-sub)',
        'on-ink-border': 'var(--on-ink-border)',

        gold: 'var(--gold)',
        'gold-strong': 'var(--gold-strong)',
        'gold-ink': 'var(--gold-ink)',

        green: 'var(--green)',
        'green-text': 'var(--green-text)',
        amber: 'var(--amber)',
        'amber-text': 'var(--amber-text)',
        red: 'var(--red)',
        blue: 'var(--blue)',
        'blue-text': 'var(--blue-text)',

        'medal-1': 'var(--medal-1)',
        'medal-2': 'var(--medal-2)',
        'medal-3': 'var(--medal-3)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
