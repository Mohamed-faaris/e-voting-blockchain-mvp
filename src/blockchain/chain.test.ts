import test from "node:test";
import assert from "node:assert/strict";
import { createGenesisBlock, createBlock, validateChain, createTransaction } from "./chain.js";

test("genesis block forms a valid chain", () => {
  const chain = [createGenesisBlock()];
  assert.deepEqual(validateChain(chain), { valid: true, errors: [] });
});

test("linked blocks validate and tampering is detected", () => {
  const genesis = createGenesisBlock("D1");
  const tx = createTransaction({ districtId: "D1", tokenId: "token-1", encryptedVote: "demo-ciphertext" });
  const second = createBlock(1, "D1", [tx], genesis.hash);
  assert.equal(validateChain([genesis, second]).valid, true);

  const tampered = { ...second, districtId: "D2" };
  const result = validateChain([genesis, tampered]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("hash mismatch")));
});

test("detects previous-hash link mismatch", () => {
  const genesis = createGenesisBlock("D1");
  const second = createBlock(1, "D1", [], "f".repeat(64));
  const result = validateChain([genesis, second]);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("previous hash")));
});
