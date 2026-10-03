import { NextRequest } from 'next/server';
import { db } from '../../../lib/db';
import { workItems } from '../../../lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { getCurrentUser } from '../../../lib/auth';
import { AuthError } from '../../../lib/authorization';
import { handleAPIError } from '../../../lib/errors';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Unauthorized');

    const allowedTeamIds = user.memberships.map(m => m.teamId);
    const isGlobalAdmin = user.memberships.some(m => m.role === 'admin');

    // Base condition
    const baseCondition = !isGlobalAdmin && allowedTeamIds.length > 0 
      ? inArray(workItems.teamId, allowedTeamIds) 
      : undefined;

    if (!isGlobalAdmin && allowedTeamIds.length === 0) {
      return Response.json({
        total: 0, open: 0, highCritical: 0, needsAttention: 0
      });
    }

    // Since we don't have a complex grouping right now, we can do multiple queries or one query
    const [totalItems, openItems, highCritItems, attentionItems] = await Promise.all([
      db.query.workItems.findMany({ where: baseCondition }),
      db.query.workItems.findMany({ where: and(baseCondition, eq(workItems.status, 'open')) }),
      db.query.workItems.findMany({ where: and(baseCondition, inArray(workItems.priority, ['high', 'critical'])) }),
      db.query.workItems.findMany({ where: and(baseCondition, eq(workItems.status, 'in_progress')) }), // arbitrary needs attention logic
    ]);

    return Response.json({
      total: totalItems.length,
      open: openItems.length,
      highCritical: highCritItems.length,
      needsAttention: attentionItems.length,
    });
  } catch (error) {
    return handleAPIError(error);
  }
}
