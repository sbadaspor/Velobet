// Extensão a colar em tailwind.config.ts (dentro de theme.extend)
// para poderes usar as classes utilitárias diretamente, ex: bg-ink, text-gold, rounded-xl.

const themeExtend = {
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

    gold: 'var(--gold)',
    'gold-strong': 'var(--gold-strong)',
    'gold-ink': 'var(--gold-ink)',

    green: 'var(--green)',
    'green-text': 'var(--green-text)',
    amber: 'var(--amber)',
    'amber-text': 'var(--amber-text)',
    red: 'var(--red)',
    blue: 'var(--blue)',

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
}

export default themeExtend
