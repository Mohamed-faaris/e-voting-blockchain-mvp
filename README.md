# Electronic Voting Blockchain

A multi-portal electronic voting application with a shared Hono API, PostgreSQL persistence, cryptographic ledger verification and independently deployable React frontends.

## Applications

| Workspace | Local URL | Responsibility |
|---|---|---|
| Admin | http://localhost:5173 | Election operations, voter administration and system monitoring |
| Voter | http://localhost:5174 | Voter check-in, ballot selection, submission and receipt |
| Candidate | http://localhost:5175 | Candidate information and read-only oversight |
| Blockchain Explorer | http://localhost:5176 | Blocks, transactions, chain verification and receipt lookup |
| API | http://localhost:3000 | Shared HTTP API and PostgreSQL-backed application services |

## Technology

- PNPM workspaces and Turborepo
- React, Vite and TypeScript
- Tailwind CSS and a shared component/design system
- Hono API
- PostgreSQL, Drizzle ORM and postgres.js
- SHA-256 hash-linked blocks, Merkle roots and Ed25519 signing

## Quick start

Requirements: Node.js 22+, PNPM 10.28.2 and Docker Compose (or a reachable PostgreSQL database).

```bash
git clone https://github.com/Mohamed-faaris/e-voting-blockchain-mvp.git
cd e-voting-blockchain-mvp

corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install

cp .env.example .env
docker compose up -d postgres

pnpm db:migrate
pnpm db:seed
pnpm db:verify

pnpm dev
```

Open the portal URLs listed above. To run only one service, use `pnpm dev:api`, `pnpm dev:admin`, `pnpm dev:voter`, `pnpm dev:candidate` or `pnpm dev:explorer`.

## Optional local face verification

The Admin booth includes an optional local Python face-verification service. It supports a browser-selected webcam or the OAK-D Lite RGB bridge, and can request a stereo-depth frame from the existing local bridge at `/tmp/oak_depth.sock`.

Setup and limitations: [Local face verification service](services/face-verification/README.md).

The service stores one face embedding in local SQLite and does not retain captured frames. Face matching and depth-spread checks are experimental prototype controls, not certified biometric authentication or guaranteed anti-spoofing. If face verification is disabled or unavailable, the existing non-biometric check-in path remains available.

## Quality checks

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm db:verify
```

The database verification command requires PostgreSQL to be running and the schema/data to be initialized.

## Database workflow

| Command | Purpose |
|---|---|
| `pnpm db:generate` | Generate Drizzle migration artifacts |
| `pnpm db:migrate` | Apply the current idempotent PostgreSQL schema setup |
| `pnpm db:seed` | Add the deterministic synthetic voter and ledger dataset |
| `pnpm db:reset` | Destructively restore the initial dataset |
| `pnpm db:verify` | Check database records and blockchain integrity |
| `pnpm db:studio` | Open Drizzle Studio |

The initial dataset contains 5,000 synthetic voters across 12 districts: 3,250 initially voted and 1,750 initially not voted. Matching token, ballot transaction and block records are created for the voted population. Seeding is additive and does not overwrite existing voter state. Reset truncates the voting tables and must only be used when existing records can be discarded.

The current runtime migration is maintained in `packages/database/src/migrate.ts`. Drizzle Kit generation writes migration artifacts but does not automatically apply them through the current `db:migrate` script. See [Project setup](project-setup.md) for the migration workflow.

## Documentation

- [Getting started](docs/getting-started.md) — installation, environment, PostgreSQL, seed and local run.
- [Project setup](project-setup.md) — architecture, workspace responsibilities, scripts and deployment.
- [Troubleshooting](docs/troubleshooting.md) — install, startup, database, API, CORS and deployment diagnostics.
- [Monorepo architecture](docs/architecture/monorepo-migration.md) — workspace boundaries and migration notes.

## Security considerations

This project contains prototype voting and cryptographic workflows and is not certified for real election operations. Base64 is encoding, not encryption; the current session-key handling and district synchronization are not production security or consensus mechanisms. Do not use real voter records or operate a real election with this software. A separate security assessment, key-management redesign and appropriate certification would be required before any production election use.

## Contributing

Keep application-specific UI in its corresponding `apps/*` workspace and extract reusable components, contracts or service logic into `packages/*`. Before opening a pull request, run:

```bash
pnpm build
pnpm typecheck
pnpm test
```

For database changes, update the Drizzle schema and the runtime migration path, then verify both a clean database setup and the existing data migration behavior.
