import type { Config } from 'tailwindcss'
import { emerald } from 'tailwindcss/colors'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        // Theme-aware colours. The components keep writing the dark-theme
        // classes they always used (`bg-zinc-950`, `text-white`,
        // `text-emerald-400`…); globals.css maps each one to a CSS variable
        // whose value flips for the light theme. So one class works in both
        // themes, and `/90`-style opacity modifiers keep working.
        zinc: Object.fromEntries(
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [
            n,
            `rgb(var(--zinc-${n}) / <alpha-value>)`,
          ])
        ),
        white: 'rgb(var(--white) / <alpha-value>)',
        emerald: {
          ...emerald,
          // Text accents only. Button backgrounds (600/700) stay fixed, so
          // white button text works in both themes.
          300: 'rgb(var(--emerald-300) / <alpha-value>)',
          400: 'rgb(var(--emerald-400) / <alpha-value>)',
          500: 'rgb(var(--emerald-500) / <alpha-value>)',
        },
        // Text on the green buttons: always white, unlike `white` above.
        'on-accent': '#ffffff',
        // Akavish brand
        akavish: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#0c1a2e',
          950: '#060d1a',
        },
      },
    },
  },
  plugins: [],
}

export default config
