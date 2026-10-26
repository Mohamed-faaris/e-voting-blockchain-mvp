import { generateKeyPairSync, sign, verify, createHash } from "node:crypto";

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

// In-memory or pre-generated validator key pair for signing blocks
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
  const signature = sign(null, Buffer.from(serialized), privateKeyPem);
  return signature.toString("base64");
}

export function verifyPayloadSignature(
  publicKeyPem: string,
  payload: unknown,
  signatureBase64: string
): boolean {
  try {
    const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
    return verify(
      null,
      Buffer.from(serialized),
      publicKeyPem,
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}

// Simple ballot encryption simulation using SHA-256 HMAC / salt for demo protection
export function demoEncryptBallot(candidateId: string, tokenId: string): string {
  const salt = createHash("sha256").update(tokenId).digest("hex").slice(0, 16);
  return Buffer.from(JSON.stringify({ candidateId, salt, t: Date.now() })).toString("base64");
}

export function demoDecryptBallot(encryptedVote: string): { candidateId: string } | null {
  try {
    const decoded = Buffer.from(encryptedVote, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
