import Link from 'next/link';
import * as React from 'react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { StateBadge, PriorityIndicator, AttentionFlag } from '@/components/domain/status';
import { UserCell, IdTag, TagList } from '@/components/domain/misc';
import { ColorLabel } from '@/components/domain/misc';
import { formatDate } from '@/lib/format';
import type { ExperimentListItem } from '@/server/modules/experiments/service';

interface Column {
  key: 'project' | 'type' | 'researcher' | 'status' | 'priority' | 'target' | 'completed' | 'updated' | 'tags';
  label: string;
  sortKey?: string;
}

const ALL_COLUMNS: Record<Column['key'], Column> = {
  project: { key: 'project', label: 'Project' },
  type: { key: 'type', label: 'Type' },
  researcher: { key: 'researcher', label: 'Researcher' },
  status: { key: 'status', label: 'Status', sortKey: 'status' },
  priority: { key: 'priority', label: 'Priority', sortKey: 'priority' },
  target: { key: 'target', label: 'Target', sortKey: 'targetDate' },
  completed: { key: 'completed', label: 'Completed', sortKey: 'completedDate' },
  updated: { key: 'updated', label: 'Updated', sortKey: 'updatedAt' },
  tags: { key: 'tags', label: 'Tags' },
};

/**
 * Columns appear as width allows, most important first, so the table never has
 * to scroll sideways: experiment and status always; project and dates from sm;
 * researcher, type and priority from xl; tags from 2xl. Short values never wrap,
 * so codes like "GENED-BE" and dates stay on one line, and the experiment name
 * absorbs the remaining width and truncates.
 */
function columnClass(key: Column['key']): string {
  switch (key) {
    case 'status':
      return 'whitespace-nowrap';
    case 'project':
    case 'target':
    case 'completed':
    case 'updated':
      return 'hidden whitespace-nowrap sm:table-cell';
    case 'researcher':
    case 'type':
    case 'priority':
      return 'hidden whitespace-nowrap xl:table-cell';
    case 'tags':
      return 'hidden 2xl:table-cell';
  }
}

export function ExperimentTable({
  experiments,
  columns = ['project', 'type', 'researcher', 'status', 'target'],
  sortColumn,
}: {
  experiments: ExperimentListItem[];
  columns?: Column['key'][];
  /** Renders sortable header links via this function (client wrapper) when provided. */
  sortColumn?: (col: { label: string; sortKey?: string }) => React.ReactNode;
}) {
  const cols = columns.map((c) => ALL_COLUMNS[c]);
  return (
    <Table>
      <THead>
        <TR className="hover:bg-transparent">
          <TH className="min-w-[160px] sm:min-w-[220px]">Experiment</TH>
          {cols.map((col) => (
            <TH key={col.key} className={columnClass(col.key)}>
              {sortColumn && col.sortKey ? sortColumn(col) : col.label}
            </TH>
          ))}
        </TR>
      </THead>
      <TBody>
        {experiments.map((exp) => (
          <TR key={exp.id} interactive className="align-middle">
            {/* w-full + max-w-0 lets this column take the leftover width and truncate. */}
            <TD className="w-full min-w-[160px] max-w-0 sm:min-w-[220px]">
              <Link href={exp.href} className="group flex items-center gap-2">
                <AttentionFlag attention={exp.attention} />
                <IdTag className="shrink-0">{exp.displayId}</IdTag>
                <span className="truncate font-medium text-fg group-hover:text-accent" title={exp.name}>
                  {exp.name}
                </span>
              </Link>
            </TD>
            {cols.map((col) => (
              <TD key={col.key} className={columnClass(col.key)}>
                {renderCell(exp, col.key)}
              </TD>
            ))}
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function renderCell(exp: ExperimentListItem, key: Column['key']): React.ReactNode {
  switch (key) {
    case 'project':
      return (
        <Link href={exp.project.href} className="text-sm text-fg-muted hover:text-accent hover:underline">
          {exp.project.code}
        </Link>
      );
    case 'type':
      return <ColorLabel color={exp.experimentType.color} className="text-xs">{exp.experimentType.name}</ColorLabel>;
    case 'researcher':
      return <UserCell user={exp.researcher} size="xs" muted />;
    case 'status':
      return <StateBadge state={exp.status} size="sm" />;
    case 'priority':
      return <PriorityIndicator priority={exp.priority} />;
    case 'target':
      return <span className="text-sm text-fg-muted">{formatDate(exp.targetDate)}</span>;
    case 'completed':
      return <span className="text-sm text-fg-muted">{formatDate(exp.completedDate)}</span>;
    case 'updated':
      return <span className="text-sm text-fg-subtle">{formatDate(exp.updatedAt.slice(0, 10))}</span>;
    case 'tags':
      return <TagList tags={exp.tags} max={3} />;
  }
}
