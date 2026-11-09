// ─── Theme ───────────────────────────────────────────────────────────────────
// The web's dark palette (Tailwind zinc + emerald), so the app and the site
// look like the same brand. The app is dark only (`userInterfaceStyle: dark`
// in app.json); the web's light theme isn't mirrored here.

export const colors = {
  background: '#09090b', // zinc-950
  surface: '#18181b', // zinc-900
  border: '#27272a', // zinc-800
  text: '#ffffff',
  body: '#d4d4d8', // zinc-300, article text
  muted: '#a1a1aa', // zinc-400: 7.8:1 on the background, fine for small text
  accent: '#34d399', // emerald-400, links and badges
  onAccent: '#022c22', // text on an emerald button
  danger: '#f87171', // red-400
} as const

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const
