/**
 * How many entries one record may hold. Detail pages load these in full, so the
 * caps keep a single record (in a public demo, anyone's) from growing a page
 * without bound.
 */

/** Per kind: conditions, inputs, protocol steps, observations, results, sample links. */
export const MAX_ENTRIES_PER_EXPERIMENT = 500;

/** Live comments on one project, experiment or other record. */
export const MAX_COMMENTS_PER_RECORD = 500;

/** Links made from one record. */
export const MAX_LINKS_PER_RECORD = 200;
