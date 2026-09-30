import { afterAll, describe, expect, it } from 'vitest';
import { closeDb, db } from '../../src/server/db/client';
import { auditLog } from '../../src/server/db/schema';
import { createProject } from '../../src/server/modules/projects/service';
import { createExperiment } from '../../src/server/modules/experiments/mutations';
import { indexUsers } from '../../src/server/modules/search/indexers';
import { search } from '../../src/server/modules/search/service';
import { toPrefixQuery } from '../../src/server/platform/search-index';
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

  it('treats a hyphenated term as a finished word ("CAR-T" does not match "Cardiac")', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    const base = { ownerId: admin.userId, status: 'active' as const, priority: 'medium' as const, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null };
    await createProject(admin, { ...base, name: 'CAR-T Cell Engineering', code: 'CART-9', description: 'CD19-directed constructs' });
    await createProject(admin, { ...base, name: 'Cardiac Tissue Engineering', code: 'CARD-TE', description: 'Engineered heart tissue from cardiomyocytes' });

    const result = await search(admin, { q: 'CAR-T', types: undefined, limit: 8 });
    const projectTitles = result.groups.find((g) => g.type === 'project')?.hits.map((h) => h.title) ?? [];
    expect(projectTitles[0]).toBe('CAR-T Cell Engineering');
    expect(projectTitles).not.toContain('Cardiac Tissue Engineering');

    // Words separated by spaces still match as prefixes while typing.
    const partial = await search(admin, { q: 'cardiac tiss', types: undefined, limit: 8 });
    expect(partial.groups.flatMap((g) => g.hits.map((h) => h.title))).toContain('Cardiac Tissue Engineering');
  });

  it('builds prefix queries from whole words and hyphenated fragments', () => {
    expect(toPrefixQuery('CAR-T')).toBe('car & t:*');
    expect(toPrefixQuery('car t cell')).toBe('car:* & t:* & cell:*');
    expect(toPrefixQuery('lenti trans')).toBe('lenti:* & trans:*');
    expect(toPrefixQuery('EXP-1025')).toBe('exp & 1025:*');
    // Operators and punctuation never reach the tsquery.
    expect(toPrefixQuery("a|b & (c):* !d")).toBe('a & b:* & c:* & d:*');
    expect(toPrefixQuery('  ')).toBeNull();
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
