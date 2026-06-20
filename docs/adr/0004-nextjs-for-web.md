# 0004. Next.js for web

- Status: Accepted
- Date: 2026-06-24
- Deciders: DomusOS team

## Context

DomusOS needs a web application built with React that integrates with the shared Convex backend.

## Decision

Use Next.js 16 with the App Router and React 19.

## Consequences

- First-class Convex integration (documented patterns, community support).
- SSR/SSG available if SEO or performance requires it.
- App Router provides React Server Components for future optimization.
- Industry-standard framework with large ecosystem and hiring pool.
- Adds Vercel-specific conventions that may not transfer to other frameworks.

## Alternatives considered

- **Vite + React (SPA)**: Lighter, faster dev server, simpler config. But SPA-only — no SSR/SSG, weaker Convex integration docs, and would need manual routing setup.
- **Remix**: Strong SSR story but smaller ecosystem than Next.js. Convex integration less documented.
