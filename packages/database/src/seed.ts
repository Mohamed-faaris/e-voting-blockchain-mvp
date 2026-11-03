import { createDatabase, voters } from "./index.js";
import { buildDemoVoters, DEMO_VOTED_COUNT, DEMO_VOTER_COUNT } from "./seed-data.js";

const { db, client } = createDatabase();
try {
  const demoVoters = buildDemoVoters();
  // Do not overwrite live demo state when a developer repeats the seed command.
  await db.insert(voters).values(demoVoters).onConflictDoNothing({ target: voters.voterId });
  const [totals] = await client`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE has_voted = TRUE)::int AS voted
    FROM voters WHERE voter_id LIKE 'DEMO-%'
  `;
  const total = Number(totals.total);
  const voted = Number(totals.voted);
  console.log(`Demo seed ready: ${total}/${DEMO_VOTER_COUNT} voters; ${voted} currently marked voted; expected initial baseline ${DEMO_VOTED_COUNT} voted and ${DEMO_VOTER_COUNT - DEMO_VOTED_COUNT} not voted.`);
  if (total !== DEMO_VOTER_COUNT) process.exitCode = 1;
} finally {
  await client.end();
}
