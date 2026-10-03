import { z } from 'zod';

export const idSchema = z.object({
  id: z.string().uuid(),
});

export const workItemTypeEnum = z.enum([
  'customer_issue',
  'engineering_problem',
  'payment_investigation',
  'production_incident',
  'compliance_request',
  'operational_task',
]);

export const workItemStatusEnum = z.enum([
  'open',
  'in_progress',
  'blocked',
  'resolved',
  'closed',
]);

export const workItemPriorityEnum = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

export const createWorkItemSchema = z.object({
  teamId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().min(1, "Description is required").max(10000),
  type: workItemTypeEnum,
  status: workItemStatusEnum.default('open'),
  priority: workItemPriorityEnum.default('medium'),
  assigneeId: z.string().uuid().optional().nullable(),
  dueAt: z.string().datetime().optional().nullable(),
});

export const updateWorkItemSchema = createWorkItemSchema.partial().extend({
  version: z.number().int().min(1).optional(), // for optimistic concurrency later
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000),
});

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const workItemFilterSchema = z.object({
  search: z.string().optional(),
  status: workItemStatusEnum.optional(),
  priority: workItemPriorityEnum.optional(),
  type: workItemTypeEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
});
