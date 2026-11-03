import { createDatabase } from "@evoting/database";
import type { Block } from "./blockchain/types.js";
import { validateChain } from "./blockchain/chain.js";

const { client } = createDatabase();
try {
  const rows = await client`SELECT payload_json FROM blocks ORDER BY block_index ASC`;
  const chain = rows.map((row) => row.payload_json as Block);
  const validation = validateChain(chain);
  if (!validation.valid) {
    console.error("Cryptographic ledger verification failed:");
    for (const error of validation.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    const [demoVotes] = await client`
      SELECT COUNT(*)::int AS total, COUNT(DISTINCT token_id)::int AS unique_tokens
      FROM transactions WHERE id LIKE 'DEMO-TX-%'
    `;
    if (Number(demoVotes.total) !== 3_250 || Number(demoVotes.unique_tokens) !== 3_250) {
      console.error(`Expected 3,250 deterministic demo ballots; found ${demoVotes.total} transactions and ${demoVotes.unique_tokens} unique tokens.`);
      process.exitCode = 1;
    } else {
      console.log(`PASS cryptographic chain validation: ${chain.length} blocks`);
      console.log(`PASS deterministic demo ballots: ${demoVotes.total} transactions / ${demoVotes.unique_tokens} unique tokens`);
    }
  }
} finally {
  await client.end();
}
