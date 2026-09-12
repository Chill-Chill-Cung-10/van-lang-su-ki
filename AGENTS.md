<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

# Project Agent Guidelines

## Mandatory CodeGraph workflow

CodeGraph is the default source of repository context because it returns relevant source, symbols, and call paths together, which is usually far more token-efficient than opening many files or running broad text searches.

1. At the start of every coding task, run `codegraph status`.
2. If the index is not current, run `codegraph sync` before investigating code.
3. Use `codegraph explore "<question or symbols>"` before `rg`, `grep`, `find`, or opening multiple source files.
4. Use `codegraph node <symbol>`, `codegraph callers <symbol>`, `codegraph callees <symbol>`, and `codegraph impact <symbol>` when the task needs a focused dependency trail.
5. Fall back to `rg` or direct file reads only for non-code assets, text not indexed by CodeGraph, or when CodeGraph reports no useful match.
6. After changing code, run `codegraph sync` before verification and before handing off work. Confirm `codegraph status` reports the index is up to date.
7. Never delete or rebuild `.codegraph/` unless the user explicitly requests it or the index is proven corrupt. Prefer `codegraph sync`; use `codegraph index` only when a full rebuild is necessary.

## Karpathy coding guidelines

The repository-local skill at `.agents/skills/karpathy-guidelines/SKILL.md` applies whenever writing, reviewing, debugging, or refactoring code. Load it before implementation and follow its four principles:

- Think before coding: state assumptions, surface ambiguity, and explain material tradeoffs.
- Simplicity first: implement the minimum solution that satisfies the request; avoid speculative abstractions.
- Surgical changes: touch only the lines and files required; preserve existing style and unrelated user work.
- Goal-driven execution: define observable success criteria, then test and iterate until they pass.

## Project structure

- `frontend/src/app`: Next.js frontend routes, components, Phaser gameplay, and 3D avatar UI.
- `backend/src/routes`: Fastify REST API endpoints.
- `backend/src/server`: server-only database, storage, and environment adapters.
- `infra`: Docker Compose service initialization and database schema.
- `docs/requirements`: approved Version 0 requirements.
- `docs/references`: source documents used to derive requirements.
- `assets/references`: raw visual references, not production-optimized assets.

## Required verification

- Run `pnpm lint`, `pnpm typecheck`, and `pnpm build` for application changes.
- Run `docker compose config --quiet` for Docker Compose changes.
- Update `CHANGELOGS.md` for user-visible or versioned changes.
- Never commit real secrets. Keep actual values in ignored `.env` files and maintain the corresponding `.env.example` files.
