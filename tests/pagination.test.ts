import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../lib/db';
import { users, teams, memberships, workItems } from '../lib/db/schema';
import { WorkItemService } from '../server/services/workItems';

describe('Compound Cursor Pagination', () => {
  let user: any, team: any;

  beforeAll(async () => {
    const r = Math.random().toString();
    [user] = await db.insert(users).values({ name: 'Page User', email: `page-${r}@test.com` }).returning();
    [team] = await db.insert(teams).values({ name: `Team Page ${r}` }).returning();
    await db.insert(memberships).values([{ userId: user.id, teamId: team.id, role: 'member' }]);
  });

  const getMockUser = () => ({
    id: user.id,
    name: user.name,
    email: user.email,
    memberships: [{ teamId: team.id, role: 'member', teamName: team.name }]
  });

  it('Paginated list accurately breaks ties when multiple records share the same createdAt', async () => {
    // Insert 5 items with EXACTLY the same createdAt
    const now = new Date();
    
    await db.insert(workItems).values([
      { teamId: team.id, title: 'Item 1', description: 'desc', type: 'operational_task', createdBy: user.id, createdAt: now, updatedAt: now },
      { teamId: team.id, title: 'Item 2', description: 'desc', type: 'operational_task', createdBy: user.id, createdAt: now, updatedAt: now },
      { teamId: team.id, title: 'Item 3', description: 'desc', type: 'operational_task', createdBy: user.id, createdAt: now, updatedAt: now },
      { teamId: team.id, title: 'Item 4', description: 'desc', type: 'operational_task', createdBy: user.id, createdAt: now, updatedAt: now },
      { teamId: team.id, title: 'Item 5', description: 'desc', type: 'operational_task', createdBy: user.id, createdAt: now, updatedAt: now },
    ]);

    // Fetch page 1 (limit 2)
    const page1 = await WorkItemService.list({ limit: 2, teamId: team.id }, getMockUser());

    expect(page1.items.length).toBe(2);
    expect(page1.nextCursor).toBeTruthy();

    // Fetch page 2 (limit 2)
    const page2 = await WorkItemService.list({ limit: 2, cursor: page1.nextCursor, teamId: team.id }, getMockUser());

    expect(page2.items.length).toBe(2);
    expect(page2.nextCursor).toBeTruthy();

    // Fetch page 3 (limit 2)
    const page3 = await WorkItemService.list({ limit: 2, cursor: page2.nextCursor, teamId: team.id }, getMockUser());

    expect(page3.items.length).toBe(1); // 5 total, so 1 left
    expect(page3.nextCursor).toBeUndefined();

    // Verify all 5 unique items were fetched (no dupes)
    const allIds = new Set([...page1.items, ...page2.items, ...page3.items].map(i => i.id));
    expect(allIds.size).toBe(5);
  });
});
