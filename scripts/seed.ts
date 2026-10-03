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
  workItemTypeEnum,
  workItemStatusEnum,
  workItemPriorityEnum
} from '../lib/db/schema';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function seed() {
  console.log('Seeding development data...');

  // 1. Teams
  const teamData = [
    { id: randomUUID(), name: 'Platform Engineering' },
    { id: randomUUID(), name: 'Customer Success' },
    { id: randomUUID(), name: 'Security & Compliance' },
  ];
  
  await db.insert(teams).values(teamData).onConflictDoNothing();
  
  // 2. Users
  const usersData = Array.from({ length: 15 }).map((_, i) => ({
    id: randomUUID(),
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
    id: randomUUID(),
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
      id: randomUUID(),
      itemId: wi.id,
      actorId: wi.createdBy,
      type: 'created',
      payload: wi,
    });

    if (i % 3 === 0) {
      const commentId = randomUUID();
      commentsData.push({
        id: commentId,
        itemId: wi.id,
        authorId: usersData[i % 15].id,
        content: `Looking into this issue now.`,
      });
      eventsData.push({
        id: randomUUID(),
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
