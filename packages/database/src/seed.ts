import { createDatabase, voters } from "@evoting/database";
import { sql } from "drizzle-orm";
import { createDefaultDemoVoters } from "@evoting/seed";

const { db, client } = createDatabase();
const demoVoters = createDefaultDemoVoters();

try {
  await db.insert(voters).values(demoVoters.map((voter) => ({
    voterId: voter.voterId,
    name: voter.name,
    districtId: voter.districtId,
    hasVoted: voter.hasVoted,
    issuedTokenId: null
  }))).onConflictDoUpdate({
    target: voters.voterId,
    set: {
      name: sql`excluded.name`,
      districtId: sql`excluded.district_id`,
      hasVoted: sql`excluded.has_voted`,
      issuedTokenId: null
    }
  });
  const [{ count }] = await client`SELECT COUNT(*)::int AS count FROM voters WHERE voter_id LIKE 'DEMO-%'`;
  const [{ voted }] = await client`SELECT COUNT(*)::int AS voted FROM voters WHERE voter_id LIKE 'DEMO-%' AND has_voted = TRUE`;
  console.log(`Seeded demo voter rows: ${count}; voted: ${voted}; not voted: ${Number(count) - Number(voted)}`);
} finally {
  await client.end();
}
