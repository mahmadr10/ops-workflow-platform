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
 *
 * Reasoning models (gpt-oss, qwen3, etc.) spend part of the token budget on an internal
 * "reasoning" pass before writing the visible answer, separate from `message.content`. If
 * `max_tokens` is too small the visible answer gets cut off mid-sentence even though the request
 * technically succeeded (finish_reason: "length"). Every call below budgets generously and logs
 * a warning if a response is ever truncated, so this fails loudly instead of shipping half a
 * sentence to a user.
 */

const apiKey = process.env.AI_API_KEY;
const baseURL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const model = process.env.AI_MODEL || 'openai/gpt-oss-120b';
const provider = process.env.AI_PROVIDER || 'groq';

const client = apiKey ? new OpenAI({ apiKey, baseURL }) : null;

async function complete(system: string, user: string, maxTokens = 900): Promise<string> {
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
    const choice = res.choices[0];
    if (choice?.finish_reason === 'length') {
      logger.warn({ maxTokens, provider }, 'ai_response_truncated_increase_max_tokens');
    }
    return choice?.message?.content?.trim() || 'No response generated.';
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
      'You are an operations analyst. Write a crisp 3-5 sentence professional summary of a work item history for a manager. Plain conversational text only, no markdown formatting of any kind (no asterisks, headers, backticks, or tables), this is displayed as plain text with no markdown rendering.',
      `Item: "${itemTitle}"\nHistory (oldest to newest):\n${timeline.join('\n')}`,
      600
    );
  },

  async dailyStandup(items: { title: string; status: string; assignee: string }[]): Promise<string> {
    const capped = items.slice(0, 40);
    const list = capped.map((i) => `- ${i.title} [${i.status}] (owner: ${i.assignee})`).join('\n');
    return complete(
      'You are generating a daily standup summary for a team. Highlight completed work first, then call out what is in progress and anything blocked, keep it concise and professional, a short digest for someone skimming it, not an exhaustive list. If there are many items, group similar statuses together and summarize with counts (e.g. "6 items moved into Review") instead of naming every single one. Plain conversational text only, no markdown formatting of any kind (no asterisks, headers, backticks, or tables), this is displayed as plain text with no markdown rendering.',
      `Items updated today (${capped.length} of ${items.length}):\n${list || 'No items updated today.'}`,
      1300
    );
  },

  async suggestNextAction(itemTitle: string, status: string, daysInStatus: number, description: string): Promise<string> {
    return complete(
      'You are an operations assistant. Given a stalled work item, suggest ONE concrete next action in a single short sentence, imperative mood (e.g. "Schedule interview with candidate"). Output only that sentence, nothing else, no markdown formatting.',
      `Item: "${itemTitle}"\nCurrent status: ${status}\nDays stuck in this status: ${daysInStatus}\nDescription: ${description || 'none'}`,
      300
    );
  },

  async generateTransitionNote(itemTitle: string, fromStatus: string, toStatus: string): Promise<string> {
    return complete(
      'You write short, professional audit notes for status transitions in a workflow system. One or two sentences, factual tone. Output only the note, nothing else, no markdown formatting.',
      `Item "${itemTitle}" moved from "${fromStatus}" to "${toStatus}". Write the note.`,
      300
    );
  },

  async executiveSummary(stats: Record<string, unknown>): Promise<string> {
    return complete(
      'You are a COO writing an executive summary from operational metrics. 4-6 sentences, business tone, call out risks and wins. Plain conversational text only, no markdown formatting of any kind (no asterisks, headers, backticks, or tables), this is displayed as plain text with no markdown rendering.',
      `Metrics: ${JSON.stringify(stats)}`,
      900
    );
  },

  // AI chatbot: answers natural-language questions about live operational data
  // (e.g. "Which candidates have been waiting the longest?") AND general company knowledge.
  // Access is department-walled: `scopeLabel` tells the model (in plain words) which
  // department's operational data it was given, so it never leaks another department's records
  // to a user who shouldn't see them. Company knowledge is always available to everyone.
  async answerOperationalQuestion(
    question: string,
    dataSnapshot: string,
    companyKnowledge: string,
    scopeLabel: string
  ): Promise<string> {
    return complete(
      `You are the internal AI assistant for DigitalSofts' operations platform. You have two knowledge sources: (1) general company knowledge, available to everyone, and (2) live operational data, which is restricted to this user's own department: ${scopeLabel}. Answer using ONLY what is given below, never invent items, people, numbers, or company facts. If the question asks about operational data from a different department than the one provided, say plainly that you can only see that user's own department's data and don't answer it. General company questions (services, products, offices, leadership) can always be answered from the company knowledge section. Be concise and use specific names/numbers when they're available. Reply in plain conversational text only, this is displayed in a narrow chat bubble with no markdown rendering: never use asterisks for bold/italic, never use markdown tables or pipe characters, never use headings or backticks. For lists, use a plain hyphen and a line break per item, nothing else.`,
      `=== General company knowledge (always available) ===\n${companyKnowledge}\n\n=== Live operational data (scope: ${scopeLabel}) ===\n${dataSnapshot}\n\nQuestion: ${question}`,
      900
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
