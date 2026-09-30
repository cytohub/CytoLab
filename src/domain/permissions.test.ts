import { describe, expect, it } from 'vitest';
import {
  canDeleteAttachment,
  canDeleteProject,
  canEditExperiment,
  canEditProject,
  permissionsForRole,
  roleHasPermission,
  type Actor,
} from './permissions';

const actor = (over: Partial<Actor>): Actor => ({ userId: 'u1', role: 'researcher', teamIds: [], ...over });

describe('role permissions', () => {
  it('gives admins every permission and viewers none', () => {
    expect(roleHasPermission('admin', 'org:manage')).toBe(true);
    expect(permissionsForRole('viewer')).toHaveLength(0);
  });

  it('lets researchers create experiments but not projects', () => {
    expect(roleHasPermission('researcher', 'experiment:create')).toBe(true);
    expect(roleHasPermission('researcher', 'project:create')).toBe(false);
  });

  it('lets scientists create and manage projects', () => {
    expect(roleHasPermission('scientist', 'project:create')).toBe(true);
    expect(roleHasPermission('scientist', 'milestone:manage')).toBe(true);
  });
});

describe('project policies', () => {
  const project = { ownerId: 'owner', teamId: 'teamA' };

  it('lets org-wide editors edit any project', () => {
    expect(canEditProject(actor({ role: 'lab_manager' }), project)).toBe(true);
    expect(canEditProject(actor({ role: 'admin' }), project)).toBe(true);
  });

  it('lets a scientist edit projects they own or that belong to their team', () => {
    expect(canEditProject(actor({ role: 'scientist', userId: 'owner' }), project)).toBe(true);
    expect(canEditProject(actor({ role: 'scientist', teamIds: ['teamA'] }), project)).toBe(true);
    expect(canEditProject(actor({ role: 'scientist', userId: 'other', teamIds: ['teamB'] }), project)).toBe(false);
  });

  it('does not let researchers edit projects at all', () => {
    expect(canEditProject(actor({ role: 'researcher', userId: 'owner' }), project)).toBe(false);
  });

  it('only lets owners or org-wide editors delete', () => {
    expect(canDeleteProject(actor({ role: 'scientist', userId: 'owner' }), project)).toBe(true);
    expect(canDeleteProject(actor({ role: 'scientist', userId: 'other', teamIds: ['teamA'] }), project)).toBe(false);
  });
});

describe('experiment policies', () => {
  const experiment = { researcherId: 'r1', createdBy: 'c1', teamId: 'teamA' };

  it('lets the assigned researcher or creator edit', () => {
    expect(canEditExperiment(actor({ userId: 'r1' }), experiment)).toBe(true);
    expect(canEditExperiment(actor({ userId: 'c1' }), experiment)).toBe(true);
    expect(canEditExperiment(actor({ userId: 'other' }), experiment)).toBe(false);
  });

  it('lets a scientist on the owning team edit', () => {
    expect(canEditExperiment(actor({ role: 'scientist', userId: 'other', teamIds: ['teamA'] }), experiment)).toBe(true);
    expect(canEditExperiment(actor({ role: 'scientist', userId: 'other', teamIds: ['teamB'] }), experiment)).toBe(false);
  });

  it('lets lab managers and admins edit any experiment', () => {
    expect(canEditExperiment(actor({ role: 'lab_manager', userId: 'other' }), experiment)).toBe(true);
  });
});

describe('attachment policies', () => {
  it('lets uploaders delete their own files', () => {
    expect(canDeleteAttachment(actor({ role: 'researcher', userId: 'u1' }), 'u1')).toBe(true);
    expect(canDeleteAttachment(actor({ role: 'scientist', userId: 'u1' }), 'u1')).toBe(true);
  });

  it('stops contributors deleting files someone else uploaded', () => {
    expect(canDeleteAttachment(actor({ role: 'researcher', userId: 'u1' }), 'u2')).toBe(false);
    expect(canDeleteAttachment(actor({ role: 'scientist', userId: 'u1' }), 'u2')).toBe(false);
    expect(canDeleteAttachment(actor({ role: 'researcher', userId: 'u1' }), null)).toBe(false);
  });

  it('lets lab managers and admins delete any file', () => {
    expect(canDeleteAttachment(actor({ role: 'lab_manager', userId: 'u1' }), 'u2')).toBe(true);
    expect(canDeleteAttachment(actor({ role: 'admin', userId: 'u1' }), null)).toBe(true);
  });

  it('never lets viewers delete, even their own past uploads', () => {
    expect(canDeleteAttachment(actor({ role: 'viewer', userId: 'u1' }), 'u1')).toBe(false);
  });
});
