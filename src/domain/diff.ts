export type FieldChange = { from: unknown; to: unknown };
export type FieldChanges = Record<string, FieldChange>;

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  return value;
}

function isEqual(a: unknown, b: unknown): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (Array.isArray(na) && Array.isArray(nb)) {
    return na.length === nb.length && na.every((v, i) => isEqual(v, nb[i]));
  }
  return na === nb;
}

/**
 * Field-level changes between a record and a patch. Keys absent from the patch
 * (undefined) are "not provided" and never count as changes.
 */
export function diffFields(before: Record<string, unknown>, patch: Record<string, unknown>): FieldChanges {
  const changes: FieldChanges = {};
  for (const [key, next] of Object.entries(patch)) {
    if (next === undefined) continue;
    const prev = before[key];
    if (!isEqual(prev, next)) changes[key] = { from: normalize(prev), to: normalize(next) };
  }
  return changes;
}

export function hasChanges(changes: FieldChanges): boolean {
  return Object.keys(changes).length > 0;
}
