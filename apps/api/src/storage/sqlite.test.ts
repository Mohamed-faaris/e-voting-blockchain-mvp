import test from "node:test";
import assert from "node:assert/strict";
import { unlinkSync, existsSync } from "node:fs";

// Force local sqlite for isolated tests
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const testDbPath = "./data/test-voting-demo.sqlite";
if (existsSync(testDbPath)) {
  try { unlinkSync(testDbPath); } catch {}
}
process.env.DB_PATH = testDbPath;

const { initStorage, ensureGenesis, getChain, appendDemoTransaction, checkChain, tamperBlockForDemo } = await import("./sqlite.js");

test("sqlite storage: initializes genesis and persists chain", async () => {
  await initStorage();
  await ensureGenesis("TEST-DISTRICT");
  const chain = await getChain();
  assert.ok(chain.length >= 1);
  assert.equal(chain[0].index, 0);

  const check = await checkChain();
  assert.equal(check.valid, true);
  assert.ok(check.blockCount >= 1);
});

test("sqlite storage: appends transaction and detects duplicate token", async () => {
  const block = await appendDemoTransaction({
    districtId: "TEST-DISTRICT",
    tokenId: "token-abc-1",
    encryptedVote: "CIPHER-001"
  });

  assert.equal(block.transactions.length, 1);
  assert.equal(block.transactions[0].tokenId, "token-abc-1");

  // Duplicate rejection
  await assert.rejects(async () => {
    await appendDemoTransaction({
      districtId: "TEST-DISTRICT",
      tokenId: "token-abc-1",
      encryptedVote: "CIPHER-002"
    });
  }, /TOKEN_ALREADY_USED/);
});

test("sqlite storage: detects tampering", async () => {
  const tampered = await tamperBlockForDemo(1);
  assert.equal(tampered, true);

  const check = await checkChain();
  assert.equal(check.valid, false);
  assert.ok(check.errors.length > 0);
});
