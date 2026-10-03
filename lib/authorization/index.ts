import { CurrentUser } from '../auth';

export type Action = 'view' | 'create' | 'update' | 'comment' | 'assign' | 'manage';
export type Resource = { teamId: string };

export const can = (user: CurrentUser | null, action: Action, resource: Resource): boolean => {
  if (!user) return false;
  
  // Admin can access/manage all teams and work items
  const isGlobalAdmin = user.memberships.some(m => m.role === 'admin');
  if (isGlobalAdmin) return true;

  // Find user's role in the specific resource's team
  const membership = user.memberships.find(m => m.teamId === resource.teamId);
  if (!membership) return false;

  const { role } = membership; 
  
  if (role === 'lead') {
    // Lead can do member actions plus assign work items and manage workflow fields
    return true;
  }
  
  if (role === 'member') {
    // Member permissions
    if (['view', 'create', 'update', 'comment'].includes(action)) return true;
    return false; // Cannot arbitrarily assign or manage team-level operational work
  }
  
  return false;
};

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export const authorize = (user: CurrentUser | null, action: Action, resource: Resource) => {
  if (!user) throw new AuthError(401, 'Unauthorized');
  if (!can(user, action, resource)) throw new AuthError(403, 'Forbidden');
};
