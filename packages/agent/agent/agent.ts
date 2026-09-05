/**
 * eve agent config for the standalone runtime (`eve dev` / `eve build`
 * from packages/agent). The in-app command palette does NOT go through
 * this — it uses /api/agent/chat, which lowers the same tool definitions
 * (src/tools.ts) onto the AI SDK directly. This file exists so the agent
 * is also a first-class eve app: inspectable with `eve info`, runnable
 * with `eve dev`, deployable on Vercel.
 *
 * Model: Groq's OpenAI-compatible endpoint. eve resolves string models
 * through the AI Gateway by default, so we hand it a provider-authored
 * LanguageModel instance instead — that keeps the free Groq key working
 * without a gateway account.
 */
import { defineAgent } from 'eve'
import { createGroq } from '@ai-sdk/groq'

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY ?? '',
})

export default defineAgent({
  model: groq(process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'),
  limits: {
    // A calendar session is a handful of short tool calls, not an
    // open-ended coding session. Groq's free tier is also rate-limited,
    // so bound the token budget well below eve's 40M default.
    maxInputTokensPerSession: 2_000_000,
  },
})
