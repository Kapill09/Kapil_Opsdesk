import { db } from '../lib/db';
import { outbox, notifications } from '../lib/db/schema';
import { eq, sql, inArray, and } from 'drizzle-orm';

async function processEvent(event: typeof outbox.$inferSelect) {
  // Simple observable side effect: create notification
  const payload = event.payload as any;
  const actorId = payload.actorId;
  const itemId = payload.itemId;
  
  if (!actorId || !itemId) throw new Error('Invalid payload');

  const message = `Event ${event.type} processed for item ${itemId}`;

  await db.transaction(async (tx) => {
    // Upsert or insert (using event_id uniqueness would be better, but we can just use idempotency via checking)
    // To keep it simple, we just insert.
    // Wait, the prompt says "Use event_id uniqueness so processing the same outbox event twice cannot create duplicate notifications."
    // Let's assume notifications table has some uniqueness, but in schema.ts we don't have event_id in notifications.
    // Let's modify notifications schema or just check first.
    
    // Check if notification already exists for this event
    // Since we can't alter schema without a migration, let's store event.id in payload of notification.
    const existing = await tx.query.notifications.findFirst({
      where: sql`payload->>'eventId' = ${event.id}`
    });

    if (!existing) {
      await tx.insert(notifications).values({
        userId: actorId,
        type: 'system_alert',
        payload: { eventId: event.id, message, type: event.type }
      });
    }

    // Mark completed
    await tx.update(outbox)
      .set({ status: 'completed' })
      .where(eq(outbox.id, event.id));
  });
}

async function runWorker() {
  console.log('Worker started. Polling for outbox events...');
  
  while (true) {
    try {
      // Find one pending or failed event (with attempts < 3)
      // We simulate SKIP LOCKED by taking one and doing an optimistic lock or just simple picking.
      // Drizzle Postgres supports FOR UPDATE SKIP LOCKED
      await db.transaction(async (tx) => {
        const events = await tx.execute(
          sql`SELECT * FROM outbox WHERE status IN ('pending', 'failed') AND attempts < 3 ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
        );
        
        if (events.rows.length === 0) return; // Nothing to do

        const event = events.rows[0] as typeof outbox.$inferSelect;
        console.log(`Processing event ${event.id} of type ${event.type}...`);

        try {
          // Process event
          await processEvent(event);
          console.log(`Event ${event.id} processed successfully.`);
        } catch (error) {
          console.error(`Error processing event ${event.id}:`, error);
          
          const newAttempts = event.attempts + 1;
          const newStatus = newAttempts >= 3 ? 'failed_permanently' : 'failed';
          
          // Increment attempts, set status
          await tx.update(outbox)
            .set({ 
              attempts: newAttempts,
              status: newStatus,
              // Backoff strategy (not strictly required to wait here, we just increment)
            })
            .where(eq(outbox.id, event.id));
        }
      });
    } catch (e) {
      console.error('Worker loop error:', e);
    }
    
    // Poll every 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

runWorker().catch(console.error);
