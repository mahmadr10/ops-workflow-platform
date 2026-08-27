import OpenAI from 'openai';
import { logger } from '../lib/logger';

/**
 * Provider-agnostic AI layer. Works with any OpenAI-compatible chat completions endpoint:
 * Groq, OpenAI, DeepSeek, Ollama, LM Studio, Qwen, etc. Swap via env vars only, no code change.
 *
 * AI_PROVIDER   - label only, used for logging (e.g. "groq")
 * AI_API_KEY    - provider API key
 * AI_BASE_URL   - OpenAI-compatible base url (Groq: https://api.groq.com/openai/v1)
 * AI_MODEL      - model id (e.g. openai/gpt-oss-120b)
 *
 * If no key is configured the service falls back to deterministic mock output so the rest of
 * the platform (routes, UI, tests) keeps working end to end without a live key.
 */

const apiKey = process.env.AI_API_KEY;
const baseURL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const model = process.env.AI_MODEL || 'openai/gpt-oss-120b';
const provider = process.env.AI_PROVIDER || 'groq';

const client = apiKey ? new OpenAI({ apiKey, baseURL }) : null;

async function complete(system: string, user: string, maxTokens = 500): Promise<string> {
  if (!client) {
    logger.warn('ai_fallback_mock_used_no_api_key');
    return mockCompletion(system, user);
  }
  try {
    const res = await client.chat.completions.create({
      model,
      max_tokens: maxTokens,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || 'No response generated.';
  } catch (err) {
    logger.error({ err, provider }, 'ai_completion_failed');
    return mockCompletion(system, user);
  }
}

function mockCompletion(_system: string, user: string): string {
  return `[AI unavailable - offline fallback] Unable to reach ${provider}. Context received (${user.length} chars). Configure AI_API_KEY to enable live AI output.`;
}

export const aiService = {
  provider,
  model,
  isLive: !!client,

  async summarizeHistory(itemTitle: string, timeline: string[]): Promise<string> {
    return complete(
      'You are an operations analyst. Write a crisp 3-5 sentence professional summary of a work item history for a manager. No fluff, no markdown headers.',
      `Item: "${itemTitle}"\nHistory (oldest to newest):\n${timeline.join('\n')}`
    );
  },

  async dailyStandup(items: { title: string; status: string; assignee: string }[]): Promise<string> {
    const list = items.map((i) => `- ${i.title} [${i.status}] (owner: ${i.assignee})`).join('\n');
    return complete(
      'You are generating a daily standup summary for a team. Group by status, highlight completed work first, keep it concise and professional.',
      `Items updated today:\n${list || 'No items updated today.'}`
    );
  },

  async suggestNextAction(itemTitle: string, status: string, daysInStatus: number, description: string): Promise<string> {
    return complete(
      'You are an operations assistant. Given a stalled work item, suggest ONE concrete next action in a single short sentence, imperative mood (e.g. "Schedule interview with candidate").',
      `Item: "${itemTitle}"\nCurrent status: ${status}\nDays stuck in this status: ${daysInStatus}\nDescription: ${description || 'none'}`,
      80
    );
  },

  async generateTransitionNote(itemTitle: string, fromStatus: string, toStatus: string): Promise<string> {
    return complete(
      'You write short, professional audit notes for status transitions in a workflow system. One or two sentences, factual tone.',
      `Item "${itemTitle}" moved from "${fromStatus}" to "${toStatus}". Write the note.`,
      100
    );
  },

  async executiveSummary(stats: Record<string, unknown>): Promise<string> {
    return complete(
      'You are a COO writing an executive summary from operational metrics. 4-6 sentences, business tone, call out risks and wins.',
      `Metrics: ${JSON.stringify(stats)}`,
      500
    );
  },

  computeRiskScore(daysInStatus: number, priority: string, isOverdue: boolean): number {
    let score = Math.min(60, daysInStatus * 6);
    if (priority === 'CRITICAL') score += 25;
    if (priority === 'HIGH') score += 15;
    if (isOverdue) score += 20;
    return Math.min(100, score);
  },
};
