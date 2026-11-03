import test from "node:test";
import assert from "node:assert/strict";
import { generateEd25519KeyPair, signPayload, verifyPayloadSignature, demoEncryptBallot, demoDecryptBallot } from "./crypto.js";
import { createTransaction, verifyTransaction } from "./chain.js";

test("ed25519 key generation and signature verification", () => {
  const { publicKey, privateKey } = generateEd25519KeyPair();
  const payload = { vote: "cand-1", voterNonce: "xyz-789" };

  const signature = signPayload(privateKey, payload);
  assert.equal(typeof signature, "string");
  assert.ok(signature.length > 32);

  const valid = verifyPayloadSignature(publicKey, payload, signature);
  assert.equal(valid, true);

  const tamperedPayload = { vote: "cand-2", voterNonce: "xyz-789" };
  const invalid = verifyPayloadSignature(publicKey, tamperedPayload, signature);
  assert.equal(invalid, false);
});

test("signed transaction creation and verification", () => {
  const keys = generateEd25519KeyPair();
  const tx = createTransaction({
    districtId: "D1",
    tokenId: "token-sign-1",
    encryptedVote: "ENCRYPTED-BALLOT",
    privateKey: keys.privateKey,
    publicKey: keys.publicKey
  });

  assert.ok(tx.signature);
  assert.ok(tx.publicKey);
  assert.equal(verifyTransaction(tx), true);

  // Tamper transaction payload
  const tamperedTx = { ...tx, encryptedVote: "TAMPERED-BALLOT" };
  assert.equal(verifyTransaction(tamperedTx), false);
});

test("ballot encryption & decryption simulation", () => {
  const encrypted = demoEncryptBallot("cand-1", "token-999");
  assert.ok(encrypted.length > 10);
  const decrypted = demoDecryptBallot(encrypted);
  assert.equal(decrypted?.candidateId, "cand-1");
});
