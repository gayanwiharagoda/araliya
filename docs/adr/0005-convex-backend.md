# 0005. Convex as backend and database

- Status: Accepted
- Date: 2026-06-24
- Deciders: DomusOS team

## Context

DomusOS needs a backend with real-time data sync across web and mobile clients, with type-safe queries and mutations.

## Decision

Use Convex as the backend platform and database. Convex functions (queries, mutations, actions) live in `packages/backend/convex/`. Both apps import from this shared package.

## Consequences

- Real-time sync out of the box — no WebSocket setup, no cache invalidation.
- End-to-end TypeScript type safety from schema to client queries.
- No REST API layer to build or maintain.
- Managed hosting eliminates infrastructure ops.
- Vendor lock-in: data and functions are Convex-specific. Migration would require rewriting the data layer.
- Schema changes require Convex migrations.
- `_generated/` directory must be generated before typecheck passes; stubs are provided for local development.

## Alternatives considered

- **Supabase (Postgres + Realtime)**: Open-source, SQL-based, self-hostable. But requires separate API layer, manual real-time setup, and more infrastructure management.
- **Firebase**: Real-time capable but NoSQL with weaker TypeScript support. Vendor lock-in without the type-safety benefits.
- **Custom backend (Express/Fastify + DB)**: Maximum control but significant boilerplate. Would need to build real-time sync, auth, and hosting from scratch.
