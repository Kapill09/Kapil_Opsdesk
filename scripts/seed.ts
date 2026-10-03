import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { db } from '../lib/db';
import { 
  users, 
  teams, 
  memberships, 
  workItems, 
  itemEvents, 
  comments,
  notifications,
  outbox,
  idempotencyKeys,
  workItemTypeEnum,
  workItemStatusEnum,
  workItemPriorityEnum
} from '../lib/db/schema';
import { sql } from 'drizzle-orm';

function getDeterministicId(prefix: string, index: number) {
  const hexPrefix = prefix === 'team' ? '11111111' :
                    prefix === 'user' ? '22222222' :
                    prefix === 'item' ? '33333333' :
                    prefix === 'cmnt' ? '44444444' :
                    prefix === 'evnt' ? '55555555' : '00000000';
  return `${hexPrefix}-0000-4000-a000-${String(index).padStart(12, '0')}`;
}

async function seed() {
  console.log('Seeding development data...');
  
  // Clear existing data to ensure clean deterministic run
  await db.delete(notifications);
  await db.delete(outbox);
  await db.delete(itemEvents);
  await db.delete(comments);
  await db.delete(idempotencyKeys);
  await db.delete(workItems);
  await db.delete(memberships);
  await db.delete(users);
  await db.delete(teams);

  // 1. Teams
  const teamData = [
    { id: getDeterministicId('team', 1), name: 'Platform Engineering' },
    { id: getDeterministicId('team', 2), name: 'Customer Success' },
    { id: getDeterministicId('team', 3), name: 'Security & Compliance' },
  ];
  
  await db.insert(teams).values(teamData).onConflictDoNothing();
  
  // 2. Users
  const usersData = Array.from({ length: 15 }).map((_, i) => ({
    id: getDeterministicId('user', i),
    name: `User ${i + 1}`,
    email: `user${i + 1}@opsdesk.local`,
  }));

  await db.insert(users).values(usersData).onConflictDoNothing();

  // 3. Memberships
  const membershipsData = usersData.map((u, i) => ({
    userId: u.id,
    teamId: teamData[i % 3].id,
    role: i % 5 === 0 ? 'lead' : 'member',
  }));

  await db.insert(memberships).values(membershipsData).onConflictDoNothing();

  // 4. Work Items
  const sampleTitles = [
    'Payment failure investigation',
    'Customer unable to complete checkout',
    'Production API latency spike',
    'Compliance document request',
    'Failed refund investigation',
    'Engineering bug in invoice generation',
    'Database connection pool alert',
    'Review updated terms of service',
    'Investigate missing webhook events',
    'Scale up background workers',
  ];

  const types = [
    'customer_issue', 'engineering_problem', 'payment_investigation', 
    'production_incident', 'compliance_request', 'operational_task'
  ] as const;

  const statuses = ['open', 'in_progress', 'blocked', 'resolved', 'closed'] as const;
  const priorities = ['low', 'medium', 'high', 'critical'] as const;

  const workItemsData = Array.from({ length: 40 }).map((_, i) => ({
    id: getDeterministicId('item', i),
    teamId: teamData[i % 3].id,
    title: sampleTitles[i % sampleTitles.length] + ` #${i}`,
    description: `Detailed description for ${sampleTitles[i % sampleTitles.length]}...`,
    type: types[i % types.length],
    status: statuses[i % statuses.length],
    priority: priorities[i % priorities.length],
    assigneeId: i % 2 === 0 ? usersData[i % 15].id : null,
    createdBy: usersData[(i + 1) % 15].id,
    version: 1,
  }));

  await db.insert(workItems).values(workItemsData).onConflictDoNothing();

  // 5. Comments & Events
  const commentsData: any[] = [];
  const eventsData: any[] = [];

  workItemsData.forEach((wi, i) => {
    // Initial creation event
    eventsData.push({
      id: getDeterministicId('evnt', i * 2),
      itemId: wi.id,
      actorId: wi.createdBy,
      type: 'created',
      payload: wi,
    });

    if (i % 3 === 0) {
      const commentId = getDeterministicId('cmnt', i);
      commentsData.push({
        id: commentId,
        itemId: wi.id,
        authorId: usersData[i % 15].id,
        content: `Looking into this issue now.`,
      });
      eventsData.push({
        id: getDeterministicId('evnt', i * 2 + 1),
        itemId: wi.id,
        actorId: usersData[i % 15].id,
        type: 'comment_added',
        payload: { commentId },
      });
    }
  });

  if (commentsData.length > 0) {
    await db.insert(comments).values(commentsData).onConflictDoNothing();
  }
  
  if (eventsData.length > 0) {
    await db.insert(itemEvents).values(eventsData).onConflictDoNothing();
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
