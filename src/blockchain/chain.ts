import { createHash, randomUUID } from "node:crypto";
import type { Block, VoteTransaction } from "./types.js";
import { signPayload, verifyPayloadSignature, validatorKeys } from "./crypto.js";

const GENESIS_PREVIOUS_HASH = "0".repeat(64);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  // Deterministic JSON stringification for hashing
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`);
  return "{" + entries.join(",") + "}";
}

export function calculateMerkleRoot(transactions: VoteTransaction[]): string {
  if (transactions.length === 0) return sha256("");

  let layer = transactions.map((tx) => {
    // Hash transaction core content (id, districtId, tokenId, encryptedVote, createdAt)
    const txCore = {
      id: tx.id,
      districtId: tx.districtId,
      tokenId: tx.tokenId,
      encryptedVote: tx.encryptedVote,
      createdAt: tx.createdAt
    };
    return sha256(canonicalJson(txCore));
  });

  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left;
      next.push(sha256(left + right));
    }
    layer = next;
  }
  return layer[0]!;
}

function hashBlockFields(block: Omit<Block, "hash" | "validatorSignature" | "validatorPublicKey">): string {
  return sha256(canonicalJson({
    index: block.index,
    districtId: block.districtId,
    timestamp: block.timestamp,
    merkleRoot: block.merkleRoot,
    previousHash: block.previousHash
  }));
}

export function createTransaction(input: {
  districtId: string;
  tokenId: string;
  encryptedVote: string;
  privateKey?: string;
  publicKey?: string;
}): VoteTransaction {
  const createdAt = new Date().toISOString();
  const id = randomUUID();
  const tx: VoteTransaction = {
    id,
    districtId: input.districtId,
    tokenId: input.tokenId,
    encryptedVote: input.encryptedVote,
    createdAt
  };

  if (input.privateKey && input.publicKey) {
    const signature = signPayload(input.privateKey, {
      id,
      districtId: tx.districtId,
      tokenId: tx.tokenId,
      encryptedVote: tx.encryptedVote,
      createdAt
    });
    tx.signature = signature;
    tx.publicKey = input.publicKey;
  }

  return tx;
}

export function verifyTransaction(tx: VoteTransaction): boolean {
  if (!tx.signature || !tx.publicKey) return true; // Unsigned transactions allowed for initial milestone backward compatibility
  const payload = {
    id: tx.id,
    districtId: tx.districtId,
    tokenId: tx.tokenId,
    encryptedVote: tx.encryptedVote,
    createdAt: tx.createdAt
  };
  return verifyPayloadSignature(tx.publicKey, payload, tx.signature);
}

export function createBlock(
  index: number,
  districtId: string,
  transactions: VoteTransaction[],
  previousHash: string,
  validatorPrivateKey = validatorKeys.privateKey,
  validatorPublicKey = validatorKeys.publicKey
): Block {
  const timestamp = new Date().toISOString();
  const merkleRoot = calculateMerkleRoot(transactions);
  const fields = { index, districtId, timestamp, transactions, previousHash, merkleRoot };
  const hash = hashBlockFields(fields);
  const validatorSignature = signPayload(validatorPrivateKey, { hash, index, districtId, merkleRoot });

  return {
    ...fields,
    hash,
    validatorSignature,
    validatorPublicKey
  };
}

export function createGenesisBlock(districtId = "DEMO-DISTRICT"): Block {
  return createBlock(0, districtId, [], GENESIS_PREVIOUS_HASH);
}

export function validateChain(chain: Block[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (chain.length === 0) return { valid: false, errors: ["Chain is empty."] };

  for (let i = 0; i < chain.length; i++) {
    const block = chain[i]!;
    if (block.index !== i) errors.push(`Block ${i}: incorrect index ${block.index}.`);
    if (block.merkleRoot !== calculateMerkleRoot(block.transactions)) {
      errors.push(`Block ${i}: Merkle root mismatch.`);
    }

    const { hash: _hash, validatorSignature, validatorPublicKey, transactions, ...fields } = block;
    const computedHash = hashBlockFields({ ...fields, transactions });
    if (block.hash !== computedHash) {
      errors.push(`Block ${i}: block hash mismatch.`);
    }

    // Verify block validator signature if present
    if (block.validatorSignature && block.validatorPublicKey) {
      const isValidSig = verifyPayloadSignature(
        block.validatorPublicKey,
        { hash: block.hash, index: block.index, districtId: block.districtId, merkleRoot: block.merkleRoot },
        block.validatorSignature
      );
      if (!isValidSig) {
        errors.push(`Block ${i}: validator signature verification failed.`);
      }
    }

    // Verify all transactions inside the block
    for (const tx of block.transactions) {
      if (!verifyTransaction(tx)) {
        errors.push(`Block ${i}: transaction ${tx.id} has invalid cryptographic signature.`);
      }
    }

    if (i === 0) {
      if (block.previousHash !== GENESIS_PREVIOUS_HASH) {
        errors.push("Genesis block has an invalid previous hash.");
      }
    } else if (block.previousHash !== chain[i - 1]!.hash) {
      errors.push(`Block ${i}: previous hash does not match block ${i - 1}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export { GENESIS_PREVIOUS_HASH };
