import type { Metadata } from 'next';
import Link from 'next/link';
import { requireServerAuth } from '@/server/auth/request';
import { listMembers, listTeams } from '@/server/modules/directory/service';
import { Card } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PageContainer, PageHeader, SectionHeading } from '@/components/ui/page';
import { AvatarStack } from '@/components/ui/avatar';
import { UserCell, ColorLabel } from '@/components/domain/misc';
import { ROLE_META } from '@/domain/labels';
import { pluralize } from '@/lib/format';

export const metadata: Metadata = { title: 'Teams' };
export const dynamic = 'force-dynamic';

export default async function TeamsPage() {
  const ctx = await requireServerAuth();
  const [teams, members] = await Promise.all([listTeams(ctx), listMembers(ctx)]);

  return (
    <PageContainer>
      <PageHeader title="Teams & people" description={`${pluralize(teams.length, 'team')} · ${pluralize(members.length, 'person', 'people')}`} />

      <section className="mb-8">
        <SectionHeading title="Teams" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Card key={team.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full chip-${team.color}`} aria-hidden />
                  <h3 className="text-sm font-semibold text-fg">{team.name}</h3>
                </div>
                <span className="text-xs text-fg-subtle">{pluralize(team.memberCount, 'member')}</span>
              </div>
              {team.description && <p className="mt-1.5 line-clamp-2 text-xs text-fg-muted">{team.description}</p>}
              <div className="mt-3">
                <AvatarStack people={team.members} max={6} size="sm" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeading title="People" />
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <TR className="hover:bg-transparent"><TH>Name</TH><TH>Role</TH><TH className="hidden md:table-cell">Teams</TH><TH className="hidden sm:table-cell">Status</TH></TR>
            </THead>
            <TBody>
              {members.map((member) => (
                <TR key={member.id} interactive>
                  <TD>
                    <Link href={member.href} className="flex items-center gap-2">
                      <UserCell user={member} size="sm" />
                    </Link>
                  </TD>
                  <TD><Badge tone="neutral" size="sm">{ROLE_META[member.role.value].label}</Badge></TD>
                  <TD className="hidden md:table-cell">
                    <span className="flex flex-wrap gap-1.5">
                      {member.teams.map((t) => <ColorLabel key={t.id} color={t.color} className="text-xs">{t.name}</ColorLabel>)}
                      {member.teams.length === 0 && <span className="text-xs text-fg-faint">—</span>}
                    </span>
                  </TD>
                  <TD className="hidden sm:table-cell">
                    <span className="text-xs capitalize text-fg-subtle">{member.status}</span>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      </section>
    </PageContainer>
  );
}
