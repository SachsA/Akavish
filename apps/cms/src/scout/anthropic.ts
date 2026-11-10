// ─── Claude API (Messages) ───────────────────────────────────────────────────
// Plain fetch, no SDK: one call shape is all the scout needs. The answer is
// forced through a tool (`tool_choice`), so it comes back as JSON matching a
// schema instead of prose to parse.

export interface ToolCallResult<T> {
  input: T
  inputTokens: number
  outputTokens: number
  model: string
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export async function callTool<T>(args: {
  apiKey: string
  model: string
  system: string
  prompt: string
  tool: { name: string; description: string; input_schema: Record<string, unknown> }
  maxTokens?: number
  fetchImpl?: FetchLike
}): Promise<ToolCallResult<T>> {
  const res = await (args.fetchImpl ?? fetch)('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': args.apiKey,
      // The long-standing version: its response shape (content blocks, usage)
      // is the one this file reads. Newer versions exist (2026-10-21); move
      // when a feature needs it.
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: args.maxTokens ?? 4096,
      system: args.system,
      tools: [args.tool],
      tool_choice: { type: 'tool', name: args.tool.name },
      messages: [{ role: 'user', content: args.prompt }],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    throw new Error(`Claude API ${res.status}: ${detail}`)
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
    model?: string
  }
  const block = data.content?.find((b) => b.type === 'tool_use' && b.name === args.tool.name)
  if (!block) throw new Error('Claude API: no tool call in the answer')
  const u = data.usage ?? {}
  return {
    input: block.input as T,
    // Cache writes and reads counted at the full input price: the estimate
    // errs on the high side, which is the safe side for a budget cap.
    inputTokens:
      (u.input_tokens ?? 0) +
      (u.cache_creation_input_tokens ?? 0) +
      (u.cache_read_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
    model: args.model,
  }
}
