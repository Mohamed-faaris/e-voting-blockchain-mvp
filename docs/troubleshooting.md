# Troubleshooting

Use this guide to diagnose common local development, workspace, database and deployment problems.

## Dependency installation

### PNPM version mismatch

The repository declares PNPM 10.28.2 in the root `package.json`.

```bash
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm --version
pnpm install
```

If the lockfile and manifests are out of sync after a dependency change:

```bash
pnpm install --no-frozen-lockfile
git status --short
```

Review and commit the resulting `pnpm-lock.yaml`. Do not delete the lockfile as a routine fix.

### Native dependency build failures

Some dependencies require install scripts or native build tooling. The workspace allows build scripts for `better-sqlite3` and `esbuild`. Check the PNPM install output and install the required compiler/build tools for your operating system if a native package fails.

## Application startup

### Port is already in use

The default ports are 3000 (API), 5173 (Admin), 5174 (Voter), 5175 (Candidate) and 5176 (Explorer).

Find the process using a port:

```bash
sudo ss -ltnp | grep -E ':3000|:5173|:5174|:5175|:5176'
```

Stop the conflicting process or configure a different port in the relevant app's Vite configuration. Keep the API proxy target and frontend URL configuration aligned if you change ports.

### A frontend loads but API requests fail

1. Confirm the API is running at `http://localhost:3000`.
2. Open `http://localhost:3000/api/health`.
3. Check that the frontend's Vite config proxies `/api` and `/chain` to port 3000.
4. For separate deployments, set `VITE_API_BASE_URL` to the API origin before building the frontend.
5. Check the browser Network panel for the failing request and response.

Local Vite proxying is used when `VITE_API_BASE_URL` is empty.

### Browser reports a CORS error

Set `ALLOWED_ORIGINS` in the API environment to a comma-separated list of exact frontend origins, including scheme and hostname:

```dotenv
ALLOWED_ORIGINS=https://admin.example.com,https://voter.example.com,https://candidate.example.com,https://explorer.example.com
```

Restart the API after changing the environment. Do not use `*` as the origin for an API that accepts state-changing voting requests.

## PostgreSQL and database commands

### Connection refused

Check the container and health status:

```bash
docker compose ps
docker compose logs postgres
docker compose exec postgres pg_isready -U evoting -d evoting
```

Start PostgreSQL if it is stopped:

```bash
docker compose up -d postgres
```

Confirm that `DATABASE_URL` points to the same host, port, database and credentials. The default local connection is `postgres://evoting:evoting_dev_only@localhost:5432/evoting`.

### `DATABASE_URL is required`

The database scripts load the root `.env` file. Ensure it exists:

```bash
test -f .env || cp .env.example .env
grep '^DATABASE_URL=' .env
```

Do not paste credentials into issue reports or commit the `.env` file.

### Migration succeeds but tables are missing

Run the migration from the repository root and inspect the database:

```bash
pnpm db:migrate
docker compose exec postgres psql -U evoting -d evoting -c '\\dt'
```

The current runtime migration is the idempotent SQL in `packages/database/src/migrate.ts`. `pnpm db:generate` creates Drizzle migration artifacts, but those generated files are not automatically applied by the current `db:migrate` script. When changing the schema, review generated SQL and update the runtime migration path.

### Seed reports an unexpected voter count

Run the commands in order:

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

The seed is additive and uses conflict-safe inserts. It does not reset records that already exist. If the dataset is partially initialized, inspect the voter and ledger tables before deciding how to recover.

`pnpm db:reset` rebuilds the baseline dataset, but it is destructive: it truncates voters, tokens, transactions and blocks. Back up any data that must be retained before using it.

### Database verification fails

Run both verification layers:

```bash
pnpm --filter @evoting/database db:verify
pnpm --filter @evoting/api db:verify
```

The first checks table presence, voter counts, token states and structural links. The API ledger verifier validates block hashes and the deterministic transaction set. Read the first reported failure and inspect the corresponding records before reseeding.

### Drizzle Studio cannot connect

Check `DATABASE_URL`, then run:

```bash
pnpm db:studio
```

Drizzle Studio needs access to the configured PostgreSQL database. Keep it bound to a trusted development environment and do not expose it publicly.

## Build, type-check and test failures

Run the checks independently to isolate a failure:

```bash
pnpm build
pnpm typecheck
pnpm test
```

For one workspace:

```bash
pnpm --filter @evoting/api build
pnpm --filter @evoting/api typecheck
pnpm --filter @evoting/api test
pnpm --filter @evoting/admin build
```

If a shared package changed, rebuild its dependants. Turborepo uses workspace dependency relationships to order package builds.

## Deployment

### Frontend deployment calls the wrong API

Set `VITE_API_BASE_URL` in each frontend project's build environment to the deployed API origin. Vite variables are embedded at build time, so trigger a new build after changing them.

### API rejects deployed frontend requests

Add the exact deployed frontend origins to the API's `ALLOWED_ORIGINS` environment variable, then redeploy the API.

### Vercel detects the wrong project root

This repository is a monorepo. Configure each Vercel project with the correct workspace root:

- `apps/admin`
- `apps/voter`
- `apps/candidate`
- `apps/explorer`

The API project should use `apps/api` as its root and the appropriate Node/Hono build configuration. Ensure the Vercel project is configured to include workspace packages outside the app directory. Do not assume the repository root is the API entry point.

## Still blocked?

When reporting an issue, include:

- The exact command you ran.
- The workspace name and operating system.
- The complete error message and relevant stack trace.
- Whether PostgreSQL is local Docker or a hosted service.
- The output of `pnpm --version` and `node --version`.

Redact passwords, connection strings, tokens, private keys and voter information before sharing logs.
