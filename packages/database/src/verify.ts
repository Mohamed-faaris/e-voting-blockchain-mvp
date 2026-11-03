import { createDatabase } from "./index.js";
import { DEMO_VOTED_COUNT, DEMO_VOTER_COUNT } from "./seed-data.js";

const { client } = createDatabase();
const failures: string[] = [];
const requiredTables = ["voters", "blocks", "transactions", "voting_tokens"];

try {
  for (const table of requiredTables) {
    const rows = await client`SELECT to_regclass(${`public.${table}`}) AS relation`;
    if (!rows[0]?.relation) failures.push(`Missing table: ${table}`);
    else console.log(`PASS table ${table}`);
  }

  const [voterStats] = await client`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE has_voted = TRUE)::int AS voted,
           COUNT(*) FILTER (WHERE name = '' OR district_id = '')::int AS incomplete
    FROM voters WHERE voter_id LIKE 'DEMO-%'
  `;
  const total = Number(voterStats.total);
  const voted = Number(voterStats.voted);
  if (total !== DEMO_VOTER_COUNT) failures.push(`Expected ${DEMO_VOTER_COUNT} demo voters, found ${total}`);
  else console.log(`PASS demo voter count: ${total}`);
  if (voted < DEMO_VOTED_COUNT || voted > DEMO_VOTER_COUNT) failures.push(`Unexpected voted-voter count: ${voted}`);
  else console.log(`PASS voted-voter count: ${voted} (baseline: ${DEMO_VOTED_COUNT})`);
  if (Number(voterStats.incomplete) !== 0) failures.push(`Found ${voterStats.incomplete} incomplete demo voter records`);

  const blocks = await client`
    SELECT block_index, block_hash, previous_hash, payload_json
    FROM blocks ORDER BY block_index ASC
  `;
  if (blocks.length === 0) {
    console.warn("WARN no genesis block yet; start the API once to initialize the ledger.");
  } else {
    for (let index = 0; index < blocks.length; index++) {
      const row = blocks[index];
      const payload = row.payload_json as { index?: number; hash?: string; previousHash?: string };
      if (Number(row.block_index) !== index) failures.push(`Non-contiguous block index at position ${index}`);
      if (Number(payload.index) !== Number(row.block_index) || payload.hash !== String(row.block_hash)) {
        failures.push(`Block payload does not match indexed columns at block ${row.block_index}`);
      }
      if (payload.previousHash !== String(row.previous_hash)) failures.push(`Previous-hash column mismatch at block ${row.block_index}`);
      if (index > 0 && payload.previousHash !== String((blocks[index - 1].payload_json as { hash: string }).hash)) {
        failures.push(`Broken previous-hash link at block ${row.block_index}`);
      }
    }
    if (Number(blocks[0].block_index) !== 0) failures.push("Ledger must start with genesis block index 0");
    else console.log(`PASS ledger structure: ${blocks.length} block(s)`);
  }

  const [invalidTokenTransactions] = await client`
    SELECT COUNT(*)::int AS total
    FROM transactions t
    INNER JOIN voting_tokens vt ON vt.token_id = t.token_id
    WHERE vt.status <> 'SPENT'
  `;
  if (Number(invalidTokenTransactions.total) !== 0) failures.push(`Found ${invalidTokenTransactions.total} recorded transactions whose issued token is not SPENT`);
  else console.log("PASS issued-token transaction states");

  if (failures.length > 0) {
    console.error("Database verification failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("Database verification passed.");
  }
} finally {
  await client.end();
}
