import type { Role } from './enums';

/**
 * Permission vocabulary. Coarse, role-granted capabilities live here; resource-aware
 * rules (ownership, team membership) are expressed as policies below so that
 * project-level roles can be layered on later without changing call sites.
 */
export const PERMISSIONS = [
  'org:manage',
  'member:manage',
  'team:manage',
  'config:manage',
  'audit:read',
  'project:create',
  'project:update',
  'project:delete',
  'milestone:manage',
  'experiment:create',
  'experiment:update',
  'experiment:delete',
  'sample:create',
  'sample:update',
  'comment:create',
  'comment:moderate',
  'attachment:upload',
  'attachment:delete',
  'tag:create',
  'tag:apply',
  'link:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const CONTRIBUTOR: readonly Permission[] = [
  'experiment:create',
  'experiment:update',
  'sample:create',
  'sample:update',
  'comment:create',
  'attachment:upload',
  'attachment:delete',
  'tag:apply',
  'link:manage',
];

const SCIENTIST: readonly Permission[] = [
  ...CONTRIBUTOR,
  'project:create',
  'project:update',
  'project:delete',
  'milestone:manage',
  'experiment:delete',
  'tag:create',
];

const LAB_MANAGER: readonly Permission[] = [
  ...SCIENTIST,
  'team:manage',
  'config:manage',
  'audit:read',
  'comment:moderate',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(PERMISSIONS),
  lab_manager: new Set(LAB_MANAGER),
  scientist: new Set(SCIENTIST),
  researcher: new Set(CONTRIBUTOR),
  viewer: new Set<Permission>(),
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsForRole(role: Role): Permission[] {
  return PERMISSIONS.filter((p) => ROLE_PERMISSIONS[role].has(p));
}

// ---------------------------------------------------------------------------
// Resource policies
// ---------------------------------------------------------------------------

export interface Actor {
  userId: string;
  role: Role;
  teamIds: readonly string[];
}

/** Roles whose edit rights are not limited to records they own. */
const ORG_WIDE_EDITORS: ReadonlySet<Role> = new Set(['admin', 'lab_manager']);

export interface ProjectPolicyTarget {
  ownerId: string;
  teamId: string | null;
}

/** Scientists edit projects they own or that belong to one of their teams. */
export function canEditProject(actor: Actor, project: ProjectPolicyTarget): boolean {
  if (!roleHasPermission(actor.role, 'project:update')) return false;
  if (ORG_WIDE_EDITORS.has(actor.role)) return true;
  return project.ownerId === actor.userId || (project.teamId !== null && actor.teamIds.includes(project.teamId));
}

export function canDeleteProject(actor: Actor, project: ProjectPolicyTarget): boolean {
  if (!roleHasPermission(actor.role, 'project:delete')) return false;
  return ORG_WIDE_EDITORS.has(actor.role) || project.ownerId === actor.userId;
}

/**
 * Handing a project to a new owner passes on the right to delete it, so it takes
 * the same standing as deleting: the current owner or an org-wide editor.
 */
export function canReassignProject(actor: Actor, project: ProjectPolicyTarget): boolean {
  return canEditProject(actor, project) && (ORG_WIDE_EDITORS.has(actor.role) || project.ownerId === actor.userId);
}

/** Milestones follow project edit rights, plus the milestone permission itself. */
export function canManageMilestones(actor: Actor, project: ProjectPolicyTarget): boolean {
  return roleHasPermission(actor.role, 'milestone:manage') && canEditProject(actor, project);
}

export interface ExperimentPolicyTarget {
  researcherId: string;
  createdBy: string | null;
  teamId: string | null;
}

/**
 * Researchers edit experiments they run or created; scientists additionally edit
 * experiments owned by their teams; lab managers and admins edit everything.
 */
export function canEditExperiment(actor: Actor, experiment: ExperimentPolicyTarget): boolean {
  if (!roleHasPermission(actor.role, 'experiment:update')) return false;
  if (ORG_WIDE_EDITORS.has(actor.role)) return true;
  if (experiment.researcherId === actor.userId || experiment.createdBy === actor.userId) return true;
  return actor.role === 'scientist' && experiment.teamId !== null && actor.teamIds.includes(experiment.teamId);
}

export function canDeleteExperiment(actor: Actor, experiment: ExperimentPolicyTarget): boolean {
  if (!roleHasPermission(actor.role, 'experiment:delete')) return false;
  return (
    ORG_WIDE_EDITORS.has(actor.role) ||
    experiment.researcherId === actor.userId ||
    experiment.createdBy === actor.userId
  );
}

/** Reassigning an experiment passes on its delete right, so it needs the standing to delete. */
export function canReassignExperiment(actor: Actor, experiment: ExperimentPolicyTarget): boolean {
  return (
    canEditExperiment(actor, experiment) &&
    (ORG_WIDE_EDITORS.has(actor.role) || experiment.researcherId === actor.userId || experiment.createdBy === actor.userId)
  );
}

/**
 * Uploaders delete their own files; lab managers and admins delete any. Holding
 * `attachment:delete` alone is not enough, since every contributor role has it.
 */
export function canDeleteAttachment(actor: Actor, uploadedBy: string | null): boolean {
  if (!roleHasPermission(actor.role, 'attachment:delete')) return false;
  return ORG_WIDE_EDITORS.has(actor.role) || uploadedBy === actor.userId;
}

/**
 * Authors change their own content while their role still allows writing it;
 * moderators change anyone's. A member demoted to viewer loses the author path.
 */
export function canModifyAuthoredContent(actor: Actor, authorId: string | null, authorPermission: Permission, moderatePermission: Permission): boolean {
  if (authorId === actor.userId && roleHasPermission(actor.role, authorPermission)) return true;
  return roleHasPermission(actor.role, moderatePermission);
}
