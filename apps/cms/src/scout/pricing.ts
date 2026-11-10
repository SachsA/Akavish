// ─── Cost of an AI call ──────────────────────────────────────────────────────
// Pure. Public API prices in USD per million tokens (platform.claude.com,
// checked 2026-11-09). Haiku 5.5 doubles past 100k prompt tokens; the scout's
// prompts stay far below that. An unknown model is priced like the most
// expensive one listed, so a typo in SCOUT_TRIAGE_MODEL can't hide spending.

interface Price {
  input: number
  output: number
}

const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
}

const FALLBACK: Price = { input: 5, output: 25 }

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES[model] ?? FALLBACK
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}
