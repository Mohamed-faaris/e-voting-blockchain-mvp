# Monorepo migration

## Workspace layout

```text
apps/
  admin/                 # Existing React/Vite operations UI
    src/                 # Existing pages and components retained
    public/models/       # Face detection model assets
  api/                   # Hono API, blockchain and storage
    src/
      blockchain/
      storage/
      server.ts
packages/                # Shared packages to extract in later phases
api/index.ts             # Vercel adapter for the Hono API
src/                     # Removed after source migration
```

## Runtime architecture

- `apps/api` owns the Hono HTTP API, blockchain implementation and current SQLite/Turso storage adapter.
- `apps/admin` owns the existing React application and runs as an independent Vite app.
- The Vite development server proxies `/api`, `/chain` and `/demo` to the Hono API on port 3000.
- The root PNPM workspace and Turborepo coordinate both applications.
- The existing Vercel API adapter imports the moved Hono app without changing API paths.

## Target applications

- `apps/admin`: Election Command Center
- `apps/voter`: Voter Portal
- `apps/explorer`: Blockchain Explorer
- `apps/candidate`: Candidate Portal
- `apps/api`: shared Hono backend

The current frontend routes are preserved in the admin compatibility application for this migration phase. They will be split into role-specific apps after shared API contracts and navigation boundaries are established.

## Target shared packages

- `packages/ui`: shared UI primitives
- `packages/design-system`: design tokens and themes
- `packages/contracts`: shared Zod schemas and API types
- `packages/api-client`: typed API client
- `packages/database`: Drizzle schema, migrations and PostgreSQL client
- `packages/blockchain`: shared chain, hashing and Merkle verification logic
- `packages/seed`: deterministic synthetic demo dataset

## Migration safety

1. Preserve existing API paths and response shapes.
2. Keep the current SQLite/Turso adapter until a PostgreSQL adapter has parity tests.
3. Do not rewrite blockchain algorithms during the workspace move.
4. Use synthetic voter data only.
5. Do not expose private validator keys or voter-to-ballot links through browser APIs.
6. Do not describe Base64 ballot encoding as encryption or simulated district sync as distributed consensus.

## Commands

```zsh
corepack enable
pnpm install
pnpm dev
pnpm build
pnpm test
```

The API and admin frontend can also be run separately:

```zsh
pnpm --filter @evoting/api dev
pnpm --filter @evoting/admin dev
```

## Next steps

1. Extract reusable UI, API contracts and database interfaces into packages.
2. Add separate voter, candidate and public explorer applications.
3. Add Drizzle/PostgreSQL behind the storage interface and run parity tests.
4. Add a deterministic synthetic 5,000-voter dataset and validate voter counts, chain hashes, Merkle roots and signatures.
