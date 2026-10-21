/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Obsidian + champagne-gold design tokens. Components use these names,
      // never raw hex, so the palette can be retuned in one place.
      colors: {
        ink: '#0B0B0C', // application background
        rail: '#101011', // sidebar
        panel: '#151515', // main panels
        raised: '#1B1A18', // elevated surfaces, hover rows
        well: '#111111', // inset fields and canvases
        line: {
          DEFAULT: '#302D27',
          soft: '#232120',
          strong: '#47423A',
        },
        gold: {
          DEFAULT: '#C9A45C',
          muted: '#A88746',
          champagne: '#E5D2A0',
        },
        fg: {
          DEFAULT: '#E8E5DE',
          soft: '#CAC6BD',
          muted: '#9A978F',
          faint: '#827F77',
        },
        ok: '#8DB58A',
        warn: '#D29A4E',
        bad: '#D27C72',
      },
      fontFamily: {
        sans: [
          'Inter',
          '"Segoe UI"',
          'system-ui',
          '-apple-system',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"Cascadia Mono"',
          'Consolas',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
    },
  },
  plugins: [],
}
