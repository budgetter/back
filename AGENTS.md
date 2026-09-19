# Backend Agent Instructions

Canonical rules for anyone (human or AI agent) working in this repo. `CLAUDE.md` and `GEMINI.md` in this directory both just import this file — edit here, not there.

This repo may be checked out standalone (its own git remote), so don't assume `../docs/`, `../CLAUDE.md`, or anything else outside this directory exists. If you do have the full `budgetter/` monorepo checkout, `../docs/WIKI.md` has more historical detail than what's summarized here.

## What this is

Express + Sequelize 6 (MySQL) API. Ships as a single Netlify serverless function in production; runs standalone via `netlify dev` or Docker for local development. See `README.md` for exact run instructions — this file is about how to write code here, not how to start it.

## Architecture

```
back/
├── app.js                — Production entry point. Wrapped by serverless-http in functions/api.js.
├── server.js              — Dev entry point (netlify dev). Runs migrations + seeders on startup
│                            when NODE_ENV=development. Also starts scheduledSyncService (cron).
├── docker/server.js       — Docker-only: wraps app.js with a plain .listen() call, since
│                            neither app.js nor server.js ever call .listen() themselves.
├── config/
│   ├── database.js        — Sequelize instance (singleton via global.sequelize)
│   ├── config.js          — sequelize-cli config (reads the same DB_* env vars)
│   └── passport.js
├── controllers/           — Route handlers
├── routes/                — Express route definitions
├── models/
│   ├── index.js            — All associations (belongsTo/hasMany/belongsToMany) live here,
│   │                          not in individual model files (a few models also export a
│   │                          .associate(models) but most associations are wired in index.js)
│   └── *.js                — One Sequelize model per file
├── migrations/             — Sequelize migrations (see "Migrations" below — mandatory reading)
├── services/                — Business logic (categoryResolver, performSync, scheduledSyncService)
├── parsers/                  — Bank email parsers (BankParsers.js)
├── middlewares/               — authMiddleware (authenticateToken → req.user.id), etc.
├── functions/api.js            — Netlify Function entry, wraps app.js with serverless-http
└── netlify.toml                  — Build command runs migrations; [dev] block sets local port 8888
```

## Critical rule: dual route registration

There are **two Express app entry points**: `app.js` (production) and `server.js` (`netlify dev`). A new route registered in only one of them will 404 in the other environment. Always add new route mounts to both.

## Critical rule: migrations

**All migrations must be idempotent** — check tables/columns/indexes exist before creating/altering them, using helpers like:

```js
async function tableExists(qi, name) { return (await qi.showAllTables()).includes(name); }
async function columnExists(qi, table, col) { return !!(await qi.describeTable(table))[col]; }
async function indexExists(qi, table, name) { return (await qi.showIndex(table)).some(i => i.name === name); }
```

Why this matters more than usual here:

- **12 core tables predate the migration system entirely.** `users`, `groups`, `roles`, `permissions`, `role_permissions`, `user_groups`, `categories`, `budgets`, `budget_sections`, `budget_category_plans`, `transactions`, and `recurrent_payments` were created by an old `sequelize.sync()` call before this project had migrations, and never had a `createTable` migration. `migrations/20250401000000-baseline-core-tables.js` creates them for a genuinely fresh database, guarded by `tableExists` so it's a no-op everywhere else. **Never call `sequelize.sync()` anywhere in app code** — if you do, you reintroduce this exact class of bug for the next new column you add without a migration.
- If you ever touch that baseline migration: it recreates each table in its **pre-migration** shape (not the current model shape). `migrations/20251221223534-add-walletId-to-transactions.js` is not idempotent — it unconditionally `addColumn`s several fields — so if the baseline already had them, a fresh install fails with "Duplicate column". Re-derive columns from the *first* migration that ever touches a table, not from the current model file.
- **Don't add a real FK constraint on `transactions.categoryId`, `budget_category_plans.categoryId`, or `recurrent_payments.categoryId`/`userId`/`groupId`.** `migrations/20260528000002-drop-old-categoryId-fk-constraints.js` removes FK constraints by their MySQL auto-generated name (`transactions_ibfk_2`, etc.), which is purely positional (the Nth FK defined on that table in `CREATE TABLE` order). Adding a real FK there shifts the numbering and makes that migration silently drop the **wrong** constraint on a fresh database instead of no-op'ing.
- FK constraints need **both** the model's `allowNull` and a migration's `queryInterface.changeColumn()` — changing only the model does nothing to the database.
- Always implement a reversible `down()`, also with existence checks. Drop tables in reverse dependency order.
- Seeders (`models/seeders/*`) only run in development (`server.js`), never in production or in the Docker path.

## Critical rule: category system

- **Only use `userCategoryId`** — never `categoryId` — for any new operation. `categoryId` columns still exist for legacy/backfill reasons but have no FK constraint and aren't the source of truth.
- Name resolution: `uc?.customName || uc?.Category?.name || 'Unknown'`.
- Any query including `UserCategory` **must** nest `Category`: `include: [{ model: Category, required: false }]` — otherwise name resolution silently falls through to "Unknown".
- `UserCategoryMappings.categoryId` stores `user_categories.id`, not `categories.id`.
- `GlobalCategoryMappings.categoryName` stores a `translationKey`, not a display name.

## Other conventions

- Auth: `const { authenticateToken } = require('../middlewares/authMiddleware')`; authenticated user is `req.user.id`.
- **Never** `new Date('YYYY-MM-01')` for month/year handling — parse year and month as numbers manually (timezone bugs).
- Coerce empty-string FK fields to `null` before insert/update: `value || null`.
- Prefer raw SQL over Sequelize `fn`/`col` for grouped/aggregate queries — known correctness issues with the ORM helpers here.
- No new npm dependencies without asking — check `package.json` for what's already available first.

## Docker specifics (see `README.md` §1 for how to run it)

- The container runs `app.js` via `docker/server.js`, **not** `server.js`. That means: no `GET /api/` health route, no dev-only seeders, no `scheduledSyncService` cron — those only exist in the `netlify dev` path.
- `DB_HOST`/`DB_USER` are forced to `db`/`root` by `docker-compose.yml` regardless of `.env`; only `DB_PASS`/`DB_NAME` from `.env` matter for the database, and `DB_PASS` must be non-empty (the `mysql:8` image refuses an empty root password on first init).
- If you ever touch the `db` service's healthcheck: use `mysqladmin ping -h 127.0.0.1 --protocol=tcp`, not a bare `-h localhost` ping. The official MySQL image runs a socket-only "temporary server" during first-boot init scripts that answers a plain ping successfully *before* the real server binds to TCP 3306 — a non-TCP healthcheck reports healthy too early and the dependent `backend` container starts before the DB is actually reachable.

## Testing

- `npx jest --runInBand` (from this directory).
- Existing tests use `sequelize.sync({ force: true })`, which drops and recreates all tables — **never** point `DB_NAME` at a real dev/prod database while running them. Use a separate test database or mock the DB layer. Prefer transactions that roll back per test, or targeted `beforeEach` cleanup for new tests.

## If you discover a new gotcha

Add it to this file (or `docs/WIKI.md` if you have the full monorepo checkout) — don't let it live only in a commit message or your own memory.
