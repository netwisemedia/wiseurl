# WiseURL Source Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe WiseURL HTML handoff and owner-scoped source-site analytics report whose summaries, drilldowns, detail view, and export share one date/filter contract.

**Architecture:** Pure TypeScript helpers own URL forwarding, HTML generation, source normalization, range serialization, and report display math. The edge route awaits click persistence and uses one handoff response helper for all cache/database hits. PostgreSQL security-invoker functions perform owner-scoped aggregates and paginated raw reads; authenticated Next route handlers adapt those functions to the client, while focused React clients preserve the existing link-management UI.

**Tech Stack:** Next.js 16 App Router/Edge route handlers, React 19, TypeScript 5, Supabase/PostgreSQL with RLS, Recharts, Node 22 built-in test runner.

## Global Constraints

- Work only in the isolated `research/wiseurl/implementation` clone on `codex/wiseurl-source-analytics`; do not push, deploy, or touch a live database.
- Preserve link/group create, edit, delete, cache invalidation, and the visual system.
- Do not add dependencies or mutate the shared `node_modules` symlink.
- Analytics use `Europe/Bucharest`, inclusive calendar dates, an exclusive upper bound clipped to now for partial ranges, and an exact equal-elapsed-time preceding comparison.
- Incoming source UTMs are internal attribution. Preserve configured destination UTMs and affiliate IDs; forward only non-conflicting non-UTM incoming values.
- Keep bot counts separate and describe other rows as recorded non-bot clicks.
- Remove global 404 visibility rather than assigning unknown historical logs to users.
- Run focused tests first, then typecheck, lint, build, local SQL validation, and self-review. Record inherited failures separately.

---

### Task 1: Pure Redirect and Attribution Contract

**Files:**
- Create: `src/lib/attribution.ts`
- Create: `src/lib/redirect-page.ts`
- Create: `tests/attribution.test.ts`
- Create: `tests/redirect-page.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `extractAttribution(URLSearchParams)`, `buildDestination(string, URLSearchParams, macros)`, `normalizeReferrerHostname(string | null)`, and `resolveSource(utmSource, referrer)`.
- Produces `createHandoffDocument(destinationUrl)` and `handoffHeaders()`.

- [ ] **Step 1: Add failing URL/source tests** for HTTP(S) validation, macro encoding, preserved destination affiliate values, incoming UTM stripping, forwarded sub IDs, malformed referrers, lowercase/`www.` normalization, explicit-source priority, and unknown source.
- [ ] **Step 2: Run `npm test -- tests/attribution.test.ts`** and confirm module/API failures.
- [ ] **Step 3: Implement the attribution helpers** with URL APIs and deterministic normalization.
- [ ] **Step 4: Run the attribution tests** and confirm all cases pass.
- [ ] **Step 5: Add failing handoff tests** for meta refresh, fallback link, HTTP/meta referrer policy, no-store/noindex headers, unsafe scheme rejection, and HTML escaping.
- [ ] **Step 6: Run `npm test -- tests/redirect-page.test.ts`** and confirm module/API failures.
- [ ] **Step 7: Implement the handoff helper** without JavaScript or unescaped interpolation.
- [ ] **Step 8: Run both focused files** and confirm they pass.
- [ ] **Step 9: Commit** `test: define safe source-attributed handoff`.

### Task 2: Edge Route and Cache Ownership

**Files:**
- Modify: `src/app/[code]/route.ts`
- Modify: `src/app/api/cache/invalidate/route.ts`
- Modify: `src/app/api/cache/warm/route.ts`
- Modify: `src/components/CreateLinkModal.tsx`
- Modify: `src/components/EditLinkModal.tsx`
- Create: `tests/click-payload.test.ts`

**Interfaces:**
- Produces a pure click payload constructor consumed by `GET /[code]`.
- Cache PUT accepts `{ id, code }`, authenticates, verifies owner/code, and warms with database-authoritative destination data.

- [ ] **Step 1: Add a failing click-payload test** proving incoming UTM fields/source provenance are stored while the outgoing destination omits incoming UTM values.
- [ ] **Step 2: Run the focused test** and verify the expected missing behavior.
- [ ] **Step 3: Refactor the route around one resolver and handoff helper**, await click inserts with a 1.5-second abort bound and a legacy-payload retry for missing columns, add an explicit non-counting HEAD handler, keep 404 behavior, and await only the required persistence boundary.
- [ ] **Step 4: Authenticate cache endpoints and verify link ownership** before per-link invalidate/warm; stop accepting caller-supplied destinations, stop exposing cached codes, and reduce L1/L2 TTLs to 30 seconds/five minutes so cross-instance stale state is bounded.
- [ ] **Step 5: Await cache mutation from create/edit UI** so cache failures are visible without undoing the successful database mutation.
- [ ] **Step 6: Run redirect/click tests and typecheck**.
- [ ] **Step 7: Commit** `feat: serve tracked links through safe handoff`.

### Task 3: Owner-Scoped SQL Analytics

**Files:**
- Create: `supabase/migrations/0001_source_analytics.sql`
- Modify: `supabase/schema.sql`
- Create: `tests/sql/source-analytics.sql`
- Create: `scripts/test-sql.sh`

**Interfaces:**
- Produces `wiseurl_analytics_report(date, date, text, uuid, uuid, timestamptz) -> jsonb`.
- Produces `wiseurl_analytics_clicks(date, date, text, uuid, uuid, timestamptz, integer, integer) -> table`.

- [ ] **Step 1: Write SQL assertions first** for additive/idempotent migration, 1,205-event totals, per-owner isolation, source priority/provenance, `www.` normalization, unknown/malformed referrers, bot split, filters, previous-zero states, partial-range equal elapsed comparisons, Bucharest day boundaries including DST, and pagination.
- [ ] **Step 2: Run `scripts/test-sql.sh` against `wiseurl_test`** and confirm missing migration/functions fail.
- [ ] **Step 3: Implement the migration** with nullable attribution columns, indexes, immutable hostname/source helpers, security-invoker report/raw functions, pinned `search_path`, bounded pagination, grants, and removal of broad 404 SELECT access.
- [ ] **Step 4: Bring fresh `schema.sql` to the same end state** without making the migration non-idempotent.
- [ ] **Step 5: Run SQL assertions twice** to prove semantics and migration idempotence.
- [ ] **Step 6: Commit** `feat: add owner-scoped source analytics SQL`.

### Task 4: Analytics API and Pure Client Model

**Files:**
- Create: `src/app/api/analytics/route.ts`
- Create: `src/lib/analytics.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/export.ts`
- Create: `tests/analytics.test.ts`

**Interfaces:**
- `GET /api/analytics` returns `{ report, rows, pagination, refreshedAt }` for an authenticated caller.
- `GET /api/analytics?format=csv` returns all paginated raw rows as CSV for the same filters.
- Produces date/filter parsing and display helpers shared by dashboard/detail clients.

- [ ] **Step 1: Add failing tests** for 7/30/custom range serialization, Bucharest calendar labels, invalid ranges, zero-baseline display, bot/non-bot labels, API error classification, migration-missing classification, and CSV escaping/scope.
- [ ] **Step 2: Run the test** and verify missing APIs fail.
- [ ] **Step 3: Implement pure analytics types/helpers** and a server route that authenticates, validates filters, calls both RPCs, distinguishes setup-needed errors, and loops raw pages for CSV.
- [ ] **Step 4: Run focused tests and typecheck**.
- [ ] **Step 5: Commit** `feat: expose scoped analytics report API`.

### Task 5: Source-Centered Dashboard and Tracking URL Builder

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/DashboardClient.tsx`
- Create: `src/components/SourceAnalytics.tsx`
- Create: `src/components/SourceTaggedUrl.tsx`
- Modify: `src/components/DateRangePicker.tsx`
- Remove: `src/components/AnalyticsCharts.tsx`
- Remove: `src/components/PeriodComparison.tsx`
- Remove: `src/components/RealTimeCounter.tsx`

