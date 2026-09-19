# Budgetter Backend

Express + Sequelize (MySQL) API. Ships two ways:

- **Serverless (production):** `app.js` wrapped by `serverless-http`, deployed as a single Netlify Function (`functions/api.js`). This is how the live app runs — there is no long-running server process in production.
- **Local dev / standalone:** either `netlify dev` (emulates the Function locally) or the Docker Compose stack in this repo, which runs the app as a plain listening process (`docker/server.js`) alongside a MySQL container.

Pick the section below for what you're doing.

---

## 1. Local development with Docker (recommended — includes the DB)

Brings up MySQL and the API together, runs migrations automatically, no local MySQL install needed.

```bash
cp .env.example .env   # fill in JWT_SECRET, ENCRYPTION_KEY at minimum
docker compose up --build
```

(`docker-compose up --build` also works if your Docker install doesn't have the `compose` plugin.)

- API: **http://localhost:3000/api**
- `DB_HOST`/`DB_USER` are forced to `db`/`root` inside the container regardless of what's in `.env` — only `DB_PASS` and `DB_NAME` from `.env` matter for the database. `DB_PASS` must not be empty (see `.env.example`).
- Migrations run automatically on every container start (`npx sequelize-cli db:migrate` in the `Dockerfile` `CMD`) — safe to restart repeatedly.
- The container runs `app.js`, **not** `server.js`: no `GET /api/` health route, no dev-only seeders, no `scheduledSyncService` cron. It's the same code path as production, just listening on a port via `docker/server.js` instead of being wrapped by `serverless-http`.
- Data persists in the `budgetter_db_data` Docker volume across restarts. To start over: `docker compose down -v`.
- To seed default/system categories inside the container: `docker compose exec backend npm run seed` (only seeds `defaultCategories`; system categories come from migration `20260527000003-seed-system-categories.js`, which already ran).

## 2. Local development without Docker (`netlify dev`)

Requires your own MySQL instance already running and reachable.

```bash
cp .env.example .env   # point DB_HOST/DB_USER/DB_PASS/DB_NAME at your MySQL instance
npm install
npm start               # npx netlify dev
```

- API: **http://localhost:8888/api** (port comes from `netlify.toml`'s `[dev]` block — not 3000, and not the raw Express port).
- Migrations + seeders (`defaultCategories`, `systemCategoriesHierarchy`) run automatically on startup, but **only when `NODE_ENV=development` exactly** (`server.js`'s `initializeDatabase()`). If migrations aren't running, check that first.
- The target database must already exist on your MySQL server — `db:migrate` does not create it. `CREATE DATABASE <DB_NAME>;` first if it's a brand-new instance.
- To run migrations manually instead of relying on auto-migrate: `npm run migrate`.
- Point the frontend's `VITE_API_BASE_URL` at `http://localhost:8888/api` to match.

## 3. Serverless / production (Netlify)

This is how the app is actually deployed — no `docker compose`, no `netlify dev`.

- `netlify.toml`'s build command runs `npm install && npx sequelize-cli db:migrate && npm run build`, then Netlify packages `functions/api.js` (which wraps `app.js` with `serverless-http`) as a Function.
- Migrations run once, during the build step, against whatever `DB_HOST`/`DB_NAME`/etc. are set in the Netlify site's environment variables (not a local `.env` file).
- New routes must be registered in **both** `app.js` (used here) and `server.js` (used by `netlify dev`) — see `AGENTS.md`.
- Push to the branch Netlify is configured to deploy from; there's no separate manual deploy step for the backend.

---

## Environment variables

See `.env.example` for the full list (DB connection, `JWT_SECRET`, `ENCRYPTION_KEY`, Google OAuth, VAPID push keys). `ENCRYPTION_KEY` is required at startup — the process exits immediately if it's missing (`utils/encryption.js`).

## Tests

```bash
npx jest --runInBand
```

Tests use `sequelize.sync({ force: true })` against a separate test database — never point `DB_NAME` at your dev/prod database while running them.

## More detail

- `AGENTS.md` — architecture, code style, and rules an AI agent (or a human) should follow when changing this codebase.
- `docs/WIKI.md` in the monorepo root — deeper gotchas and historical context (only available if you have the full `budgetter/` checkout, not a standalone clone of this repo).
