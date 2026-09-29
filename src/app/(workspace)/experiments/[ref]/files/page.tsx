import { requireServerAuth } from '@/server/auth/request';
import { getExperimentByRef } from '@/server/modules/experiments/detail';
import { listAttachments } from '@/server/modules/collaboration/attachments';
import { FileManager } from '@/components/experiments/managers';

export const dynamic = 'force-dynamic';

export default async function FilesPage({ params }: { params: Promise<{ ref: string }> }) {
  const ctx = await requireServerAuth();
  const { ref } = await params;
  const exp = await getExperimentByRef(ctx, ref);
  const attachments = await listAttachments(ctx, exp.id);
  return <FileManager entityId={exp.id} attachments={attachments} canEdit={exp.permissions.canEdit} />;
}
