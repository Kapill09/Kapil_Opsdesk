import { db } from '../../lib/db';
import { workItems, itemEvents, users, teams, comments } from '../../lib/db/schema';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createWorkItemSchema, updateWorkItemSchema, paginationQuerySchema, workItemFilterSchema } from '../../lib/validation';

export class WorkItemService {
  static async list(params: z.infer<typeof paginationQuerySchema> & z.infer<typeof workItemFilterSchema>) {
    const { limit, cursor, search, status, priority, type, assigneeId, teamId } = params;

    const conditions = [];

    if (status) conditions.push(eq(workItems.status, status));
    if (priority) conditions.push(eq(workItems.priority, priority));
    if (type) conditions.push(eq(workItems.type, type));
    if (assigneeId) conditions.push(eq(workItems.assigneeId, assigneeId));
    if (teamId) conditions.push(eq(workItems.teamId, teamId));

    if (search) {
      conditions.push(
        or(
          ilike(workItems.title, `%${search}%`),
          ilike(workItems.description, `%${search}%`)
        )
      );
    }

    // Cursor pagination (assuming cursor is a timestamp for simplicity in this milestone)
    // Format: ISO string of created_at. In a real app, it would be base64(created_at, id)
    if (cursor) {
       // A simplistic cursor: created_at less than cursor
       conditions.push(sql`${workItems.createdAt} < ${new Date(cursor).toISOString()}`);
    }

    const items = await db.query.workItems.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(workItems.createdAt)],
      limit: limit + 1, // Fetch one extra to determine if there's a next page
      with: {
        // We would include assignee info if relationships were fully defined in schema
        // For now, we'll fetch basic data
      }
    });

    let nextCursor = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.createdAt.toISOString();
    }

    return { items, nextCursor };
  }

  static async getById(id: string) {
    const item = await db.query.workItems.findFirst({
      where: eq(workItems.id, id),
    });

    if (!item) return null;

    // Fetch related events and comments (to avoid N+1 and keep it simple for now, we do separate batched queries or joins)
    // Actually, drizzle relations make this easier if defined, but we can just query them separately
    const events = await db.query.itemEvents.findMany({
      where: eq(itemEvents.itemId, id),
      orderBy: [desc(itemEvents.createdAt)]
    });

    const itemComments = await db.query.comments.findMany({
      where: eq(comments.itemId, id),
      orderBy: [desc(comments.createdAt)]
    });

    return { ...item, events, comments: itemComments };
  }

  static async create(data: z.infer<typeof createWorkItemSchema>, creatorId: string) {
    return await db.transaction(async (tx) => {
      const [newItem] = await tx.insert(workItems).values({
        teamId: data.teamId,
        title: data.title,
        description: data.description,
        type: data.type,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueAt: data.dueAt ? new Date(data.dueAt) : null,
        createdBy: creatorId,
      }).returning();

      await tx.insert(itemEvents).values({
        itemId: newItem.id,
        actorId: creatorId,
        type: 'created',
        payload: newItem,
      });

      return newItem;
    });
  }

  static async update(id: string, data: z.infer<typeof updateWorkItemSchema>, actorId: string) {
    return await db.transaction(async (tx) => {
      const existing = await tx.query.workItems.findFirst({
        where: eq(workItems.id, id)
      });

      if (!existing) throw new Error('NOT_FOUND');
      
      const { version, ...updateData } = data;
      
      // In a later milestone, we'll handle `version` explicitly for optimistic concurrency.
      // For now, we just update.
      const updatePayload = {
        ...updateData,
        dueAt: updateData.dueAt ? new Date(updateData.dueAt) : undefined,
        updatedAt: new Date(), 
        version: existing.version + 1
      };
      
      const [updatedItem] = await tx.update(workItems)
        .set(updatePayload)
        .where(eq(workItems.id, id))
        .returning();

      await tx.insert(itemEvents).values({
        itemId: id,
        actorId: actorId,
        type: 'updated',
        payload: { before: existing, after: updatedItem },
      });

      return updatedItem;
    });
  }
}
