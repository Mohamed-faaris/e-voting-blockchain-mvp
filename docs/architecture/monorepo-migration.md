# Monorepo architecture

## Runtime topology

```text
Admin (5173) ──────┐
Voter (5174) ──────┤
Candidate (5175) ──┼── Hono API (3000) ── PostgreSQL (5432)
Explorer (5176) ───┘
        │
        └── Shared UI, design tokens, contracts and API client
```

The four React/Vite frontends are independent workspaces. They communicate with one shared Hono API. The API's active persistence adapter is PostgreSQL, accessed through parameterized `postgres.js` queries. The shared database package provides the Drizzle schema, typed database client, migration and lifecycle scripts.

## Workspaces

- `apps/admin`: operations command center and administration workflows.
- `apps/voter`: voter check-in, token issuance, ballot selection, submission and receipt flow.
- `apps/candidate`: candidate roster and read-only system/ledger information.
- `apps/explorer`: block inspection, chain verification and receipt lookup.
- `apps/api`: Hono routes, PostgreSQL storage adapter and blockchain services.
- `packages/ui`: reusable React components and application shell.
- `packages/design-system`: shared light-theme tokens and responsive styles.
- `packages/contracts`: shared TypeScript domain/API contracts.
- `packages/api-client`: typed fetch client used by the frontends.
- `packages/database`: Drizzle schema, PostgreSQL client, migration, seed, reset and verification scripts.
- `packages/seed`: deterministic synthetic voter dataset generator.

## Frontend/API connectivity

- In development, Vite proxies `/api` and `/chain` requests to `http://localhost:3000`.
- For separately deployed frontends, set `VITE_API_BASE_URL` at build time to the API origin.
- Set `ALLOWED_ORIGINS` on the API to a comma-separated list of exact frontend origins.
- The API permits local frontend origins on ports 5173–5176 by default.
- Do not use a wildcard CORS origin for state-changing voting endpoints.

## Database and migration workflow

The active API runtime uses PostgreSQL. The Drizzle schema is in `packages/database/src/schema.ts`; the PostgreSQL client is created in `packages/database/src/index.ts`; the current idempotent SQL bootstrap is in `packages/database/src/migrate.ts`.

The root `pnpm db:migrate` command runs that bootstrap script. `pnpm db:generate` invokes Drizzle Kit to generate migration artifacts, but generated files are not automatically applied by the current bootstrap command. Schema changes must be reviewed and reflected in the runtime migration process.

## Seed and data lifecycle

The initial synthetic dataset contains 5,000 voters across 12 districts, with 3,250 initially marked as voted and 1,750 not voted. Matching token, transaction and block records are generated for the voted population.

- `pnpm db:seed` is additive and does not overwrite existing voter state.
- `pnpm db:reset` truncates the voting tables and rebuilds the initial dataset. It is destructive.
- `pnpm db:verify` checks database structure and record relationships, then validates the blockchain ledger.

## API and security invariants

- Preserve existing endpoint paths and response shapes when changing shared services.
- Do not expose private validator keys or voter-to-ballot identity mappings through public portals.
- Base64 is encoding, not encryption.
- The current session-key handling is not a production key-custody design.
- District synchronization is simulated and does not implement distributed consensus.
- The current project has not been certified for real election operations. Do not use real voter records or conduct a real election with this software.

## Common commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

See [Getting started](../getting-started.md), [Troubleshooting](../troubleshooting.md) and [Project setup](../../project-setup.md) for operational instructions.
