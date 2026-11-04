import { createDatabase } from "@evoting/database";
import type { Block } from "./blockchain/types.js";
import { createGenesisBlock } from "./blockchain/chain.js";
import { buildDemoLedgerBlocks } from "./seed-demo-data.js";
import { toPostgresTimestamp } from "./storage/postgres-date.js";

const { client } = createDatabase();
function toJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("Cannot serialize demo seed data.");
  return serialized;
}

try {
  const voters = await client`
    SELECT voter_id, district_id FROM voters
    WHERE voter_id LIKE 'DEMO-%' AND has_voted = TRUE ORDER BY voter_id
  `;
  if (voters.length !== 3_250) throw new Error(`Expected 3,250 pre-marked demo voters; found ${voters.length}. Run pnpm db:seed after migration.`);

  const existingBlocks = await client`SELECT block_index, payload_json FROM blocks ORDER BY block_index ASC`;
  const [existingDemoVotes] = await client`SELECT COUNT(*)::int AS total FROM transactions WHERE id LIKE 'DEMO-TX-%'`;
  if (Number(existingDemoVotes.total) === 3_250) {
    console.log("Demo ledger seed already exists; existing voter and ledger state left unchanged.");
  } else if (existingBlocks.length > 1 || Number(existingDemoVotes.total) > 0) {
    console.warn("Skipped synthetic ballots because a non-genesis ledger already exists. Existing ledger data was not modified.");
  } else {
    let genesis = existingBlocks[0]?.payload_json as Block | undefined;
    if (!genesis) {
      genesis = createGenesisBlock("DEMO-DISTRICT");
      await client`
        INSERT INTO blocks (block_index, district_id, timestamp, previous_hash, merkle_root, block_hash, payload_json)
        VALUES (${genesis.index}, ${genesis.districtId}, ${toPostgresTimestamp(genesis.timestamp)}, ${genesis.previousHash},
                ${genesis.merkleRoot}, ${genesis.hash}, ${toJson(genesis)})
      `;
    }

    const seedStart = new Date(Date.parse(genesis.timestamp) + 1_000).toISOString();
    const demoVoters = voters.map((row) => ({ voterId: String(row.voter_id), districtId: String(row.district_id) }));
    const voterIdsByToken = new Map(demoVoters.map((voter) => [
      `DEMO-TOKEN-${voter.voterId.replace(/^DEMO-/, "")}`, voter.voterId
    ]));
    const blocks = buildDemoLedgerBlocks(demoVoters, genesis.index + 1, genesis.hash, seedStart);

    await client.begin(async (tx) => {
      for (const block of blocks) {
        await tx`
          INSERT INTO blocks (block_index, district_id, timestamp, previous_hash, merkle_root, block_hash, payload_json)
          VALUES (${block.index}, ${block.districtId}, ${toPostgresTimestamp(block.timestamp)}, ${block.previousHash},
                  ${block.merkleRoot}, ${block.hash}, ${toJson(block)})
        `;
        for (const ballot of block.transactions) {
          const voterId = voterIdsByToken.get(ballot.tokenId);
          if (!voterId) throw new Error(`No matching voter for seeded token ${ballot.tokenId}`);
          const createdAt = toPostgresTimestamp(ballot.createdAt);
          await tx`
            INSERT INTO voting_tokens (token_id, voter_id, status, created_at, spent_at)
            VALUES (${ballot.tokenId}, ${voterId}, 'SPENT', ${createdAt}, ${createdAt})
          `;
          await tx`
            INSERT INTO transactions (id, block_index, token_id, district_id, payload_json)
            VALUES (${ballot.id}, ${block.index}, ${ballot.tokenId}, ${ballot.districtId}, ${toJson(ballot)})
          `;
          await tx`UPDATE voters SET issued_token_id = ${ballot.tokenId}, has_voted = TRUE WHERE voter_id = ${voterId}`;
        }
      }
    });
    console.log(`Demo ledger seed complete: ${demoVoters.length} synthetic ballots in ${blocks.length} district blocks.`);
  }
} finally {
  await client.end();
}
