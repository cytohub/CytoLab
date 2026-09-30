/**
 * Guardrails for a public demo deployment (PUBLIC_DEMO=true), where anyone can
 * sign in to the shared synthetic workspace.
 *
 * Research work stays editable — visitors should be able to try the product,
 * and the nightly reset wipes whatever they change. A few areas are locked
 * because one visitor could otherwise spoil the demo for everyone else or
 * abuse the host: uploads would turn the domain into free file hosting, and
 * account changes could rename the demo personas or lock other visitors out.
 */
export const PUBLIC_DEMO_LOCKS = {
  files: 'File uploads are turned off in the public demo.',
  people: 'People and accounts are read-only in the public demo.',
} as const;

export type PublicDemoLock = keyof typeof PUBLIC_DEMO_LOCKS;

/**
 * Writes one visitor (client IP) may make per window. Generous for a person
 * clicking around, tight enough that a script cannot flood the shared
 * workspace between resets.
 */
export const PUBLIC_DEMO_WRITE_LIMIT = { limit: 100, windowMs: 10 * 60 * 1000 } as const;
