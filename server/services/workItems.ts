import { db } from '../../lib/db';
import { workItems, itemEvents, users, teams, comments, outbox, idempotencyKeys } from '../../lib/db/schema';
import { eq, desc, ilike, or, and, sql, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { createWorkItemSchema, updateWorkItemSchema, paginationQuerySchema, workItemFilterSchema } from '../../lib/validation';
import { CurrentUser } from '../../lib/auth';
import { authorize } from '../../lib/authorization';
import { APIError } from '../../lib/errors';

export class WorkItemService {
  static async list(params: z.infer<typeof paginationQuerySchema> & z.infer<typeof workItemFilterSchema>, user: CurrentUser) {
    const { limit, cursor, search, status, priority, type, assigneeId, teamId } = params;

    const conditions = [];

    // Base authorization: restrict to teams the user is a member of (unless admin)
    const isGlobalAdmin = user.memberships.some(m => m.role === 'admin');
    if (!isGlobalAdmin) {
      const allowedTeamIds = user.memberships.map(m => m.teamId);
      if (allowedTeamIds.length === 0) {
        // Not in any teams and not admin -> returns empty
        return { items: [], nextCursor: undefined };
      }
      conditions.push(inArray(workItems.teamId, allowedTeamIds));
    }

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

    // Cursor pagination using deterministic compound cursor (createdAt + id)
    if (cursor) {
       try {
         const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
         conditions.push(
           or(
             sql`${workItems.createdAt} < ${new Date(parsed.createdAt).toISOString()}`,
             and(
               eq(workItems.createdAt, new Date(parsed.createdAt)),
               sql`${workItems.id} <= ${parsed.id}`
             )
           )
         );
       } catch (e) {
         // ignore invalid cursor
       }
    }

    const items = await db.query.workItems.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(workItems.createdAt), desc(workItems.id)],
      limit: limit + 1, // Fetch one extra to determine if there's a next page
    });

    let nextCursor = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = Buffer.from(JSON.stringify({ createdAt: nextItem?.createdAt, id: nextItem?.id })).toString('base64');
    }

    return { items, nextCursor };
  }

  static async getById(id: string, user: CurrentUser) {
    const item = await db.query.workItems.findFirst({
      where: eq(workItems.id, id),
    });

    if (!item) return null;

    authorize(user, 'view', { teamId: item.teamId });

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

  static async create(data: z.infer<typeof createWorkItemSchema>, user: CurrentUser, idempotencyKey?: string) {
    authorize(user, 'create', { teamId: data.teamId });
    const creatorId = user.id;

    return await db.transaction(async (tx) => {
      if (idempotencyKey) {
        const existingKey = await tx.query.idempotencyKeys.findFirst({
          where: and(eq(idempotencyKeys.key, idempotencyKey), eq(idempotencyKeys.userId, user.id))
        });
        if (existingKey) return existingKey.response;
      }
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

      await tx.insert(outbox).values({
        type: 'item_created',
        payload: { itemId: newItem.id, actorId: creatorId },
      });

      if (idempotencyKey) {
        await tx.insert(idempotencyKeys).values({
          key: idempotencyKey,
          userId: user.id,
          requestHash: 'create',
          response: newItem,
        });
      }

      return newItem;
    });
  }

  static async update(id: string, data: z.infer<typeof updateWorkItemSchema>, user: CurrentUser, idempotencyKey?: string) {
    if (data.version === undefined) throw new APIError(400, 'Version is required');
    
    return await db.transaction(async (tx) => {
      if (idempotencyKey) {
        const existingKey = await tx.query.idempotencyKeys.findFirst({
          where: and(eq(idempotencyKeys.key, idempotencyKey), eq(idempotencyKeys.userId, user.id))
        });
        if (existingKey) return existingKey.response;
      }

      const existing = await tx.query.workItems.findFirst({
        where: eq(workItems.id, id)
      });

      if (!existing) throw new APIError(404, 'NOT_FOUND');
      
      authorize(user, 'update', { teamId: existing.teamId });
      
      const { version, ...updateData } = data;
      
      const updatePayload = {
        ...updateData,
        dueAt: updateData.dueAt ? new Date(updateData.dueAt) : undefined,
        updatedAt: new Date(), 
        version: sql`${workItems.version} + 1`
      };
      
      const updatedItems = await tx.update(workItems)
        .set(updatePayload)
        .where(and(eq(workItems.id, id), eq(workItems.version, version!)))
        .returning();

      if (updatedItems.length === 0) {
        throw new APIError(409, 'VERSION_CONFLICT', { 
          message: 'Work item has changed. Refresh and retry.', 
          currentVersion: existing.version 
        });
      }
      
      const updatedItem = updatedItems[0];

      await tx.insert(itemEvents).values({
        itemId: id,
        actorId: user.id,
        type: 'updated',
        payload: { before: existing, after: updatedItem },
      });

      await tx.insert(outbox).values({
        type: 'item_updated',
        payload: { itemId: id, actorId: user.id },
      });

      if (idempotencyKey) {
        await tx.insert(idempotencyKeys).values({
          key: idempotencyKey,
          userId: user.id,
          requestHash: 'update',
          response: updatedItem,
        });
      }

      return updatedItem;
    });
  }

  static async claim(id: string, user: CurrentUser, idempotencyKey?: string) {
    return await db.transaction(async (tx) => {
      if (idempotencyKey) {
        const insertResult = await tx.insert(idempotencyKeys)
          .values({ key: idempotencyKey, userId: user.id, requestHash: 'claim' })
          .onConflictDoNothing()
          .returning({ key: idempotencyKeys.key });

        if (insertResult.length === 0) {
          const existingKey = await tx.query.idempotencyKeys.findFirst({
            where: and(eq(idempotencyKeys.key, idempotencyKey), eq(idempotencyKeys.userId, user.id))
          });
          if (existingKey?.response) return existingKey.response;
          throw new APIError(409, 'CONCURRENT_REQUEST', { message: 'Duplicate request is processing.' });
        }
      }

      const existing = await tx.query.workItems.findFirst({ where: eq(workItems.id, id) });
      if (!existing) throw new APIError(404, 'NOT_FOUND');
      authorize(user, 'update', { teamId: existing.teamId }); 

      const updatedItems = await tx.update(workItems)
        .set({
          assigneeId: user.id,
          version: sql`${workItems.version} + 1`,
          updatedAt: new Date()
        })
        .where(and(eq(workItems.id, id), sql`${workItems.assigneeId} IS NULL`))
        .returning();

      if (updatedItems.length === 0) {
        const current = await tx.query.workItems.findFirst({ where: eq(workItems.id, id) });
        if (current?.assigneeId) {
          throw new APIError(409, 'ALREADY_CLAIMED', { message: 'Work item is already claimed.' });
        }
        throw new APIError(409, 'VERSION_CONFLICT', { message: 'Work item was changed concurrently.' });
      }
      
      const updatedItem = updatedItems[0];

      await tx.insert(itemEvents).values({
        itemId: id,
        actorId: user.id,
        type: 'claimed',
        payload: { assigneeId: user.id },
      });

      await tx.insert(outbox).values({
        type: 'item_claimed',
        payload: { itemId: id, actorId: user.id },
      });

      if (idempotencyKey) {
        await tx.update(idempotencyKeys)
          .set({ response: updatedItem })
          .where(eq(idempotencyKeys.key, idempotencyKey));
      }

      return updatedItem;
    });
  }
}