**Interfaces:**
- `SourceAnalytics` owns the shared report scope and refresh lifecycle.
- `SourceTaggedUrl` creates a copyable `/{code}?utm_source=...&utm_campaign=...` without changing `destination_url`.

- [ ] **Step 1: Add failing pure-model tests** for source-tagged URL preservation and filter changes.
- [ ] **Step 2: Run the tests** and verify missing behavior.
- [ ] **Step 3: Stop loading raw clicks/global 404 rows in the dashboard server component** while keeping owned links/groups.
- [ ] **Step 4: Replace legacy click cards and duplicated analytics** with source summary, source table, drilldown link/destination tables, daily chart, bot split, raw pagination, explicit timezone, and CSV.
- [ ] **Step 5: Add refresh success/error/setup states** and update the timestamp only after a successful response.
- [ ] **Step 6: Add source-tagged URL controls to link rows** and explain sticky source labels plus destination UTM behavior.
- [ ] **Step 7: Run focused tests, typecheck, and lint on changed files**.
- [ ] **Step 8: Commit** `feat: center dashboard analytics on source sites`.

### Task 6: Link Detail Uses the Shared Contract

**Files:**
- Modify: `src/app/links/[id]/page.tsx`
- Modify: `src/app/links/[id]/LinkStatsClient.tsx`

**Interfaces:**
- Link detail renders `SourceAnalytics` with an immutable link ID/code and uses the same date, source, bot, daily, raw, error, and CSV semantics.

- [ ] **Step 1: Remove the raw-click server query** after confirming the owned link exists.
- [ ] **Step 2: Replace local calculations with the shared analytics component** constrained to the link ID.
- [ ] **Step 3: Run focused tests, typecheck, and changed-file lint**.
- [ ] **Step 4: Commit** `refactor: share analytics semantics in link detail`.

### Task 7: Documentation, Full Verification, and Handoff

**Files:**
- Modify: `README.md`
- Create: `docs/source-analytics-operations.md`
- Write outside the clone only as required: `../2026-09-20/sol-implementation-report.md`

**Interfaces:**
- Documents migration order, source rules, tagged URLs, outgoing UTM behavior, browser referrer limits, runtime assumptions, test commands, deploy prerequisites, and rollback.

- [ ] **Step 1: Update operator/user documentation** with exact commands and limitations.
- [ ] **Step 2: Run `npm test`, the SQL harness twice, `npx tsc --noEmit`, `npm run lint`, and `npm run build -- --webpack`**; diagnose any failures before editing.
- [ ] **Step 3: Inspect `git diff --check`, scoped diff, commits, and product requirement checklist**.
- [ ] **Step 4: Write the implementation report** with exact results and any remaining validation limits.
- [ ] **Step 5: Commit documentation/final fixes** and send commit SHAs plus the RPC contracts to the primary agent. Do not push.
