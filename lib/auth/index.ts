import { db } from '../db';
import { users, memberships, teams } from '../db/schema';
import { eq } from 'drizzle-orm';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  memberships: Array<{
    teamId: string;
    role: string;
    teamName: string | null;
  }>;
};

// Mock development identity abstraction
// In a real app, this would use NextAuth, Clerk, Auth0, etc.
export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  // Deterministically fetch a specific seeded user as our development user
  let firstUser = await db.query.users.findFirst({
    where: eq(users.email, 'user1@opsdesk.local'),
  });

  if (!firstUser) {
    firstUser = await db.query.users.findFirst({
      orderBy: (users, { asc }) => [asc(users.createdAt)],
    });
  }
  
  if (!firstUser) return null;

  const userMemberships = await db.select({
    teamId: memberships.teamId,
    role: memberships.role,
    teamName: teams.name,
  })
  .from(memberships)
  .leftJoin(teams, eq(memberships.teamId, teams.id))
  .where(eq(memberships.userId, firstUser.id));

  return {
    ...firstUser,
    memberships: userMemberships,
  };
};
