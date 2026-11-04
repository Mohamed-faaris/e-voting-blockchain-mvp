# Getting started

This guide takes you from a fresh checkout to all four frontends and the Hono API running locally.

## 1. Prerequisites

Install the following before continuing:

- Node.js 22 or newer.
- Corepack (included with supported Node.js distributions).
- PNPM 10.28.2 (the repository pins this version through `packageManager`).
- Docker Engine and the Docker Compose plugin, or an accessible PostgreSQL 17 instance.
- Git.

Check your versions:

```bash
node --version
corepack --version
docker --version
docker compose version
```

## 2. Clone and install

```bash
git clone https://github.com/Mohamed-faaris/e-voting-blockchain-mvp.git
cd e-voting-blockchain-mvp

corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install
```

Use the lockfile with a normal `pnpm install`. If PNPM reports that the lockfile needs updating after changing workspace manifests, run `pnpm install --no-frozen-lockfile`, review the lockfile diff, and commit the updated lockfile.

## 3. Configure the environment

Create the root environment file:

```bash
cp .env.example .env
```

The default local values are:

```dotenv
DATABASE_URL=postgres://evoting:evoting_dev_only@localhost:5432/evoting
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176

VITE_API_BASE_URL=
VITE_ADMIN_URL=http://localhost:5173
VITE_VOTER_URL=http://localhost:5174
VITE_CANDIDATE_URL=http://localhost:5175
VITE_EXPLORER_URL=http://localhost:5176
```

Keep `VITE_API_BASE_URL` empty for local development. The Vite applications proxy API requests to `http://localhost:3000`. For a separately hosted frontend, set this variable to the API's absolute public origin at frontend build time.

Never commit `.env` or production credentials.

## 4. Start PostgreSQL

The repository includes a PostgreSQL 17 service in the root `docker-compose.yml`:

```bash
docker compose up -d postgres
docker compose ps
```

Wait until the service reports healthy. Check connectivity:

```bash
docker compose exec postgres pg_isready -U evoting -d evoting
```

If using an external PostgreSQL service, skip Docker and set `DATABASE_URL` in the root `.env` to that database's connection string.

## 5. Create and populate the database

Run the commands from the repository root:

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

The seed creates 5,000 synthetic voter records across 12 districts. The initial dataset marks 3,250 voters as voted and 1,750 as not voted, and creates matching sample ballot transactions, token records and district blocks. The seed is deterministic and uses conflict-safe inserts; it does not overwrite existing voter state.

The root `pnpm db:seed` command also builds the database package and runs the ledger seeder. `pnpm db:verify` checks database structure and the blockchain ledger.

> **Destructive operation:** `pnpm db:reset` truncates the voting tables and recreates the initial dataset. It deletes existing voter, token, transaction and block state. Do not run it against a database containing information you need to retain.

## 6. Start the applications

Start all workspaces:

```bash
pnpm dev
```

Or run each service in a separate terminal:

```bash
pnpm dev:api
pnpm dev:admin
pnpm dev:voter
pnpm dev:candidate
pnpm dev:explorer
```

Local addresses:

| Application | URL |
|---|---|
| Admin | http://localhost:5173 |
| Voter | http://localhost:5174 |
| Candidate | http://localhost:5175 |
| Blockchain Explorer | http://localhost:5176 |
| API health | http://localhost:3000/api/health |
| API information | http://localhost:3000/api/info |

## 7. Validate the workspace

In another terminal, run:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm db:verify
```

The first three commands run the workspace build, TypeScript checks and tests through Turborepo. Database verification requires a reachable PostgreSQL instance and an initialized dataset.

## 8. Useful database commands

| Command | Description |
|---|---|
| `pnpm db:generate` | Generate Drizzle migration artifacts after schema changes |
| `pnpm db:migrate` | Apply the repository's idempotent PostgreSQL schema setup |
| `pnpm db:seed` | Add the initial synthetic voter and ledger dataset without overwriting existing records |
| `pnpm db:reset` | Destructively rebuild the initial dataset |
| `pnpm db:verify` | Validate database structure, records and ledger integrity |
| `pnpm db:studio` | Open Drizzle Studio |

The current `db:migrate` script runs `packages/database/src/migrate.ts`, which contains the SQL statements used to create the runtime tables. Generating a Drizzle migration does not automatically update that bootstrap script; review generated SQL and update the runtime migration process deliberately when changing the schema.

## 9. Next steps

- Read [Project setup](../project-setup.md) for workspace boundaries, scripts and deployment configuration.
- Read [Troubleshooting](./troubleshooting.md) if a service fails to install, start, connect to PostgreSQL or communicate across origins.
- Review [Monorepo architecture](./architecture/monorepo-migration.md) before changing application or package boundaries.
