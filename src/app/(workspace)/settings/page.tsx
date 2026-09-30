import type { Metadata } from 'next';
import { requireServerAuth } from '@/server/auth/request';
import { can } from '@/server/authz';
import { publicDemoLockReason } from '@/server/http/public-demo';
import { listExperimentTypes } from '@/server/modules/config/service';
import { listTags } from '@/server/modules/collaboration/service';
import { PageContainer, PageHeader } from '@/components/ui/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileSettings, ExperimentTypesSettings, TagsSettings } from '@/components/settings/settings-client';
import { ROLE_META } from '@/domain/labels';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await requireServerAuth();
  const canManage = can(ctx, 'config:manage');
  const [types, tags] = await Promise.all([listExperimentTypes(ctx), listTags(ctx)]);

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Settings" description="Manage your profile and workspace configuration." />
      <div className="space-y-5">
        <ProfileSettings lockedReason={publicDemoLockReason('people')} />

        <Card>
          <CardHeader><CardTitle>Organization</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-fg-subtle">Workspace</dt><dd className="mt-0.5 font-medium text-fg">{ctx.org.name}</dd></div>
            <div><dt className="text-xs text-fg-subtle">Your role</dt><dd className="mt-0.5 font-medium text-fg">{ROLE_META[ctx.role].label}</dd></div>
            <div><dt className="text-xs text-fg-subtle">Time zone</dt><dd className="mt-0.5 font-medium text-fg">{ctx.org.timezone}</dd></div>
            <div><dt className="text-xs text-fg-subtle">Type</dt><dd className="mt-0.5 font-medium text-fg">{ctx.org.isDemo ? 'Demo (synthetic data)' : 'Production'}</dd></div>
          </CardContent>
        </Card>

        <ExperimentTypesSettings types={types} canManage={canManage} />
        <TagsSettings tags={tags} canManage={canManage} />
      </div>
    </PageContainer>
  );
}
