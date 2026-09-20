# Commercial affiliate dashboard

User approved implementing the missing global reports and making admin useful as a commercial product. Prior user authorization covers Sol implementation, review, push and publication. This specification makes that accepted direction concrete; no new approval gate is needed.

## Chosen scope
Default Overview, last 7 Bucharest calendar days, all owned links sorted by recorded non-bot clicks. Alternatives considered: only add a top-links table (too limited); a full commission platform (requires external conversion data). Choose a focused affiliate traffic workspace.

Overview includes Today, Yesterday, 7 days, 30 days, This month, Last month and custom dates; group and source filters; non-bot/all/bot traffic. Four summary cards, traffic trend, ranked links with previous-period counts, share, leading source and last activity; top sources with drilldown; growth/decline/zero-traffic views and CSV of the selected ranking. Filters are bookmarkable. Labels distinguish recorded clicks from unique visitors or conversions. Incomplete intervals compare equal elapsed durations, with exact comparison dates visible. Empty, loading and error states are distinct; errors never display zero as success.

Navigation separates Overview, Links, Source reports and Groups. Retain existing link CRUD and detailed source report. Keep English UI consistent with existing product, with a responsive restrained violet/neutral visual system, clear typography, compact tables, keyboard labels and visible active filters. No revenue, sales or ROI claims.

## Architecture and invariants
Add authenticated GET /api/overview and an additive SECURITY INVOKER owner-scoped RPC wiseurl_overview_report. Existing analytics RPCs and redirects remain unchanged. Aggregate all events in SQL, never cap at the REST 1000-row limit. Return all owned links including zero-traffic and prior-only rows. For partial ranges anchor the previous comparison at the preceding calendar interval; at DST boundaries preserve equal elapsed duration without overlap and show exact bounds. One traffic predicate must govern all totals, comparisons, rankings and leading sources. Preserve RLS and explicit auth.uid owner checks. Use Europe/Bucharest dates with equal elapsed previous window, snapshot asOf, max 366 days per report. No API secrets or production auth bypass in UI.

Client uses src/lib/overview-types.ts for shared backend contract; src/lib/overview.ts for range, URL/filter, ranking and export helpers; focused overview components under src/components/overview. Abort stale requests and clear mismatched reports. CSV neutralizes formula prefixes.

## Verification and release
Regression SQL fixtures >1000 events, two owners, zero and prior-only links, filters, bots, DST and incomplete windows. Node tests for calendar boundaries, filters, comparisons and export. Typecheck, lint, production build, browser review with local test data and production authenticated route protection. Independent code review; apply additive migration to existing WiseURL Supabase before application deployment; verify Netlify preview and production. Existing data remains intact; rollback restores prior app and leaves additive RPC.
