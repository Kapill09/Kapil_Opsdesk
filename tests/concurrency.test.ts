import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../lib/db';
import { users, teams, memberships, workItems, idempotencyKeys, itemEvents } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import { WorkItemService } from '../server/services/workItems';
import crypto from 'crypto';

describe('Concurrency & Idempotency', () => {
  let user1: typeof users.$inferSelect, user2: typeof users.$inferSelect, team: typeof teams.$inferSelect;

  beforeAll(async () => {
    const r1 = Math.random().toString();
    const r2 = Math.random().toString();
    // Setup test users and team
    [user1] = await db.insert(users).values({ name: 'User 1', email: `u1-${r1}@test.com` }).returning();
    [user2] = await db.insert(users).values({ name: 'User 2', email: `u2-${r2}@test.com` }).returning();
    [team] = await db.insert(teams).values({ name: `Team C ${r1}` }).returning();
    
    await db.insert(memberships).values([
      { userId: user1.id, teamId: team.id, role: 'member' },
      { userId: user2.id, teamId: team.id, role: 'member' }
    ]);
  });

  afterAll(async () => {
    // Teardown is done by global reset or simply ignored for these tests 
  });

  const getMockUser = (user: typeof users.$inferSelect) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    memberships: [{ teamId: team.id, role: 'member', teamName: team.name }]
  });

  it('Optimistic Concurrency: Update increments version and stale update returns 409', async () => {
    const item = await WorkItemService.create({
      teamId: team.id,
      title: 'Concurrency Test',
      description: 'Desc',
      type: 'operational_task',
      priority: 'medium',
      status: 'open'
    }, getMockUser(user1));

    expect(item.version).toBe(1);

    // User A updates it
    const updated = await WorkItemService.update(item.id, {
      version: 1,
      status: 'in_progress',
    }, getMockUser(user1));

    expect(updated.version).toBe(2);
    expect(updated.status).toBe('in_progress');

    // User B tries to update with stale version 1
    await expect(
      WorkItemService.update(item.id, {
        version: 1,
        status: 'blocked',
      }, getMockUser(user2))
    ).rejects.toThrowError('VERSION_CONFLICT');

    // Verify it wasn't changed
    const current = await db.query.workItems.findFirst({ where: eq(workItems.id, item.id) });
    expect(current?.version).toBe(2);
    expect(current?.status).toBe('in_progress');
  });

  it('Concurrent Claim: Only one succeeds, other fails', async () => {
    const item = await WorkItemService.create({
      teamId: team.id,
      title: 'Claim Test',
      description: 'Desc',
      type: 'operational_task',
      priority: 'medium',
      status: 'open'
    }, getMockUser(user1));

    // Simulate concurrent claim
    const results = await Promise.allSettled([
      WorkItemService.claim(item.id, getMockUser(user1)),
      WorkItemService.claim(item.id, getMockUser(user2)),
    ]);

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    if (rejected[0].status === 'rejected') {
      expect(rejected[0].reason.message).toBe('ALREADY_CLAIMED');
    }

    const current = await db.query.workItems.findFirst({ where: eq(workItems.id, item.id) });
    expect(current?.assigneeId).toBeTruthy();
  });

  it('Idempotency: Same key submitted twice produces one effect', async () => {
    const item = await WorkItemService.create({
      teamId: team.id,
      title: 'Idempotency Test',
      description: 'Desc',
      type: 'operational_task',
      priority: 'medium',
      status: 'open'
    }, getMockUser(user1));

    const idempotencyKey = crypto.randomUUID();

    // Concurrent duplicate request
    const results = await Promise.all([
      WorkItemService.claim(item.id, getMockUser(user1), idempotencyKey),
      WorkItemService.claim(item.id, getMockUser(user1), idempotencyKey),
    ]);

    expect(results[0].id).toBe(results[1].id);
    expect(results[0].assigneeId).toBe(user1.id);

    // Verify only ONE claim event was created
    const events = await db.query.itemEvents.findMany({
      where: eq(itemEvents.itemId, item.id)
    });
    
    const claimEvents = events.filter(e => e.type === 'claimed');
    expect(claimEvents.length).toBe(1);

    const keys = await db.query.idempotencyKeys.findMany({
      where: eq(idempotencyKeys.key, idempotencyKey)
    });
    expect(keys.length).toBe(1);
  });
});
