/**
 * CCR provider adapter.
 *
 * Reuses Claude session storage and message shapes, but normalizes the provider
 * field as `ccr` so the UI can keep the runtime path distinct from plain Claude.
 * @module adapters/ccr
 */

import { getSessionMessages } from '../../projects.js';
import { createNormalizedMessage, generateMessageId } from '../types.js';
import { isInternalContent } from '../utils.js';

const PROVIDER = 'ccr';

export function normalizeMessage(raw, sessionId) {
  if (raw.type === 'content_block_delta' && raw.delta?.text) {
    return [createNormalizedMessage({ kind: 'stream_delta', content: raw.delta.text, sessionId, provider: PROVIDER })];
  }
  if (raw.type === 'content_block_stop') {
    return [createNormalizedMessage({ kind: 'stream_end', sessionId, provider: PROVIDER })];
  }

  const messages = [];
  const ts = raw.timestamp || new Date().toISOString();
  const baseId = raw.uuid || generateMessageId('ccr');

  if (raw.message?.role === 'user' && raw.message?.content) {
    if (Array.isArray(raw.message.content)) {
      for (const part of raw.message.content) {
        if (part.type === 'tool_result') {
          messages.push(createNormalizedMessage({
            id: `${baseId}_tr_${part.tool_use_id}`,
            sessionId,
            timestamp: ts,
            provider: PROVIDER,
            kind: 'tool_result',
            toolId: part.tool_use_id,
            content: typeof part.content === 'string' ? part.content : JSON.stringify(part.content),
            isError: Boolean(part.is_error),
            subagentTools: raw.subagentTools,
            toolUseResult: raw.toolUseResult,
          }));
        } else if (part.type === 'text') {
          const text = part.text || '';
          if (text && !isInternalContent(text)) {
            messages.push(createNormalizedMessage({
              id: `${baseId}_text`,
              sessionId,
              timestamp: ts,
              provider: PROVIDER,
              kind: 'text',
              role: 'user',
              content: text,
            }));
          }
        }
      }
      return messages;
    }

    messages.push(createNormalizedMessage({
      id: baseId,
      sessionId,
      timestamp: ts,
      provider: PROVIDER,
      kind: 'text',
      role: 'user',
      content: raw.message.content,
    }));
    return messages;
  }

  if (raw.type === 'tool_use' && raw.toolName) {
    messages.push(createNormalizedMessage({
      id: baseId,
      sessionId,
      timestamp: ts,
      provider: PROVIDER,
      kind: 'tool_use',
      toolName: raw.toolName,
      toolInput: raw.toolInput,
      toolId: raw.toolCallId || baseId,
    }));
    return messages;
  }

  if (raw.type === 'tool_result') {
    messages.push(createNormalizedMessage({
      id: baseId,
      sessionId,
      timestamp: ts,
      provider: PROVIDER,
      kind: 'tool_result',
      toolId: raw.toolCallId || '',
      content: raw.output || '',
      isError: false,
    }));
    return messages;
  }

  if (raw.message?.role === 'assistant' && raw.message?.content) {
    if (Array.isArray(raw.message.content)) {
      let partIndex = 0;
      for (const part of raw.message.content) {
        if (part.type === 'text' && part.text) {
          messages.push(createNormalizedMessage({
            id: `${baseId}_${partIndex}`,
            sessionId,
            timestamp: ts,
            provider: PROVIDER,
            kind: 'text',
            role: 'assistant',
            content: part.text,
          }));
        } else if (part.type === 'tool_use') {
          messages.push(createNormalizedMessage({
            id: `${baseId}_${partIndex}`,
            sessionId,
            timestamp: ts,
            provider: PROVIDER,
            kind: 'tool_use',
            toolName: part.name,
            toolInput: part.input,
            toolId: part.id,
          }));
        } else if (part.type === 'thinking' && part.thinking) {
          messages.push(createNormalizedMessage({
            id: `${baseId}_${partIndex}`,
            sessionId,
            timestamp: ts,
            provider: PROVIDER,
            kind: 'thinking',
            content: part.thinking,
          }));
        }
        partIndex++;
      }
    } else if (typeof raw.message.content === 'string') {
      messages.push(createNormalizedMessage({
        id: baseId,
        sessionId,
        timestamp: ts,
        provider: PROVIDER,
        kind: 'text',
        role: 'assistant',
        content: raw.message.content,
      }));
    }
    return messages;
  }

  return messages;
}

export const ccrAdapter = {
  normalizeMessage,

  async fetchHistory(sessionId, opts = {}) {
    const { projectName, limit = null, offset = 0 } = opts;
    if (!projectName) {
      return { messages: [], total: 0, hasMore: false, offset: 0, limit: null };
    }

    let result;
    try {
      result = await getSessionMessages(projectName, sessionId, { limit, offset });
    } catch (error) {
      console.error(`Failed to fetch CCR history for session ${sessionId}:`, error);
      return { messages: [], total: 0, hasMore: false, offset, limit };
    }

    const normalized = [];
    for (const raw of result.messages || []) {
      normalized.push(...normalizeMessage(raw, sessionId));
    }

    return {
      messages: normalized,
      total: result.total || normalized.length,
      hasMore: Boolean(result.hasMore),
      offset,
      limit,
      tokenUsage: result.tokenUsage,
    };
  },
};
