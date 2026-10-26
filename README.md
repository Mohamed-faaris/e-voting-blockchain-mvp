# Electronic Voting Blockchain MVP (demo only)

This first milestone implements the blockchain module before voter UI or hardware:
- SHA-256 hash-linked blocks
- Merkle root over each block's transactions
- SQLite persistence
- chain integrity verification
- one-time token reference enforcement (unique DB constraint)
- demo endpoint that deliberately tampers with a block to demonstrate detection

**Not for real elections.** The `encryptedVote` field is demo input only; this project does not yet implement ballot encryption, anonymous credentials, real identity verification, certificate infrastructure, distributed consensus, or production key management.

## Requirements
- Node.js 20+
- npm
- build tools if `better-sqlite3` needs to compile on your platform

## Run on Ubuntu / zsh
```zsh
unzip e-voting-blockchain-mvp.zip
cd e-voting-mvp
npm install
npm test
npm run dev
```

## Try the API
```zsh
# Genesis chain
curl http://localhost:3000/chain

# Add a demo transaction. Use a unique tokenId for each accepted vote.
curl -X POST http://localhost:3000/demo/transactions \
  -H 'content-type: application/json' \
  -d '{"districtId":"D1","tokenId":"demo-token-001","encryptedVote":"DEMO-CIPHERTEXT-A"}'

# Verify the chain
curl http://localhost:3000/chain/verify

# Reusing a token should return HTTP 409
curl -i -X POST http://localhost:3000/demo/transactions \
  -H 'content-type: application/json' \
  -d '{"districtId":"D1","tokenId":"demo-token-001","encryptedVote":"DEMO-CIPHERTEXT-B"}'

# Intentionally mutate block 1, then verify integrity failure
curl -X POST http://localhost:3000/demo/tamper/1
curl http://localhost:3000/chain/verify
```

The database defaults to `./data/voting-demo.sqlite`. Override with `DB_PATH=/path/to/file.sqlite`.

## Project layout
```text
src/
  blockchain/
    types.ts       # transaction and block types
    chain.ts       # hashes, Merkle root, block creation, chain validation
    chain.test.ts  # unit tests
  storage/
    sqlite.ts      # SQLite schema and persistence
  server.ts         # Hono API
```

## Next milestones
1. Add Ed25519 signing and verification for block/transaction payloads.
2. Add a token service with atomic token redemption.
3. Add a simulated voter UI and candidate selection.
4. Add authenticated/encrypted ballot handling using a defined cryptographic protocol.
5. Split the district validator into a service and add synchronization checkpoints.
6. Add admin dashboard and monitoring.
