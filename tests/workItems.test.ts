import { describe, it, expect } from 'vitest';
import { WorkItemService } from '../server/services/workItems';
import { CommentService } from '../server/services/comments';
import { db } from '../lib/db';
import { users, teams, workItems } from '../lib/db/schema';
import { randomUUID } from 'crypto';

describe('Work Items & Comments Integration', () => {
  it('creates a work item, persists it, and creates an activity event', async () => {
    // 1. Setup a test team and user
    const teamId = randomUUID();
    const userId = randomUUID();
    await db.insert(teams).values({ id: teamId, name: 'Test Team' });
    await db.insert(users).values({ id: userId, name: 'Test User', email: `${userId}@test.com` });

    // 2. Create the work item
    const itemData = {
      teamId,
      title: 'Test Issue',
      description: 'Something is broken',
      type: 'engineering_problem' as const,
      status: 'open' as const,
      priority: 'high' as const,
    };

    const newItem = await WorkItemService.create(itemData, userId);

    expect(newItem).toBeDefined();
    expect(newItem.id).toBeTypeOf('string');
    expect(newItem.title).toBe('Test Issue');

    // 3. Verify it's persisted by fetching it
    const fetched = await WorkItemService.getById(newItem.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.title).toBe('Test Issue');

    // 4. Verify activity event was created
    expect(fetched!.events).toHaveLength(1);
    expect(fetched!.events[0].type).toBe('created');
    expect(fetched!.events[0].actorId).toBe(userId);
  });

  it('adding a comment creates a comment and a corresponding activity event', async () => {
    // We assume the previous test created a team/user we can recreate or just make new ones
    const teamId = randomUUID();
    const userId = randomUUID();
    await db.insert(teams).values({ id: teamId, name: 'Test Team 2' });
    await db.insert(users).values({ id: userId, name: 'Test User 2', email: `${userId}@test.com` });

    const newItem = await WorkItemService.create({
      teamId,
      title: 'Test Issue For Comment',
      description: 'Need comments',
      type: 'operational_task',
      status: 'open',
      priority: 'low',
    }, userId);

    // Add comment
    const comment = await CommentService.create(newItem.id, userId, { content: 'My first comment' });
    
    expect(comment.id).toBeTypeOf('string');
    expect(comment.content).toBe('My first comment');

    // Fetch item to verify events
    const fetched = await WorkItemService.getById(newItem.id);
    expect(fetched!.comments).toHaveLength(1);
    expect(fetched!.events).toHaveLength(2); // 1 for created, 1 for comment_added
    
    const commentEvent = fetched!.events.find(e => e.type === 'comment_added');
    expect(commentEvent).toBeDefined();
  });

  it('pagination returns a next cursor when more data exists', async () => {
    // List with a limit of 1
    const result = await WorkItemService.list({ limit: 1 });
    
    expect(Array.isArray(result.items)).toBe(true);
    // If the DB has more than 1 item (which it should from seed or tests), nextCursor is defined
    if (result.items.length === 1) {
      // It might be undefined if DB only has exactly 1 item, but we ran seed, so it should have more.
      expect(result.nextCursor).toBeDefined();
    }
  });

  it('requesting a nonexistent work item returns appropriate error or null', async () => {
    const fakeId = randomUUID();
    const result = await WorkItemService.getById(fakeId);
    expect(result).toBeNull();
  });
});
