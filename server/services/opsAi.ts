/**
 * Ops AI Retrieval & Orchestration Service
 *
 * Retrieves work-item context from PostgreSQL, constructs a structured
 * prompt context, calls the LLM provider, and returns a grounded answer
 * with validated source citations.
 *
 * Context limits (configurable):
 *   - Description: 3000 chars
 *   - Comments: last 20
 *   - Events: last 30
 */

import { db } from '../../lib/db';
import { workItems, comments, itemEvents } from '../../lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { CurrentUser } from '../../lib/auth';
import { authorize } from '../../lib/authorization';
import { APIError } from '../../lib/errors';
import { generateCompletion, isLLMConfigured, LLMProviderError } from '../ai/provider';
import { OPS_AI_SYSTEM_PROMPT, buildUserMessage } from '../ai/prompt';

// ─── Constants ───────────────────────────────────────────────────

const MAX_DESCRIPTION_CHARS = 3000;
const MAX_COMMENTS = 20;
const MAX_EVENTS = 30;

// ─── Types ───────────────────────────────────────────────────────

export interface ContextSource {
  id: string;        // e.g. "WI", "COMMENT-3", "EVENT-5"
  type: 'work_item' | 'comment' | 'event';
  summary: string;   // human-readable label
}

export interface OpsAiResponse {
  answer: string;
  sources: ContextSource[];
}

// ─── Retrieval ───────────────────────────────────────────────────

/**
 * Retrieve authorised work-item context for RAG.
 *
 * Steps:
 * 1. Load work item and verify it exists
 * 2. Authorize the current user (reuses existing RBAC)
 * 3. Load bounded comments and events
 * 4. Return structured context with stable source IDs
 */
export async function retrieveWorkItemContext(
  workItemId: string,
  _query: string,
  user: CurrentUser,
): Promise<{ contextText: string; sources: ContextSource[] }> {
  // 1. Load work item
  const item = await db.query.workItems.findFirst({
    where: eq(workItems.id, workItemId),
  });

  if (!item) {
    throw new APIError(404, 'Work item not found');
  }

  // 2. Authorize — reuses the existing RBAC layer
  authorize(user, 'view', { teamId: item.teamId });

  // 3. Load bounded comments (most recent first)
  const itemComments = await db
    .select({
      id: comments.id,
      content: comments.content,
      authorId: comments.authorId,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(eq(comments.itemId, workItemId))
    .orderBy(desc(comments.createdAt))
    .limit(MAX_COMMENTS);

  // 4. Load bounded events (most recent first)
  const events = await db
    .select({
      id: itemEvents.id,
      type: itemEvents.type,
      actorId: itemEvents.actorId,
      fromValue: itemEvents.fromValue,
      toValue: itemEvents.toValue,
      createdAt: itemEvents.createdAt,
    })
    .from(itemEvents)
    .where(eq(itemEvents.itemId, workItemId))
    .orderBy(desc(itemEvents.createdAt))
    .limit(MAX_EVENTS);

  // 5. Build structured context with stable source IDs
  const sources: ContextSource[] = [];

  // --- Work item metadata (always WI) ---
  const description = item.description.length > MAX_DESCRIPTION_CHARS
    ? item.description.slice(0, MAX_DESCRIPTION_CHARS) + '…'
    : item.description;

  sources.push({ id: 'WI', type: 'work_item', summary: `Work item: ${item.title}` });

  let contextText = `[WI] WORK ITEM
Title: ${item.title}
Type: ${item.type.replace('_', ' ')}
Status: ${item.status.replace('_', ' ')}
Priority: ${item.priority}
Assignee ID: ${item.assigneeId ?? 'unassigned'}
Created: ${item.createdAt.toISOString()}
Updated: ${item.updatedAt.toISOString()}
Description:
${description}
`;

  // --- Comments ---
  // Reverse so oldest-first in context (chronological reading order)
  const sortedComments = [...itemComments].reverse();
  if (sortedComments.length > 0) {
    contextText += '\nCOMMENTS\n';
    sortedComments.forEach((c, idx) => {
      const sourceId = `COMMENT-${idx + 1}`;
      sources.push({ id: sourceId, type: 'comment', summary: `Comment by ${c.authorId}` });
      contextText += `[${sourceId}] Author: ${c.authorId} | Date: ${c.createdAt.toISOString()}\n${c.content}\n\n`;
    });
  }

  // --- Events ---
  const sortedEvents = [...events].reverse();
  if (sortedEvents.length > 0) {
    contextText += 'ACTIVITY\n';
    sortedEvents.forEach((e, idx) => {
      const sourceId = `EVENT-${idx + 1}`;
      const change = e.fromValue && e.toValue ? ` (${e.fromValue} → ${e.toValue})` : '';
      sources.push({ id: sourceId, type: 'event', summary: `${e.type}${change}` });
      contextText += `[${sourceId}] Actor: ${e.actorId} | Date: ${e.createdAt.toISOString()} | Action: ${e.type}${change}\n`;
    });
  }

  return { contextText, sources };
}

// ─── Answer Generation ───────────────────────────────────────────

/**
 * Full Ops AI pipeline:
 *   retrieve → context construction → LLM → citation validation → response
 */
export async function askOpsAi(
  workItemId: string,
  question: string,
  user: CurrentUser,
): Promise<OpsAiResponse> {
  // 1. Check LLM availability early
  if (!isLLMConfigured()) {
    throw new LLMProviderError(
      'Ops AI is not configured. Set LLM_API_KEY environment variable.',
      503,
      false,
    );
  }

  // 2. Retrieve context (includes auth check)
  const { contextText, sources } = await retrieveWorkItemContext(workItemId, question, user);

  // 3. Build messages
  const userMessage = buildUserMessage(contextText, question);

  // 4. Call LLM
  const llmResponse = await generateCompletion({
    messages: [
      { role: 'system', content: OPS_AI_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    maxTokens: 1024,
  });

  // 5. Extract cited source IDs from the answer
  const validSourceIds = new Set(sources.map(s => s.id));
  const citedPattern = /\[([A-Z]+-?\d*)\]/g;
  const citedIds = new Set<string>();
  let match;
  while ((match = citedPattern.exec(llmResponse.content)) !== null) {
    if (validSourceIds.has(match[1])) {
      citedIds.add(match[1]);
    }
    // Invalid citations are silently ignored (not displayed as fake sources)
  }

  // 6. Return only sources that were actually cited and exist
  const citedSources = sources.filter(s => citedIds.has(s.id));

  return {
    answer: llmResponse.content,
    sources: citedSources,
  };
}
