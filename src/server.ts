import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Hono } from "hono";
import {
  initStorage,
  appendDemoTransaction,
  checkChain,
  getChain,
  tamperBlockForDemo,
  getAllVoters,
  authenticateVoter,
  CANDIDATES,
  resetDemoData,
  storage
} from "./storage/sqlite.js";
import { demoEncryptBallot, demoDecryptBallot, validatorKeys } from "./blockchain/crypto.js";
import {
  getDistrictsStatus,
  failDistrict,
  recoverDistrict,
  generateStateCheckpoint,
  getCheckpoints
} from "./blockchain/sync.js";

const app = new Hono();

// Track boot time
const serverStartTime = Date.now();

// Initialize Database (Turso or local)
await initStorage();

// Detailed Real Telemetry & Stats Endpoint
app.get("/api/system/stats", async (c) => {
  const t0 = performance.now();
  let dbStatus = "healthy";
  let dbError: string | null = null;
  let chainLength = 0;
  let voterCount = 0;

  try {
    const blocks = await storage.getBlocks();
    const voters = await storage.getVoters();
    chainLength = blocks.length;
    voterCount = voters.length;
  } catch (err: any) {
    dbStatus = "error";
    dbError = err.message;
  }
  const dbLatencyMs = Math.round((performance.now() - t0) * 100) / 100;

  const mem = process.memoryUsage();
  const uptimeSeconds = Math.round((Date.now() - serverStartTime) / 1000);

  return c.json({
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    database: {
      provider: process.env.TURSO_DATABASE_URL ? "Turso Cloud (libSQL)" : "Local SQLite (node:sqlite)",
      status: dbStatus,
      latencyMs: dbLatencyMs,
      error: dbError,
      records: {
        blocks: chainLength,
        voters: voterCount
      }
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100
    },
    consensus: {
      validatorAlgorithm: "Ed25519",
      hashAlgorithm: "SHA-256",
      districtsOnline: (await getDistrictsStatus()).filter((d) => d.status === "ONLINE").length
    }
  });
});

// System info
app.get("/api/info", (c) => c.json({
  name: "Electronic Voting Blockchain MVP",
  status: "running",
  database: process.env.TURSO_DATABASE_URL ? "Turso Cloud (libSQL)" : "Local SQLite",
  disclaimer: "Demonstration & Prototype; simulated cryptographic voting components.",
  validatorPublicKey: validatorKeys.publicKey
}));

app.get("/api/health", async (c) => {
  const t0 = performance.now();
  let dbOk = true;
  try {
    await storage.getBlocks();
  } catch {
    dbOk = false;
  }
  const latency = Math.round((performance.now() - t0) * 100) / 100;

  return c.json({
    ok: dbOk,
    database: process.env.TURSO_DATABASE_URL ? "turso" : "sqlite",
    latencyMs: latency
  });
});

// Chain endpoints
app.get("/chain", async (c) => c.json({ blocks: await getChain() }));
app.get("/chain/verify", async (c) => c.json(await checkChain()));

// Voters & Candidates
app.get("/api/voters", async (c) => c.json({ voters: await getAllVoters() }));
app.get("/api/candidates", (c) => c.json({ candidates: CANDIDATES }));

// Multi-District Synchronization Endpoints
app.get("/api/districts", async (c) => c.json({ districts: await getDistrictsStatus() }));
app.post("/api/districts/:id/fail", (c) => {
  const id = c.req.param("id").toUpperCase();
  const ok = failDistrict(id);
  if (!ok) return c.json({ error: "District not found" }, 404);
  return c.json({ message: `District ${id} network partitioned / offline.` });
});
app.post("/api/districts/:id/recover", (c) => {
  const id = c.req.param("id").toUpperCase();
  const ok = recoverDistrict(id);
  if (!ok) return c.json({ error: "District not found" }, 404);
  return c.json({ message: `District ${id} re-connected and synchronized with state checkpoint.` });
});
app.post("/api/sync/checkpoint", async (c) => {
  const cp = await generateStateCheckpoint();
  return c.json({ message: "State checkpoint sealed successfully.", checkpoint: cp });
});
app.get("/api/sync/checkpoints", (c) => c.json({ checkpoints: getCheckpoints() }));

// Receipt Proof of Inclusion Lookup
app.get("/api/receipt/:id", async (c) => {
  const query = c.req.param("id");
  const chain = await getChain();

  for (const block of chain) {
    if (block.hash === query || block.hash.startsWith(query)) {
      return c.json({
        found: true,
        type: "BLOCK_HASH",
        blockIndex: block.index,
        blockHash: block.hash,
        merkleRoot: block.merkleRoot,
        previousHash: block.previousHash,
        timestamp: block.timestamp,
        transactionCount: block.transactions.length
      });
    }
    const tx = block.transactions.find((t) => t.id === query || t.tokenId === query);
    if (tx) {
      return c.json({
        found: true,
        type: "TRANSACTION_RECEIPT",
        transactionId: tx.id,
        tokenId: tx.tokenId,
        blockIndex: block.index,
        blockHash: block.hash,
        merkleRoot: block.merkleRoot,
        timestamp: block.timestamp,
        signatureVerified: true,
        districtId: tx.districtId
      });
    }
  }

  return c.json({ found: false, error: "No recorded block or transaction receipt matched this cryptographic query." }, 404);
});

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

// Cast vote endpoint
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

// Tally votes
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

// Demo endpoints
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

// Serve frontend assets and SPA fallback
app.get("/assets/*", (c) => {
  const assetPath = c.req.path.replace(/^\/assets\//, "");
  const filePath = resolve("./public/assets", assetPath);
  if (existsSync(filePath)) {
    const content = readFileSync(filePath);
    const contentType = filePath.endsWith(".js")
      ? "application/javascript"
      : filePath.endsWith(".css")
      ? "text/css"
      : "application/octet-stream";
    return c.body(content, 200, { "Content-Type": contentType });
  }
  return c.text("Asset not found", 404);
});

app.get("/*", (c) => {
  const indexPath = resolve("./public/index.html");
  if (existsSync(indexPath)) {
    return c.html(readFileSync(indexPath, "utf-8"));
  }
  return c.text("Voting blockchain MVP ready. Run build to generate frontend assets.", 200);
});

export default app;

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  const { serve } = await import("@hono/node-server");
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port });
  console.log(`Voting blockchain MVP listening on http://localhost:${port}`);
}
