@AGENTS.md

# Picking this project up

Read `docs/handoff/2026-10-16-choreostudio-handoff.md` first: it records the current state, the rules the user set, and what to build next. The authoritative plan is `docs/plans/2026-10-16-1556-feat-studio-owner-console-plan.md`.

Type-check with `node node_modules/typescript/bin/tsc --noEmit -p .` (not `npx tsc`). Run tests with `npx vitest run`. Build with `npm run build`.
