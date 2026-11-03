import { sql } from "drizzle-orm";
import { createDatabase, voters } from "./index.js";
import { buildDemoVoters, DEMO_VOTED_COUNT, DEMO_VOTER_COUNT } from "./seed-data.js";

const { db, client } = createDatabase();
try {
  await db.transaction(async (tx) => {
    await tx.execute(sql.raw("TRUNCATE TABLE transactions, blocks, voting_tokens, voters RESTART IDENTITY CASCADE"));
    await tx.insert(voters).values(buildDemoVoters());
  });
  console.log(`Database reset complete. Seeded ${DEMO_VOTER_COUNT} synthetic voters (${DEMO_VOTED_COUNT} voted, ${DEMO_VOTER_COUNT - DEMO_VOTED_COUNT} not voted). The API creates a fresh genesis block on startup.`);
} finally {
  await client.end();
}
