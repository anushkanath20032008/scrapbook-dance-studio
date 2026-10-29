# Studio simplify: handoff (2026-10-29)

Branch `feat/studio-simplify` (worktree `scrapbook-release`), not yet pushed. Plan: `docs/plans/2026-10-28-1400-feat-studio-simplify-plan.md` (requirements only).

## Built
- Console menu: five groups (Overview, Dancers, Money, Attendance, Studio) with tab strips; old paths unchanged (`src/lib/console-nav.ts`).
- Photo import: server function reads a register page (`ANTHROPIC_API_KEY`), rows land in the paste review table. Quota table `photo_reads` (0023).
- Make-up classes: migration 0022, screen `/app/makeups`, open to owner and Dance teacher.
- Studio+ WhatsApp: migration 0024 (opt-in column, `claim_due_reminders` gated on Studio+ and opt-in, `record_delivery_status`), webhook `/api/webhooks/whatsapp`, controls on Messages.
- Nav link font: Space Grotesk.

## Live database
0021, 0022, 0023 are applied. **0024 is not applied**: apply it (additive) before the deployed code runs, or the Messages page will error.

## Not done
- Photo import does not create batches or fee plans from the page (R5).
- Messages tab is hidden until WhatsApp keys exist, so its "not switched on" text is only reachable by URL.
- Full multi-agent code review and a browser test have not run.

## Founder-only
`ANTHROPIC_API_KEY`; Meta Business verification, number 9319260524, approved template; `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` in Vercel; webhook URL `https://www.choreostudio.live/api/webhooks/whatsapp`; push the branch.
