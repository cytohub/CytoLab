import { afterAll, describe, expect, it } from 'vitest';
import { closeDb, db } from '../../src/server/db/client';
import { auditLog } from '../../src/server/db/schema';
import { createProject } from '../../src/server/modules/projects/service';
import { createExperiment } from '../../src/server/modules/experiments/mutations';
import { indexUsers } from '../../src/server/modules/search/indexers';
import { search } from '../../src/server/modules/search/service';
import { createWorkspace, type TestWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

/** The append-only trigger raises with insufficient_privilege and an "append-only" message. */
function isAppendOnlyError(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown })?.cause];
  return candidates.some((e) => {
    if (!e || typeof e !== 'object') return false;
    const { code, message } = e as { code?: string; message?: string };
    return code === '42501' || /append-only/i.test(message ?? '');
  });
}

function newExperiment(ws: TestWorkspace, projectId: string, researcherId: string, name: string) {
  return { projectId, experimentTypeId: ws.typeId, name, objective: null, hypothesis: null, researcherId, teamId: null, status: 'planned' as const, priority: 'medium' as const, startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] as string[] };
}

describe('search (integration)', () => {
  it('indexes projects and experiments and finds them, scoped by org', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    await db().transaction((tx) => indexUsers(tx, ws.orgId)); // index the seeded user

    const project = await createProject(admin, { name: 'Lentiviral Vector Program', code: 'LVP-1', ownerId: admin.userId, status: 'active', priority: 'high', description: 'transduction platform', researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null });
    await createExperiment(admin, newExperiment(ws, project.id, admin.userId, 'CD19 transduction titration'));

    const byName = await search(admin, { q: 'transduction', types: undefined, limit: 8 });
    const titles = byName.groups.flatMap((g) => g.hits.map((h) => h.title));
    expect(titles.some((t) => /transduction/i.test(t))).toBe(true);

    // Display-ID / code exact match ranks the project.
    const byCode = await search(admin, { q: 'LVP-1', types: undefined, limit: 8 });
    expect(byCode.groups.some((g) => g.type === 'project' && g.hits.some((h) => h.title.includes('Lentiviral')))).toBe(true);

    // A second organization sees none of it.
    const other = await createWorkspace();
    const otherAdmin = await other.addUser('admin');
    const isolated = await search(otherAdmin, { q: 'transduction', types: undefined, limit: 8 });
    expect(isolated.total).toBe(0);
  });
});

describe('audit log immutability (integration)', () => {
  it('rejects UPDATE and DELETE on the append-only audit log', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    await createProject(admin, { name: 'Audit', code: 'AUD-1', ownerId: admin.userId, status: 'active', priority: 'low', description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null });

    await expect(db().update(auditLog).set({ action: 'tampered' })).rejects.toSatisfy(isAppendOnlyError);
    await expect(db().delete(auditLog)).rejects.toSatisfy(isAppendOnlyError);
  });
});
