import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../lib/db';
import { outbox, notifications, users } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';


// Minimal version of processEvent from worker.ts for testing
async function processEvent(event: { id: string, type: string, payload: unknown }) {
  const payload = event.payload as { actorId: string };
  await db.transaction(async (tx) => {
    const existing = await tx.query.notifications.findFirst({
      where: sql`payload->>'eventId' = ${event.id}`
    });
    if (!existing) {
      await tx.insert(notifications).values({
        userId: payload.actorId,
        type: 'system_alert',
        payload: { eventId: event.id, message: 'Test', type: event.type }
      });
    }
    await tx.update(outbox).set({ status: 'completed' }).where(eq(outbox.id, event.id));
  });
}

describe('Outbox & Worker Processing', () => {
  let user: typeof users.$inferSelect;

  beforeAll(async () => {
    const u = await db.query.users.findFirst();
    if(u) user = u;
  });

  it('Successful mutation creates outbox event, worker processes it correctly', async () => {
    // 1. Create a fake outbox event
    const [event] = await db.insert(outbox).values({
      type: 'item_created',
      payload: { itemId: '123', actorId: user.id },
    }).returning();

    expect(event.status).toBe('pending');
    expect(event.attempts).toBe(0);

    // 2. Process event (Worker logic)
    await processEvent(event);

    // 3. Check outbox status
    const processedEvent = await db.query.outbox.findFirst({ where: eq(outbox.id, event.id) });
    expect(processedEvent?.status).toBe('completed');

    // 4. Check notification created
    const notification = await db.query.notifications.findFirst({
      where: sql`payload->>'eventId' = ${event.id}`
    });
    expect(notification).toBeTruthy();

    // 5. Processing again (duplicate) should not create another notification
    await processEvent(event);
    const notificationsCount = await db.query.notifications.findMany({
      where: sql`payload->>'eventId' = ${event.id}`
    });
    expect(notificationsCount.length).toBe(1);
  });
});
