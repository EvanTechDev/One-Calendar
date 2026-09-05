/**
 * Lowers eve tool definitions to AI SDK tools so one authored tool set runs
 * in both runtimes (see tools.ts for why the authoring surface is eve's).
 *
 * eve's PublicToolDefinitionWithExecuteFn and the AI SDK's Tool agree on
 * `description`, `inputSchema` (zod is a Standard Schema, accepted by both)
 * and `execute(input, options)` — the lowering is a cast plus an error
 * boundary. The error boundary matters: a thrown tool error would otherwise
 * abort the whole stream, and the model can usually recover if it is told
 * what went wrong instead.
 */
import { tool, type Tool, type ToolSet } from 'ai'
import type { z } from 'zod'

interface EveToolLike {
  description: string
  inputSchema: z.ZodType
  execute: (input: never, options: never) => unknown
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export interface ToAiToolsOptions {
  /**
   * Tools that must pause for human confirmation before executing (the AI
   * SDK's needsApproval flow). The palette renders approve/deny buttons on
   * the `approval-requested` part state.
   */
  needsApproval?: readonly string[]
}

export function toAiTools(
  eveTools: Record<string, EveToolLike>,
  options: ToAiToolsOptions = {},
): ToolSet {
  const approvalSet = new Set(options.needsApproval ?? [])
  const out: Record<string, Tool> = {}
  for (const [name, def] of Object.entries(eveTools)) {
    out[name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      ...(approvalSet.has(name) ? { needsApproval: true } : {}),
      execute: async (input, options) => {
        try {
          return await def.execute(input as never, options as never)
        } catch (error) {
          return { error: errorMessage(error) }
        }
      },
    })
  }
  return out
}
