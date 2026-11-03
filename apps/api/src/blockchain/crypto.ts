import { generateKeyPairSync, sign, verify, createHash } from "node:crypto";

export interface KeyPair { publicKey: string; privateKey: string; }
export const validatorKeys: KeyPair = generateEd25519KeyPair();

export function generateEd25519KeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" }
  });
  return { publicKey, privateKey };
}

export function signPayload(privateKeyPem: string, payload: unknown): string {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  return sign(null, Buffer.from(serialized), privateKeyPem).toString("base64");
}

export function verifyPayloadSignature(publicKeyPem: string, payload: unknown, signatureBase64: string): boolean {
  try {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
    return verify(null, Buffer.from(serialized), publicKeyPem, Buffer.from(signatureBase64, "base64"));
  } catch { return false; }
}

// This is a reversible demo encoding, not encryption. The optional timestamp
// keeps generated demo fixtures deterministic while normal votes use wall time.
export function demoEncryptBallot(candidateId: string, tokenId: string, timestamp = Date.now()): string {
  const salt = createHash("sha256").update(tokenId).digest("hex").slice(0, 16);
  return Buffer.from(JSON.stringify({ candidateId, salt, t: timestamp })).toString("base64");
}

export function demoDecryptBallot(encryptedVote: string): { candidateId: string } | null {
  try {
    return JSON.parse(Buffer.from(encryptedVote, "base64").toString("utf8"));
  } catch { return null; }
}
