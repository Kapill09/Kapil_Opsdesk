import { describe, it, expect } from 'vitest';
import { can, authorize, AuthError } from '../lib/authorization';

describe('Authorization Rules', () => {
  const memberUser = {
    id: 'user-1',
    name: 'Member User',
    email: 'member@test.com',
    memberships: [{ teamId: 'team-a', role: 'member', teamName: 'Team A' }]
  };

  const leadUser = {
    id: 'user-2',
    name: 'Lead User',
    email: 'lead@test.com',
    memberships: [{ teamId: 'team-a', role: 'lead', teamName: 'Team A' }]
  };

  const adminUser = {
    id: 'user-3',
    name: 'Admin User',
    email: 'admin@test.com',
    memberships: [{ teamId: 'admin-team', role: 'admin', teamName: 'Admin Team' }]
  };

  const otherTeamResource = { teamId: 'team-b' };
  const teamAResource = { teamId: 'team-a' };

  it('1. User can access a work item belonging to their team', () => {
    expect(can(memberUser, 'view', teamAResource)).toBe(true);
    expect(can(memberUser, 'update', teamAResource)).toBe(true);
  });

  it('2. User cannot access a work item belonging to another team', () => {
    expect(can(memberUser, 'view', otherTeamResource)).toBe(false);
  });

  it('3. Member cannot perform a lead/admin-only action', () => {
    expect(can(memberUser, 'manage', teamAResource)).toBe(false);
    expect(can(memberUser, 'assign', teamAResource)).toBe(false);
  });

  it('4. Lead can perform allowed team-level action', () => {
    expect(can(leadUser, 'manage', teamAResource)).toBe(true);
    expect(can(leadUser, 'assign', teamAResource)).toBe(true);
    expect(can(leadUser, 'view', teamAResource)).toBe(true);
  });

  it('5. Admin can access another team\'s work', () => {
    expect(can(adminUser, 'view', teamAResource)).toBe(true);
    expect(can(adminUser, 'manage', otherTeamResource)).toBe(true);
  });

  it('6 & 7. Unauthorized mutation/comment creation is rejected by authorize', () => {
    expect(() => authorize(memberUser, 'comment', otherTeamResource)).toThrow(AuthError);
    expect(() => authorize(memberUser, 'update', otherTeamResource)).toThrow(AuthError);
  });
});
