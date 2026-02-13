/**
 * Shared zod schemas for MCP tool input validation
 */

import { z } from 'zod';

export const PlatformSchema = z.enum(['chatgpt', 'claude', 'perplexity', 'gemini', 'generic']);

export const RoleSchema = z.enum(['user', 'assistant', 'system']);

export const DateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Must be a valid ISO 8601 date string' }
);

export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});
