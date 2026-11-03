import assert from "node:assert/strict";
import test from "node:test";
import { createBlock, createGenesisBlock, validateChain } from "./blockchain/chain.js";
import { demoDecryptBallot } from "./blockchain/crypto.js";
import { buildDemoLedgerBlocks } from "./seed-demo-data.js";

test("demo ledger seed is deterministic and produces valid linked blocks", () => {
  const genesis = createGenesisBlock("DEMO-DISTRICT");
  const voters = Array.from({ length: 24 }, (_, index) => ({
    voterId: `DEMO-${String(index + 1).padStart(5, "0")}`,
    districtId: `D${(index % 3) + 1}`
  }));
  const first = buildDemoLedgerBlocks(voters, 1, genesis.hash, genesis.timestamp);
  const second = buildDemoLedgerBlocks(voters, 1, genesis.hash, genesis.timestamp);
  assert.deepEqual(first.map((block) => block.hash), second.map((block) => block.hash));
  assert.deepEqual(first.flatMap((block) => block.transactions), second.flatMap((block) => block.transactions));
  assert.deepEqual(first.map((block) => block.districtId), ["D1", "D2", "D3"]);
  assert.equal(first.reduce((count, block) => count + block.transactions.length, 0), 24);
  assert.ok(first.flatMap((block) => block.transactions).every((tx) => demoDecryptBallot(tx.encryptedVote)?.candidateId));
  assert.equal(validateChain([genesis, ...first]).valid, true);
});
