import { afterAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { AppError } from '../../src/domain/errors';
import { closeDb, db } from '../../src/server/db/client';
import { activityEvents, attachments } from '../../src/server/db/schema';
import { createSession } from '../../src/server/auth/sessions';
import { createAttachment } from '../../src/server/modules/collaboration/attachments';
import { createExperiment } from '../../src/server/modules/experiments/mutations';
import { createProject } from '../../src/server/modules/projects/service';
import { POST as upload } from '../../src/app/api/v1/entities/[id]/attachments/route';
import { createWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});

async function setup() {
  const ws = await createWorkspace();
  const admin = await ws.addUser('admin');
  const project = await createProject(admin, { name: 'P', code: `IL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId: admin.userId, status: 'active', priority: 'medium', description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null });
  const experiment = await createExperiment(admin, { projectId: project.id, experimentTypeId: ws.typeId, name: 'Run', objective: null, hypothesis: null, researcherId: admin.userId, teamId: null, status: 'planned', priority: 'medium', startDate: null, targetDate: null, protocolRef: null, notes: null, tagIds: [] });
  return { ws, admin, experiment };
}

describe('upload metadata limits (integration)', () => {
  it('stores and logs a capped file name and a normalized content type', async () => {
    const { admin, experiment } = await setup();
    const { id } = await createAttachment(admin, experiment.id, { fileName: `${'F'.repeat(10_000)}.txt`, contentType: 'text/html; charset=utf-7', data: new Uint8Array([1, 2, 3]) });

    const [row] = await db().select().from(attachments).where(eq(attachments.id, id));
    expect(row!.fileName).toHaveLength(255);
    expect(row!.contentType).toBe('text/html');

    const [event] = await db().select().from(activityEvents).where(and(eq(activityEvents.entityId, experiment.id), eq(activityEvents.action, 'attachment.uploaded')));
    expect(String((event!.payload as { fileName: string }).fileName)).toHaveLength(255);
  });

  it('refuses an overlong description', async () => {
    const { admin, experiment } = await setup();
    const err = await createAttachment(admin, experiment.id, { fileName: 'a.txt', contentType: 'text/plain', data: new Uint8Array([1]), description: 'd'.repeat(2_001) }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).status).toBe(422);
  });
});

describe('upload route (integration)', () => {
  it('refuses a viewer before reading any of the body', async () => {
    const { ws, experiment } = await setup();
    const viewer = await ws.addUser('viewer');
    const session = await createSession(viewer.userId, ws.orgId, { requestId: 'test', ip: null, userAgent: null });

    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024));
      },
    });
    const req = new NextRequest(`http://localhost/api/v1/entities/${experiment.id}/attachments`, {
      method: 'POST',
      body,
      duplex: 'half',
      headers: { 'content-type': 'multipart/form-data; boundary=x', origin: 'http://localhost', cookie: `cytolab_session=${session.token}` },
    } as ConstructorParameters<typeof NextRequest>[1]);

    const res = await upload(req, { params: Promise.resolve({ id: experiment.id }) });
    expect(res.status).toBe(403);
    expect(pulled).toBeLessThanOrEqual(1); // a stream may prefetch one chunk; nothing is consumed
  });
});
