# Monorepo migration

## Decision

Use a PNPM workspace managed by Turborepo. Keep one Hono API and one PostgreSQL database. The four user experiences will become independently buildable Vite applications:

- `apps/admin`: Election Command Center
- `apps/voter`: Voter Portal
- `apps/explorer`: Blockchain Explorer
- `apps/candidate`: Candidate Portal
- `apps/api`: shared Hono API

Shared packages will be introduced as code is extracted:

- `packages/ui`: shadcn/ui-based shared primitives
- `packages/design-system`: light theme tokens and styles
- `packages/contracts`: shared Zod schemas and API types
- `packages/api-client`: typed API client
- `packages/database`: Drizzle schema, migrations and PostgreSQL client
- `packages/blockchain`: shared chain, hashing and Merkle verification logic
- `packages/seed`: deterministic synthetic demo dataset

## Migration safety rules

1. Do not rewrite voting or blockchain algorithms as part of the initial workspace bootstrap.
2. Keep the current SQLite/Turso adapter working until the PostgreSQL adapter has parity tests.
3. Preserve existing API paths and response shapes during the frontend migration.
4. Keep the current application runnable through the `*:legacy` scripts until all code has moved.
5. Do not commit database credentials or generated private keys.
6. Treat all voter and ballot seed data as synthetic.
7. Do not claim that the demo's Base64 ballot encoding is encryption or that district simulation is distributed consensus.

## Current bootstrap

The root package remains the temporary legacy runtime. `apps/api` is the first workspace boundary and delegates to that runtime. This deliberately avoids moving source files before path aliases, asset paths, runtime working directories and deployment configuration have been audited.

## Next migration steps

1. Move the Hono server, blockchain and storage code into `apps/api`.
2. Move the existing React/Vite UI into `apps/admin` as a temporary compatibility frontend.
3. Extract shared packages.
4. Add the other three Vite applications.
5. Introduce Drizzle/PostgreSQL behind a storage interface and migrate data with parity checks.
6. Add the deterministic 5,000-voter seed generator and integrity verifier.
