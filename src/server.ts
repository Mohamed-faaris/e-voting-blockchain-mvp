import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import {
  initStorage,
  appendDemoTransaction,
  checkChain,
  getChain,
  tamperBlockForDemo,
  getAllVoters,
  authenticateVoter,
  CANDIDATES,
  resetDemoData
} from "./storage/sqlite.js";
import { demoEncryptBallot, demoDecryptBallot, validatorKeys } from "./blockchain/crypto.js";

const app = new Hono();

// Initialize Database (Turso or local)
await initStorage();

// Serve static frontend files
app.use("/*", serveStatic({ root: "./public" }));

// System info
app.get("/api/info", (c) => c.json({
  name: "Electronic Voting Blockchain MVP",
  status: "running",
  database: process.env.TURSO_DATABASE_URL ? "Turso Cloud (libSQL)" : "Local SQLite",
  disclaimer: "Demonstration & Prototype; simulated cryptographic voting components.",
  validatorPublicKey: validatorKeys.publicKey
}));

app.get("/api/health", (c) => c.json({ ok: true, database: process.env.TURSO_DATABASE_URL ? "turso" : "sqlite" }));

// Chain endpoints
app.get("/chain", async (c) => c.json({ blocks: await getChain() }));
app.get("/chain/verify", async (c) => c.json(await checkChain()));

// Voters & Candidates
app.get("/api/voters", async (c) => c.json({ voters: await getAllVoters() }));
app.get("/api/candidates", (c) => c.json({ candidates: CANDIDATES }));

// Authenticate voter and issue token
app.post("/api/voter/auth", async (c) => {
  const body = await c.req.json().catch(() => null) as { voterId?: string } | null;
  if (!body?.voterId?.trim()) {
    return c.json({ error: "voterId is required." }, 400);
  }
  const result = await authenticateVoter(body.voterId.trim());
  if (!result.success) {
    return c.json({ error: result.message }, 400);
  }
  return c.json(result);
});

// Cast vote endpoint (Full flow with token, encryption, and optional signature)
app.post("/api/vote/cast", async (c) => {
  const body = await c.req.json().catch(() => null) as {
    districtId?: string;
    tokenId?: string;
    candidateId?: string;
    privateKey?: string;
    publicKey?: string;
  } | null;

  if (!body?.districtId || !body?.tokenId || !body?.candidateId) {
    return c.json({ error: "districtId, tokenId, and candidateId are required." }, 400);
  }

  // Find candidate
  const candidate = CANDIDATES.find((cd) => cd.id === body.candidateId);
  if (!candidate) {
    return c.json({ error: "Invalid candidate selected." }, 400);
  }

  const encryptedVote = demoEncryptBallot(candidate.id, body.tokenId);

  try {
    const block = await appendDemoTransaction({
      districtId: body.districtId,
      tokenId: body.tokenId,
      encryptedVote,
      privateKey: body.privateKey,
      publicKey: body.publicKey
    });
    return c.json({
      message: "Vote recorded on blockchain block successfully.",
      block,
      candidate: candidate.name,
      receipt: {
        blockIndex: block.index,
        blockHash: block.hash,
        transactionId: block.transactions[0].id,
        timestamp: block.timestamp
      }
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "TOKEN_ALREADY_USED") {
      return c.json({ error: "This token has already been used to cast a ballot. Duplicate vote rejected!" }, 409);
    }
    throw error;
  }
});

// Tally votes from blockchain blocks
app.get("/api/tally", async (c) => {
  const chain = await getChain();
  const tally: Record<string, number> = {};
  CANDIDATES.forEach((cand) => { tally[cand.id] = 0; });

  let totalVotes = 0;
  for (const block of chain) {
    for (const tx of block.transactions) {
      const voteData = demoDecryptBallot(tx.encryptedVote);
      if (voteData?.candidateId && tally[voteData.candidateId] !== undefined) {
        tally[voteData.candidateId]++;
        totalVotes++;
      }
    }
  }

  const results = CANDIDATES.map((cand) => ({
    ...cand,
    votes: tally[cand.id] || 0,
    percentage: totalVotes > 0 ? (((tally[cand.id] || 0) / totalVotes) * 100).toFixed(1) : "0"
  }));

  return c.json({
    totalVotes,
    blockCount: chain.length,
    results
  });
});

// Raw demo endpoints
app.post("/demo/transactions", async (c) => {
  const body = await c.req.json().catch(() => null) as null | {
    districtId?: string; tokenId?: string; encryptedVote?: string;
  };
  if (!body?.districtId?.trim() || !body?.tokenId?.trim() || !body?.encryptedVote?.trim()) {
    return c.json({ error: "districtId, tokenId, and encryptedVote are required." }, 400);
  }
  try {
    const block = await appendDemoTransaction({
      districtId: body.districtId.trim(),
      tokenId: body.tokenId.trim(),
      encryptedVote: body.encryptedVote.trim()
    });
    return c.json({ message: "Demo transaction added.", block }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "TOKEN_ALREADY_USED") {
      return c.json({ error: "This token has already been used." }, 409);
    }
    throw error;
  }
});

app.post("/demo/tamper/:index", async (c) => {
  const index = Number(c.req.param("index"));
  if (!Number.isInteger(index) || index < 0) return c.json({ error: "index must be a non-negative integer." }, 400);
  if (!(await tamperBlockForDemo(index))) return c.json({ error: "Block not found." }, 404);
  return c.json({ message: "Demo tampering applied. Run /chain/verify to see integrity failure." });
});

app.post("/api/demo/reset", async (c) => {
  await resetDemoData();
  return c.json({ message: "Demo blockchain & voter states have been reset to genesis." });
});

export default app;

// Start server when executed directly
const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Voting blockchain MVP listening on http://localhost:${port}`);
