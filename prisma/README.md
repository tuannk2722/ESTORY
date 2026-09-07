# PostgreSQL / Prisma operations (P3-02)

Schema contract: [roadmap §9.4–9.4c](../docs/11-phase3-technical-roadmap.md#94-prisma-schema-chốt-map-từ-typesstoryts-typesuserts-typesbookmarkts-typeseffect-admints)
and [domain models](../docs/02-data-schema.md). P3-02 adds the database foundation;
the application repository factory continues to use JSON.

## Runtime and environment

Use Node 24 LTS / pnpm 10.33.0. Prisma CLI, client and `@prisma/adapter-pg` are
pinned to **7.10.0**, with `pg` **8.23.0**. Prisma's registry `latest` was an 8.x
release candidate when selected; do not replace these pins with `latest`.
The generated client uses CommonJS to work with the existing Node test runner
without changing the application's package module type.

Copy [.env.example](../.env.example) to `.env.local`, beside `package.json`.
Prisma CLI and operational scripts use `@next/env`, matching Next.js env loading.
Set `NODE_ENV=production` when loading production-specific `.env` files; deployed
environments should inject their own variables. Never copy local credentials
into shared environment files or `NEXT_PUBLIC_*` variables.

| Environment | Connection ownership |
| --- | --- |
| Local development | Separate Neon dev branch/database; URLs in ignored `.env.local` |
| Vercel Preview | Separate preview branch/database; variables scoped to Preview |
| Vercel Production | Dedicated production branch/database; variables scoped to Production |
| CI | Disposable PostgreSQL 17 service; no Neon credentials |

Within each environment, `DATABASE_URL` and `DIRECT_URL` must point to the **same
branch/database**. Runtime uses Neon's pooled hostname (`-pooler`); migrations use
the direct hostname. Copy complete Neon URLs including SSL/channel-binding
parameters. Do not reuse production connections for development or preview.
CLI does not fall back to the pooled URL when `DIRECT_URL` is missing.

`SHADOW_DATABASE_URL` is optional for `migrate dev` if the database role cannot
create a shadow database. It must identify a disposable database separate from
all application databases. Prisma may reset its contents. The env parser rejects
the same database target as either configured application URL, including Neon
pooled/direct aliases.

The four `PHASE3_*` flags default to JSON/false. Invalid values and unsupported
Prisma/shadow cutovers fail at startup. Missing URLs are allowed for the current
JSON app and offline generation; importing the Prisma singleton requires a valid
`DATABASE_URL`. Later read/write stages must enable their adapters explicitly.

## Initial migration on an empty development database

The initial SQL was generated locally with:

```sh
pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script --output prisma/migrations/20260906000000_phase3_foundation/migration.sql
```

The committed SQL adds `BEGIN`/`COMMIT` around the generated DDL. Review this SQL
before applying it. It creates 19 models, five enums and their indexes/relations;
there is no seed/import step.

After configuring an empty **development** database:

```sh
pnpm db:check-empty
pnpm db:migrate:deploy
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
pnpm test:db
```

Stop on any failed command. The empty check is read-only and must pass before the
first deployment. The second deployment should report no pending migrations.
The schema diff must be empty (exit 0). Integration checks use the runtime pooled
URL and roll back all fixture writes; only migration-created schema/history remain.
Run these checks on dev/CI, not production. No test mocks PostgreSQL behavior.

For **subsequent development schema changes**, edit `schema.prisma`, run
`pnpm db:migrate:dev --name descriptive_change`, inspect the generated SQL and
commit it with the schema. Run `pnpm db:generate` explicitly after migration.
Do not rewrite an initial migration once applied to shared databases.

## Build and deployment

```sh
pnpm install --frozen-lockfile
pnpm db:format
pnpm db:validate
pnpm db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:client-bundle
```

Install/build generate the ignored client under `src/generated/prisma` without
connecting to a database. `src/lib/db/prisma.ts` is the server-only singleton;
development hot reload reuses its pool. Never import Prisma from a client
component or call `$disconnect()` after an application request.

Production schema changes run **only `pnpm db:migrate:deploy`**, as a separate
controlled release step using the production direct connection. Migrations do
not run from `postinstall`, `next build` or application startup. Never use
`migrate dev`, `migrate reset` or `db push` in production.

The `PostgreSQL foundation` CI job applies migrations to a fresh PostgreSQL 17
service, deploys again, checks status/schema drift and runs integration tests.
The build job needs no database connection and scans browser JS for Prisma code.
CI passing is separate evidence from a successful Neon migration or Vercel deploy.

## JSON and lifecycle boundaries

Use `src/lib/db/json-fields.ts` for database JSON reads and writes. It reuses
P3-01's Background/Scene schemas and validates the settings category map; malformed
snapshots fail without catalog fallback. These codecs are preparation for the
repositories/commands in later stages, not a Prisma extension intercepting every
raw client query. Raw SQL and direct client callers must not bypass validation.

Scene has no Background/Palette runtime FK. Preset and audio provenance use
`SetNull`; deleting a provenance record does not change copied render/audio data.
Service rules such as scope/ownership, non-overlap, manifest membership,
`activatedAt` set-once and hard-delete eligibility belong to their documented
command stages. Nullable timestamps are not database triggers enforcing lifecycle.
Never reset `activatedAt` on archive/reactivation. Never delete/overwrite media
objects as part of this schema migration or catalog record deletion.

## Rollback / failed migration recovery

1. Before a shared-environment migration, record the application revision,
   migration name and the Neon branch/restore point. Confirm available restore
   retention in that environment and keep the previous deployment available.
2. In P3-02 the app still reads/writes JSON: roll back the application revision
   if needed and leave the additive database schema in place. No database drop
   is needed to restore application behavior.
3. The initial DDL transaction rolls back on failure. Inspect
   `pnpm db:migrate:status` and migration history privately. Confirm the DDL was
   rolled back and resolve the cause before marking a **failed** migration:
   `pnpm exec prisma migrate resolve --rolled-back 20260906000000_phase3_foundation`.
   Then rerun deploy, status and schema diff. Do not mark a successful migration
   rolled back, edit migration history manually, or reset a shared database.
4. To repeat empty-database verification, create a new disposable dev branch or
   database and replace both local URLs. Keep the old branch until verification
   is complete; deleting it is a separate intentional action.
5. Once a later stage accepts real DB writes, JSON is no longer a rollback source.
   Use a reviewed forward migration or restore the Neon branch to the recorded
   point, update both scoped connection URLs, redeploy and verify data before
   reopening writes. Restore availability is an environment gate, not proven by
   the local build or these instructions.

Official references: [Prisma requirements](https://docs.prisma.io/docs/orm/reference/system-requirements),
[PostgreSQL adapters/connections](https://docs.prisma.io/docs/orm/core-concepts/supported-databases/postgresql),
[Prisma config and offline generation](https://docs.prisma.io/docs/orm/reference/prisma-config-reference).

## P3-04 legacy content migration

After the foundation migration and Auth admin bootstrap are verified, configure an exact
existing `LEGACY_OWNER_USER_ID` and run the P3-04 command sequence documented in the
[project README](../README.md#migration-json--prisma-p3-04). Dry-run and verify read the
database; apply writes all seed rows in one transaction. The importer preserves stable
legacy IDs/slugs, does not delete unrelated rows, and fails on ownership/ID collisions or
unknown EffectDefinition IDs.

The second apply is an idempotency gate, not a retry after an unexplained failure. Record
the first failure, inspect the safe error, and rerun dry-run after resolving it. Keep the
environment restore point until verify passes. Runtime repositories remain on JSON during
P3-04, so do not enable Prisma read/write flags as part of this operation.
