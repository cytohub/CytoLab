import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/domain/errors';
import { closeDb } from '../../src/server/db/client';
import { resetEnvCache } from '../../src/server/env';
import { assertCanUpload, createAttachment, getAttachmentForDownload } from '../../src/server/modules/collaboration/attachments';
import { updateMember } from '../../src/server/modules/directory/service';
import { createProject } from '../../src/server/modules/projects/service';
import { createWorkspace } from './helpers';

afterAll(async () => {
  await closeDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
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

async function projectFor(ws: Awaited<ReturnType<typeof createWorkspace>>) {
  const admin = await ws.addUser('admin');
  const project = await createProject(admin, { name: 'P', code: `AU-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, ownerId: admin.userId, status: 'active', priority: 'medium', description: null, researchAreaId: null, teamId: null, startDate: null, targetDate: null, notes: null });
  return { admin, project };
}

describe('the last admin (integration)', () => {
  it('cannot be demoted or suspended', async () => {
    const ws = await createWorkspace();
    const admin = await ws.addUser('admin');
    expect(await statusOf(updateMember(admin, admin.userId, { role: 'scientist' }))).toBe(422);
    expect(await statusOf(updateMember(admin, admin.userId, { status: 'suspended' }))).toBe(422);
    expect(await statusOf(updateMember(admin, admin.userId, { name: 'Still admin' }))).toBe('ok');
  });

  it('can step down once someone else is an admin, but two admins cannot both step down at once', async () => {
    const ws = await createWorkspace();
    const a = await ws.addUser('admin');
    const b = await ws.addUser('admin');
    const outcomes = await Promise.all([statusOf(updateMember(a, b.userId, { role: 'viewer' })), statusOf(updateMember(b, a.userId, { role: 'viewer' }))]);
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 422)).toHaveLength(1);
  });
});

describe('attachment storage (integration)', () => {
  it('streams downloads back byte for byte', async () => {
    const ws = await createWorkspace();
    const { admin, project } = await projectFor(ws);
    const data = new Uint8Array(200_000).map((_, i) => i % 251);
    const { id } = await createAttachment(admin, project.id, { fileName: 'trace.bin', contentType: 'application/octet-stream', data });

    const file = await getAttachmentForDownload(admin, id);
    expect(file.size).toBe(data.byteLength);
    const received = new Uint8Array(await new Response(file.body).arrayBuffer());
    expect(received).toEqual(data);
  });

  it('refuses uploads past the organization quota', async () => {
    vi.stubEnv('MAX_ORG_STORAGE_BYTES', '1000');
    resetEnvCache();
    const ws = await createWorkspace();
    const { admin, project } = await projectFor(ws);
    await createAttachment(admin, project.id, { fileName: 'a.txt', contentType: 'text/plain', data: new Uint8Array(600) });
    expect(await statusOf(createAttachment(admin, project.id, { fileName: 'b.txt', contentType: 'text/plain', data: new Uint8Array(600) }))).toBe(409);
  });

  it('limits how many uploads one person starts per hour', async () => {
    const ws = await createWorkspace();
    const { project } = await projectFor(ws);
    const uploader = await ws.addUser('researcher');
    const outcomes: Array<number | 'ok'> = [];
    for (let i = 0; i < 61; i++) outcomes.push(await statusOf(assertCanUpload(uploader, project.id)));
    expect(outcomes.slice(0, 60).every((o) => o === 'ok')).toBe(true);
    expect(outcomes[60]).toBe(429);
  });
});
