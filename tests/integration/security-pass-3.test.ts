import { and, eq, sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { MAX_COMMENTS_PER_RECORD, MAX_ENTRIES_PER_EXPERIMENT, MAX_LINKS_PER_RECORD } from '../../src/domain/limits';
import { closeDb, db } from '../../src/server/db/client';
import { comments, entities, entityLinks, experimentObservations, searchDocuments } from '../../src/server/db/schema';
import { createComment, createLink, deleteComment } from '../../src/server/modules/collaboration/service';
import { createExperiment } from '../../src/server/modules/experiments/mutations';
import { addObservation } from '../../src/server/modules/experiments/sub-records';
import { createProject, updateProject } from '../../src/server/modules/projects/service';
import { createWorkspace, type TestWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

async function statusOf(promise: Promise<unknown>): Promise<number | 'ok'> {
  return promise.then(
    () => 'ok' as const,
    (err: unknown) => {
      if (err instanceof AppError) return err.status;
      throw err;
    },
  );
}

function projectInput(ownerId: string) {
  return { name: 'P', code: `SP-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId, status: 'active' as const, priority: 'medium' as const, description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null };
}
function experimentInput(ws: TestWorkspace, projectId: string, researcherId: string) {
  return { projectId, experimentTypeId: ws.typeId, name: 'Run', objective: null, hypothesis: null, researcherId, teamId: null, status: 'planned' as const, priority: 'medium' as const, startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] as string[] };
}

async function searchDoc(objectId: string) {
  const [row] = await db().select({ subtitle: searchDocuments.subtitle, updatedAt: searchDocuments.updatedAt }).from(searchDocuments).where(eq(searchDocuments.objectId, objectId));
  return row!;
}

describe('project edits and the search index (integration)', () => {
  it('re-index only that project’s experiments, and only when the code changes', async () => {
    const ws = await createWorkspace();
    const owner = await ws.addUser('scientist');
    const mine = await createProject(owner, projectInput(owner.userId));
    const other = await createProject(owner, projectInput(owner.userId));
    const inMine = await createExperiment(owner, experimentInput(ws, mine.id, owner.userId));
    const inOther = await createExperiment(owner, experimentInput(ws, other.id, owner.userId));
    const before = { mine: await searchDoc(inMine.id), other: await searchDoc(inOther.id) };

    // The edit form sends the unchanged code with every save.
    await updateProject(owner, mine.code, { code: mine.code, name: 'Renamed' });
    expect((await searchDoc(inMine.id)).updatedAt).toEqual(before.mine.updatedAt);

    const newCode = `${mine.code}X`;
    await updateProject(owner, mine.code, { code: newCode });
    expect((await searchDoc(inMine.id)).subtitle).toContain(newCode);
    expect((await searchDoc(inOther.id)).updatedAt).toEqual(before.other.updatedAt);
  });
});

describe('entry caps (integration)', () => {
  it('stop an experiment collecting more observations than its page loads', async () => {
    const ws = await createWorkspace();
    const owner = await ws.addUser('scientist');
    const project = await createProject(owner, projectInput(owner.userId));
    const experiment = await createExperiment(owner, experimentInput(ws, project.id, owner.userId));

    await db().insert(experimentObservations).values(
      Array.from({ length: MAX_ENTRIES_PER_EXPERIMENT - 1 }, () => ({ orgId: ws.orgId, experimentId: experiment.id, authorId: owner.userId, body: 'Seen', significance: 'routine' as const, observedAt: new Date() })),
    );
    expect(await statusOf(addObservation(owner, experiment.id, { body: 'The last one that fits' }))).toBe('ok');
    expect(await statusOf(addObservation(owner, experiment.id, { body: 'One too many' }))).toBe(422);
  });

  it('stop a record collecting unlimited comments, counting only live ones', async () => {
    const ws = await createWorkspace();
    const owner = await ws.addUser('scientist');
    const project = await createProject(owner, projectInput(owner.userId));

    await db().insert(comments).values(Array.from({ length: MAX_COMMENTS_PER_RECORD - 1 }, () => ({ orgId: ws.orgId, entityId: project.id, authorId: owner.userId, body: 'Noted' })));
    const last = await createComment(owner, project.id, { body: 'The last one that fits', parentId: null });
    expect(await statusOf(createComment(owner, project.id, { body: 'One too many', parentId: null }))).toBe(422);

    await deleteComment(owner, last.id);
    expect(await statusOf(createComment(owner, project.id, { body: 'Room again', parentId: null }))).toBe('ok');
  });

  it('stop a record linking to unlimited others', async () => {
    const ws = await createWorkspace();
    const owner = await ws.addUser('scientist');
    const project = await createProject(owner, projectInput(owner.userId));
    const targets = Array.from({ length: MAX_LINKS_PER_RECORD + 1 }, (_, i) => ({ id: crypto.randomUUID(), orgId: ws.orgId, entityType: 'sample' as const, displayId: `SMP-${90000 + i}`, title: `Sample ${i}` }));
    await db().insert(entities).values(targets);

    await db().insert(entityLinks).values(targets.slice(0, MAX_LINKS_PER_RECORD - 1).map((t) => ({ orgId: ws.orgId, sourceId: project.id, targetId: t.id, linkType: 'related_to' as const })));
    expect(await statusOf(createLink(owner, project.id, { targetId: targets[MAX_LINKS_PER_RECORD - 1]!.id, linkType: 'related_to' }))).toBe('ok');
    expect(await statusOf(createLink(owner, project.id, { targetId: targets[MAX_LINKS_PER_RECORD]!.id, linkType: 'related_to' }))).toBe(422);
    const [{ n }] = (await db().select({ n: sql<number>`count(*)::int` }).from(entityLinks).where(and(eq(entityLinks.sourceId, project.id)))) as [{ n: number }];
    expect(n).toBe(MAX_LINKS_PER_RECORD);
  });
});

describe('database statements (integration)', () => {
  it('time out instead of holding a pooled connection indefinitely', async () => {
    const [row] = (await db().execute(sql`show statement_timeout`)) as unknown as Array<{ statement_timeout: string }>;
    expect(row!.statement_timeout).toBe('15s');
  });
});
