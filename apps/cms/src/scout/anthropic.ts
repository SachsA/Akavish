// ─── Claude API (Messages) ───────────────────────────────────────────────────
// Plain fetch, no SDK: one call shape is all the scout needs. The answer comes
// back through a tool, as JSON matching a schema instead of prose to parse.
//
// Forcing the tool (`tool_choice: tool`) is the reliable way, but some models
// refuse it (Claude Sonnet 5.5 answers 400 "tool_choice: type tool and any are
// not supported for this model"). For those, the call is made with
// `tool_choice: auto`, an explicit instruction to answer only through the tool,
// and up-front thinking off (`between_tools`, the model's way to say "no
// thinking"), so cost and latency stay those of a plain answer. A model that
// refused once is remembered for the life of the process.

export interface ToolCallResult<T> {
  input: T
  inputTokens: number
  outputTokens: number
  model: string
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

const noForcedTool = new Set<string>()

/** Whether a 400 body is the "forced tool_choice not supported" refusal. */
export function isForcedToolRefusal(status: number, body: string): boolean {
  return status === 400 && /tool_choice/.test(body) && /not supported/.test(body)
}

/** For tests: forget which models refused a forced tool. */
export function resetToolModes() {
  noForcedTool.clear()
}

export async function callTool<T>(args: {
  apiKey: string
  model: string
  system: string
  prompt: string
  tool: { name: string; description: string; input_schema: Record<string, unknown> }
  maxTokens?: number
  fetchImpl?: FetchLike
}): Promise<ToolCallResult<T>> {
  const forced = !noForcedTool.has(args.model)
  const body = forced
    ? {
        system: args.system,
        tool_choice: { type: 'tool', name: args.tool.name },
      }
    : {
        system: `${args.system}\n\nAnswer only by calling the ${args.tool.name} tool, exactly once, with no text before or after.`,
        tool_choice: { type: 'auto' },
        thinking: { type: 'between_tools' },
      }
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
      tools: [args.tool],
      ...body,
      messages: [{ role: 'user', content: args.prompt }],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300)
    if (forced && isForcedToolRefusal(res.status, detail)) {
      noForcedTool.add(args.model)
      return callTool<T>(args)
    }
    throw new Error(`Claude API ${res.status}: ${detail}`)
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown; text?: string }>
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
    model?: string
  }
  const block = data.content?.find((b) => b.type === 'tool_use' && b.name === args.tool.name)
  if (!block) {
    const text = data.content?.find((b) => b.type === 'text')?.text?.slice(0, 150)
    throw new Error(`Claude API: no tool call in the answer${text ? ` ("${text}")` : ''}`)
  }
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
