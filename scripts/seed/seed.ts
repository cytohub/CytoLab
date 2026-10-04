import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { closeDb, db, type Transaction } from '../../src/server/db/client';
import * as s from '../../src/server/db/schema';
import { hashPassword } from '../../src/server/auth/password';
import { reindexOrganization } from '../../src/server/modules/search/indexers';
import { uuidv7 } from '../../src/server/db/uuid';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, EXPERIMENT_TYPES, ORG, PEOPLE, RESEARCH_AREAS, TAGS, TEAMS, type PersonSeed } from './catalog';

/**
 * Seeds the demo workspace: the organization, its people and teams, and the
 * configuration a lab starts from (research areas, experiment types, tags).
 * There is no research data; visitors create their own.
 */
export async function seedDemoData(options: { force?: boolean } = {}): Promise<string> {
  const database = db();
  try {
    const existing = await database.select({ id: s.organizations.id }).from(s.organizations).where(eq(s.organizations.slug, ORG.slug)).limit(1);
    if (existing.length > 0 && !options.force) {
      return `organization "${ORG.slug}" already present — run "pnpm db:reset" to rebuild it`;
    }
    if (existing.length > 0 && options.force) {
      throw new Error('the demo organization already exists; use "pnpm db:reset" (the audit log cannot be truncated in place)');
    }

    const counts = await database.transaction(async (tx) => buildWorkspace(tx));
    return `${counts.people} people (${counts.signIns} demo sign-ins), ${counts.teams} teams, ${counts.types} experiment types`;
  } finally {
    await closeDb();
  }
}

async function buildWorkspace(tx: Transaction) {
  const orgId = uuidv7();
  await tx.insert(s.organizations).values({ id: orgId, name: ORG.name, slug: ORG.slug, timezone: ORG.timezone, isDemo: true });

  // --- People -------------------------------------------------------------
  // Demo accounts sign in with the published password. Team members get an
  // unguessable one and an account that never became active (sign-in and
  // sessions require an active account), while their membership is active so
  // they can own and be assigned work.
  const demoHash = await hashPassword(DEMO_PASSWORD);
  const lockedHash = await hashPassword(randomBytes(32).toString('hex'));
  const userIdByKey = new Map<string, string>();
  const addPerson = async (person: PersonSeed, canSignIn: boolean) => {
    const id = uuidv7();
    await tx.insert(s.users).values({
      id,
      email: person.email,
      name: person.name,
      title: person.title,
      avatarColor: person.color,
      passwordHash: canSignIn ? demoHash : lockedHash,
      status: canSignIn ? 'active' : 'invited',
    });
    await tx.insert(s.orgMemberships).values({ orgId, userId: id, role: person.role, status: 'active' });
    userIdByKey.set(person.key, id);
  };
  // Demo accounts first: the sign-in page lists the earliest account per role.
  for (const account of DEMO_ACCOUNTS) await addPerson(account, true);
  for (const person of PEOPLE) await addPerson(person, false);
  const everyone = [...DEMO_ACCOUNTS, ...PEOPLE];
  const createdBy = userIdByKey.get(DEMO_ACCOUNTS.find((a) => a.role === 'admin')!.key)!;

  // --- Teams --------------------------------------------------------------
  for (const team of TEAMS) {
    const teamId = uuidv7();
    await tx.insert(s.teams).values({ id: teamId, orgId, name: team.name, description: team.description, color: team.color, createdBy });
    for (const person of everyone) {
      const membership = person.teams.find((t) => t.team === team.key);
      if (!membership) continue;
      await tx.insert(s.teamMemberships).values({ teamId, userId: userIdByKey.get(person.key)!, orgId, role: membership.lead ? 'lead' : 'member' });
    }
  }

  // --- Configuration ------------------------------------------------------
  for (const area of RESEARCH_AREAS) {
    await tx.insert(s.researchAreas).values({ orgId, name: area.name, color: area.color });
  }
  for (const type of EXPERIMENT_TYPES) {
    await tx.insert(s.experimentTypes).values({ orgId, name: type.name, category: type.category, color: type.color, description: type.description });
  }
  for (const tag of TAGS) {
    await tx.insert(s.tags).values({ orgId, name: tag.name, color: tag.color, createdBy });
  }

  // --- Search index -------------------------------------------------------
  await reindexOrganization(tx, orgId);

  return { people: everyone.length, signIns: DEMO_ACCOUNTS.length, teams: TEAMS.length, types: EXPERIMENT_TYPES.length };
}
