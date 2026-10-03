import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  jsonb,
  boolean,
  unique,
  primaryKey,
  pgEnum,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const workItemTypeEnum = pgEnum('work_item_type', [
  'customer_issue',
  'engineering_problem',
  'payment_investigation',
  'production_incident',
  'compliance_request',
  'operational_task',
]);

export const workItemStatusEnum = pgEnum('work_item_status', [
  'open',
  'in_progress',
  'blocked',
  'resolved',
  'closed',
]);

export const workItemPriorityEnum = pgEnum('work_item_priority', [
  'low',
  'medium',
  'high',
  'critical',
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const memberships = pgTable('memberships', {
  userId: uuid('user_id').references(() => users.id).notNull(),
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // member, lead, admin
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.teamId] })
  }
});

export const workItems = pgTable('work_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  type: workItemTypeEnum('type').notNull(),
  status: workItemStatusEnum('status').default('open').notNull(),
  priority: workItemPriorityEnum('priority').default('medium').notNull(),
  assigneeId: uuid('assignee_id').references(() => users.id),
  dueAt: timestamp('due_at'),
  version: integer('version').default(1).notNull(), // Optimistic concurrency version
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    teamIdIdx: index('work_items_team_id_idx').on(table.teamId),
    statusIdx: index('work_items_status_idx').on(table.status),
    priorityIdx: index('work_items_priority_idx').on(table.priority),
    assigneeIdIdx: index('work_items_assignee_id_idx').on(table.assigneeId),
    createdAtIdx: index('work_items_created_at_idx').on(table.createdAt),
    updatedAtIdx: index('work_items_updated_at_idx').on(table.updatedAt),
  };
});

export const itemEvents = pgTable('item_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => workItems.id).notNull(),
  actorId: uuid('actor_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  fromValue: varchar('from_value', { length: 255 }),
  toValue: varchar('to_value', { length: 255 }),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').references(() => workItems.id).notNull(),
  authorId: uuid('author_id').references(() => users.id).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: varchar('key', { length: 255 }).primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  requestHash: varchar('request_hash', { length: 255 }).notNull(),
  response: jsonb('response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const outbox = pgTable('outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  runAt: timestamp('run_at').defaultNow().notNull(),
  lockedAt: timestamp('locked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  payload: jsonb('payload').notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
