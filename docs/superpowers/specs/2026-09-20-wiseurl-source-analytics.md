# WiseURL Source Analytics — Accepted Specification

## Outcome

WiseURL will attribute each recorded click to the user's affiliate source site, report source → short link → destination for an authenticated owner, and serve successful short links through a minimal HTML handoff page so the destination normally receives the WiseURL origin as its referrer.

## Redirect contract

- `GET /[code]` resolves the L1 cache, persistent cache, or database exactly as today, then returns `200 text/html` with a zero-delay meta refresh, `Referrer-Policy: origin` in both HTTP and HTML, `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`, and a real fallback anchor.
- Destination URLs must be valid absolute `http:` or `https:` URLs before they enter the page. All HTML interpolation is escaped. Incoming parameters cannot replace parameters already present in the configured destination.
- Incoming `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` are captured inside WiseURL and omitted from the outgoing URL. Destination-authored UTM values remain unchanged. Other incoming values, including common affiliate sub-ID aliases, are forwarded only when the configured destination does not already define the same key. `{click_id}` and `{code}` macros remain supported.
- The original incoming `Referer` is recorded before the handoff. Click persistence is awaited with a 1.5-second abort bound before returning a successful GET. During a migration-first rollout mismatch, a missing-attribution-column error retries once with the legacy click payload inside the same bounded operation. `HEAD` resolves the link without inserting a click.
- Missing and inactive links retain the existing 404 page. Click or 404 persistence failures are logged; a missing link is never turned into a successful handoff.
- A normal browser navigation from the handoff document sends only the WiseURL origin to the destination. Browser privacy settings may omit the referrer, so the UI and documentation do not promise universal delivery.
- Cross-instance cache invalidation is made bounded rather than year-long: L1 entries expire after 30 seconds and persistent entries after five minutes, while authenticated link mutations await owner-scoped invalidation. The database remains authoritative after expiry; this intentionally trades some cache hit rate for a short, documented maximum stale window.

## Attribution contract

- Source priority is: trimmed explicit `utm_source`; otherwise a valid normalized hostname from the original referrer; otherwise `Unknown source`.
- Referrer hostnames are lowercased, trailing dots are removed, and one leading `www.` is removed. Malformed values, credentials, and non-HTTP(S) schemes become unknown.
- Each click keeps the original referrer, UTM fields, common sub-ID values, remaining query parameters, a click UUID, and derived source provenance (`explicit`, `referrer`, or `unknown`). Historical rows are derived at query time without inventing labels for absent data.
- A copied tagged short URL keeps its explicit source label wherever it is shared. The UI explains this behavior.

## Analytics contract

- All analytics are computed by PostgreSQL functions running as the authenticated caller. The functions use row-level security on links/clicks, a pinned search path, and no definer privilege. One user's clicks are never returned to another user.
- The report function is `wiseurl_analytics_report(p_from date, p_to date, p_source text default null, p_link_id uuid default null, p_group_id uuid default null) returns jsonb`.
- The raw-row function is `wiseurl_analytics_clicks(p_from date, p_to date, p_source text default null, p_link_id uuid default null, p_group_id uuid default null, p_offset integer default 0, p_limit integer default 50) returns table (...)`.
- The date range is inclusive by Bucharest calendar date and uses an exclusive upper timestamp derived with `Europe/Bucharest`. When that endpoint is still in progress, the report clips it to `statement_timestamp()`, marks the range partial, and compares the exact elapsed interval immediately preceding the current start. Completed ranges compare the complete selected interval. Daily buckets use the same timezone.
- The report JSON contains summary totals (recorded, non-bot, bot, and preceding-period equivalents), source rows, link rows, destination rows, and daily rows. Source rows include share, previous clicks, change state, leading link/destination, latest click, and provenance. A previous zero is `new` when current is positive and `no_baseline` when both are zero; no synthetic `+100%` is shown.
- Bot rows are reported separately. Non-bot rows are labelled `Recorded non-bot clicks`, never humans, people, conversions, or revenue.
- Raw rows are paginated separately. CSV export iterates every raw page using the exact selected scope, so aggregate and export semantics agree and do not inherit the 1,000-row REST cap.
- Historical global 404 logs are not shown as per-user analytics. The existing broad authenticated SELECT policy is removed.

## Admin behavior

- Link creation, editing, deletion, grouping, and direct stats navigation remain functional.
- The Analytics tab owns one shared 7-day, 30-day, or custom range plus source, link, and group filters. It shows visible loading, setup-needed, and query-error states.
- Selecting a source narrows the link table, destination table, daily chart, summary, and CSV. All displayed timestamps are explicitly Europe/Bucharest.
- Refresh performs a new request and changes the displayed refresh time only after success.
- The Links view offers a source-tagged URL builder with a required source label and optional campaign. It changes only the short URL query string and never edits the configured destination.
- Link detail reuses the same report and raw-row semantics with a fixed link filter.

## Rollout and rollback

- Existing installations run `supabase/migrations/0001_source_analytics.sql` before the application deploy. Fresh installations receive the same columns and safe policies from `supabase/schema.sql`.
- Rolling back application code leaves additive nullable columns and functions harmless. The functions and indexes may be dropped later after the old app is restored; attribution columns should be retained unless their data is intentionally discarded.
- No migration, deployment, production traffic, or remote database change is performed during implementation.

## Baseline on 2026-09-20

- `npx tsc --noEmit`: passed.
- `npm run lint`: failed with 11 inherited errors and 11 warnings, including CommonJS imports in legacy scripts, a state update inside `useMemo`, internal navigation anchors, render-time `Date.now`, and explicit `any` in `GroupManager`.
- `npm run build`: failed because the sandbox could not fetch Google Inter through `next/font`; it also reported the existing workspace-root and middleware deprecation warnings.
