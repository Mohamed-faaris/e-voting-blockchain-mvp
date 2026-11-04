# Project setup

This document describes the repository structure, development workflow, runtime dependencies and configuration for contributors.

## Project overview

The Electronic Voting Blockchain project is organized as a PNPM workspace managed by Turborepo. It contains four independent React applications, a shared Hono API and reusable packages for UI, API contracts, database access and seed data.

## Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js 22+ |
| Package manager | PNPM 10.28.2 |
| Monorepo orchestration | Turborepo 2 |
| Frontend | React 19, Vite 8, TypeScript |
| Styling | Tailwind CSS 4, shared design tokens and UI package |
| Backend | Hono |
| Database | PostgreSQL 17 |
| Database toolkit | Drizzle ORM and Drizzle Kit |
| PostgreSQL driver | postgres.js |
| Blockchain primitives | SHA-256, Merkle roots and Ed25519 signing |
| Tests | Node test runner through `tsx` |

## Repository layout

```text
.
├── apps/
│   ├── admin/          # Operations and administration portal
│   ├── voter/          # Voter check-in and ballot workflow
│   ├── candidate/      # Candidate information and oversight
│   ├── explorer/       # Block, transaction and receipt inspection
│   └── api/            # Hono API and blockchain services
├── packages/
│   ├── api-client/     # Shared typed API client
│   ├── contracts/      # Shared domain and API contracts
│   ├── database/       # PostgreSQL client, Drizzle schema and scripts
│   ├── design-system/  # Shared theme tokens and global styles
│   ├── seed/           # Deterministic synthetic voter records
│   └── ui/             # Reusable React UI components
├── docs/
│   ├── architecture/
│   ├── getting-started.md
│   └── troubleshooting.md
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── turbo.json
```

## Workspace responsibilities

### Applications

- **`apps/admin`** — election operations, voter administration, district status, system metrics and existing administrative workflows.
- **`apps/voter`** — voter authentication/check-in, candidate selection, ballot submission and receipt display.
- **`apps/candidate`** — candidate roster and read-only system/ledger information.
- **`apps/explorer`** — block inspection, chain verification and receipt lookup.
- **`apps/api`** — shared HTTP API, PostgreSQL-backed voting state and blockchain operations.

### Shared packages

- **`@evoting/ui`** — reusable components and application shell.
- **`@evoting/design-system`** — shared light theme, color tokens, typography and layout styles.
- **`@evoting/contracts`** — shared TypeScript data contracts.
- **`@evoting/api-client`** — common API request client and configurable API origin.
- **`@evoting/database`** — Drizzle schema, PostgreSQL client and database lifecycle scripts.
- **`@evoting/seed`** — deterministic synthetic voter dataset generation.

## Runtime topology

```text
Admin (5173) ───┐
Voter (5174) ───┤
Candidate (5175) ┼── Hono API (3000) ── PostgreSQL (5432)
Explorer (5176) ┘
       │                 │
       └── shared UI, contracts and API client
```

Each frontend is independently runnable. During local development, Vite proxies API and chain requests to the Hono service. In deployed environments, frontends use `VITE_API_BASE_URL` and the API uses an explicit `ALLOWED_ORIGINS` allowlist.

## Environment configuration

Copy the provided template:

```bash
cp .env.example .env
```

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | API and database scripts | PostgreSQL connection URL |
| `PORT` | API | HTTP server port; defaults to 3000 |
| `ALLOWED_ORIGINS` | API | Comma-separated allowed frontend origins |
| `VITE_API_BASE_URL` | Frontends | API origin; leave empty for local Vite proxy |
| `VITE_ADMIN_URL` | Frontends | Admin portal URL |
| `VITE_VOTER_URL` | Frontends | Voter portal URL |
| `VITE_CANDIDATE_URL` | Frontends | Candidate portal URL |
| `VITE_EXPLORER_URL` | Frontends | Explorer portal URL |

Frontend `VITE_*` variables are public build-time configuration. Never put database credentials, private keys or server secrets in them.

## Local development

Install:

```bash
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install
cp .env.example .env
```

Start PostgreSQL and initialize data:

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

Start all workspaces:

```bash
pnpm dev
```

Start an individual workspace:

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:voter
pnpm dev:candidate
pnpm dev:explorer
```

## Root scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Run all development workspaces in parallel |
| `pnpm build` | Build all workspaces in dependency order |
| `pnpm typecheck` | Run TypeScript checks across workspaces |
| `pnpm test` | Run workspace tests |
| `pnpm db:generate` | Generate Drizzle migration artifacts |
| `pnpm db:migrate` | Apply the current idempotent PostgreSQL schema setup |
| `pnpm db:seed` | Seed synthetic voter records and corresponding ledger entries |
| `pnpm db:reset` | Destructively rebuild the initial dataset |
| `pnpm db:verify` | Verify database and ledger consistency |
| `pnpm db:studio` | Open Drizzle Studio |

### Database migration note

The current `db:migrate` script executes `packages/database/src/migrate.ts`, which applies the repository's explicit idempotent SQL statements. `db:generate` invokes Drizzle Kit and writes migration artifacts under `packages/database/drizzle`. Generated artifacts should be reviewed and incorporated into the runtime migration process intentionally; generation alone does not apply them.

### Seed data

The initial synthetic dataset contains 5,000 voter records across 12 districts: 3,250 start with voted status and 1,750 start as not voted. Corresponding token, transaction and block records are created for the voted population. The seed is deterministic and additive. Use reset only when you intend to discard current records and restore the initial dataset.

## API surface

Common endpoints include:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | API/database health |
| GET | `/api/info` | API metadata |
| GET | `/api/system/stats` | Runtime and record statistics |
| GET | `/api/voters` | Voter records |
| GET | `/api/candidates` | Candidate list |
| POST | `/api/voter/auth` | Authenticate/check in a voter and issue a token |
| POST | `/api/vote/cast` | Submit a ballot |
| GET | `/api/tally` | Current application tally |
| GET | `/chain` | Read blockchain blocks |
| GET | `/chain/verify` | Verify chain integrity |
| GET | `/api/receipt/:id` | Look up a block or transaction receipt |
| GET | `/api/districts` | Read district synchronization status |

Inspect `apps/api/src/server.ts` for request and response details. Do not assume the endpoint list above is exhaustive.

## Deployment

Deploy each Vite application as a separate project from the same repository, using its workspace directory as the project root. The API should be configured as a separate backend deployment rooted at `apps/api`.

For frontend deployments:
- Set `VITE_API_BASE_URL` to the public API origin.
- Set the other `VITE_*_URL` values to the corresponding portal origins.
- Rebuild after changing any `VITE_*` value.

For the API deployment:
- Set `DATABASE_URL` to a managed PostgreSQL connection string.
- Set `ALLOWED_ORIGINS` to the exact frontend origins.
- Keep server secrets and database credentials in server-side environment settings.
- Confirm the deployment build command and workspace install behavior for the monorepo.

## Security and operational boundaries

This codebase contains prototype voting and cryptographic workflows. Base64 is an encoding format, not encryption. The current ballot/session key handling and district synchronization implementation are not a production election security model. The application has not been certified for real election operations. Do not use real voter records or conduct a real election with this software.

Before any production-oriented work, perform an independent threat model and security review, redesign key custody and voter/ballot unlinkability, add hardened authentication and authorization, validate auditability, and obtain appropriate legal and election-system certification.

## Further reading

- [Getting started](docs/getting-started.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Monorepo architecture and migration](docs/architecture/monorepo-migration.md)
