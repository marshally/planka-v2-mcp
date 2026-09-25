# Resolved Card Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** Return assigned label IDs and resolved labels on list cards, individual cards, card details, and board summaries.

**Architecture:** Join `included.cardLabels` with label definitions using one shared mapper. Board summaries obtain cards, lists, label definitions, and assignments from one board response. List/card endpoints obtain board label definitions at most once per board per operation when needed; no global cache or per-card hydration requests for board summaries.

**Tech Stack:** TypeScript, Zod, Jest ESM, existing PLANKA request client.

## Approved contract

- Preserve existing response envelopes. Add `labelIds: string[]` and `labels: { id: string; name: string | null; color: string }[]` to read cards.
- Only assigned labels belong on cards. Cards without assignments have empty arrays. Duplicate assignments must not duplicate results. A dangling label ID can remain in `labelIds`, but must not produce a fabricated label.
- Board summaries retain their board-wide `labels` catalog and all current statistics/task/comment options. Urgent/bug counts must reflect assigned labels.
- Card-details top-level `labels` must match its card's labels, never the board-wide catalog.
- Preserve base card parsing and write response behavior. Do not default unhydrated write responses to fabricated empty label arrays.
- Use existing request-context credentials; no process-global cache.
- No deployment, publishing, auth changes, or unrelated refactoring.

## Task 1: Resolve card labels across existing read operations

**Files:**
- Create `common/card-labels.ts` for the shared typed mapping.
- Modify `common/types.ts` for the resolved-label/card read types as necessary.
- Modify `operations/cards.ts` for list/single-card hydration.
- Modify `operations/boards.ts` for a board snapshot reader while preserving `getBoard`'s response contract.
- Modify `tools/board-summary.ts` to consume that snapshot and `tools/card-details.ts` to expose assigned labels.
- Add `tests/unit/card-labels.test.ts` and `tests/unit/board-summary.test.ts`; revise `tests/unit/card-details.test.ts` fixtures/assertions.
- Update the relevant read-response documentation in `wiki/API-Reference.md`.

- [ ] Write boundary regression tests before implementation, mocking only `plankaRequest` so parsing and mapping execute for real. Use two cards with different assignments and at least one unused board label. Assert exact IDs/names/colors, empty arrays, and absence of unrelated labels.

```ts
expect(cards[0]).toMatchObject({
  labelIds: ['label-bug'],
  labels: [{ id: 'label-bug', name: 'Bug', color: 'berry-red' }],
});
expect(cards[1]).toMatchObject({ labelIds: [], labels: [] });
```

- [ ] Run `npm test -- --runInBand tests/unit/card-labels.test.ts tests/unit/board-summary.test.ts tests/unit/card-details.test.ts`. Record expected assertion failures before editing production code. Add subsequent edge-case tests before their implementation.
- [ ] Implement the shared mapper with maps keyed by label ID and card ID. Deduplicate assigned IDs, project label objects to ID/name/color, and attach the arrays after raw card parsing. Keep raw/write schemas usable without label fields.
- [ ] Wire card list/single-card reads to retained `included.cardLabels` and label definitions. Resolve missing boardId through the existing list reader if needed; skip catalog lookup when no assignments require resolving. Fetch once per board, not once per card. Never fabricate labels on missing definitions or lookup failures.
- [ ] Make board-summary reads use one snapshot containing `item` and `included.{lists,cards,labels,cardLabels}`. Group hydrated cards by list while retaining existing task/comment option behavior. Test one board HTTP request for the default summary, correctly separated assignments, urgent/bug counts, and optional tasks/comments.
- [ ] Remove the board-catalog substitution from card details. Update existing tests that currently encode that incorrect behavior and retain meaningful coverage of missing board IDs and orphaned lists where resolution is needed.
- [ ] Document the additive fields and the distinction between board catalog and assigned card labels, with the example above.
- [ ] Run focused tests, then `npm run qc`. Self-review and commit focused changes. Report exact red/green commands and counts.

## Review and completion

- [ ] Independent spec review against the approved contract; implementer fixes and reviewer rechecks any gaps.
- [ ] Independent code-quality review of the complete diff; implementer fixes and reviewer rechecks any important issues.
- [ ] Final build/unit checks and clean status; retain the requested branch/worktree and report verification limits.

## Baseline

- Worktree: `/Users/marshallyount/code/marshally/planka-v2-mcp-card-labels`, branch `fix/card-labels`, base `32d536c`.
- `npm ci --no-audit --no-fund` succeeded without lockfile changes.
- Build passed; 4 unit suites / 37 tests passed. Existing output includes the Jest VM-modules warning, orphan-list error log, and worker force-exit warning.
- Published PLANKA OpenAPI was checked during investigation: board GET includes labels and cardLabels; list-card and single-card GET include cardLabels but not the label catalog. Live deployed-instance acceptance has not been performed.
