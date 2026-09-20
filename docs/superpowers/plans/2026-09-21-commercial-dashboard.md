# Commercial dashboard implementation plan

> Execute with subagent-driven-development. User has authorized implementation and publication.

**Goal:** Make the default admin immediately answer which shortlinks and publisher sites deliver traffic and how performance changes.
**Architecture:** Add separate owner-scoped SQL report and authenticated API, typed data contract, isolated overview components and preserve existing detail/CRUD.
**Tech stack:** Next 16, React 19, Tailwind 4, Recharts, Supabase PostgreSQL.

## Global constraints
- Europe/Bucharest calendar filters; default last7 days, recorded non-bot clicks.
- Max366 inclusive calendar days; compare equal elapsed durations; preserve frozen report timestamp.
- Aggregate all rows, owner scope plus RLS, no redirect changes and no invented revenue/uniques.
- Retain zero/current and prior-only links; all traffic predicates consistent.
- Publish only after SQL regression checks, Node tests, typecheck/build and independent review.

## Tasks
- [x] Sol backend: create src/lib/overview-types.ts, supabase/migrations/0002_overview.sql, src/app/api/overview/route.ts, tests/sql/overview.sql and update scripts/test-sql.sh. Write fixtures/assertions first, see missing-function failure, implement RPC and assert aggregate conservation, owner isolation, traffic filters, prior-only and zero rows, DST and partial comparisons. Run sh scripts/test-sql.sh using local test database only. No production mutations by subagent.
- [x] Parent UI: write tests/overview.test.ts for range presets around month/leap/Bucharest boundaries, comparison and CSV injection; run npm test to observe missing implementation. Implement src/lib/overview.ts and overview components with AbortController request sequencing and server-validated scopes. Redesign DashboardClient navigation with Overview default and keep link administration. Verify all filters, search/sort, zero-traffic view, source drilldown, refresh and export; preserve query parameters on bookmark/navigation.
- [x] Parent validation: npm test; sh scripts/test-sql.sh; npx tsc --noEmit; npx eslint changed TS/TSX; npm run build -- --webpack. Inspect desktop/mobile rendered dashboard with isolated local fixtures. Read independent whole-branch review; fix substantive findings and repeat affected tests.
- [ ] Release: commit code/doc updates, push codex/wiseurl-commercial-dashboard; create PR via body file; verify preview checks. Apply additive migration only to project ahwxzlhzbbzkvorjcyym with existing migration helper and verify authenticated scoped report and privilege checks. Merge approved PR, verify production deployment and /api/overview unauth401 plus live data totals using owner scope. Save evidence in research/wiseurl and report actual capabilities and limitations.

## Review evidence
- SQL tests first failed absent migration, then both suites passed. 100k synthetic events RPC measured 1604.599 ms on local PostgreSQL.
- 52 Node tests pass; TypeScript and changed-file ESLint pass. Production webpack build passed; final post-QA webpack rebuild passed.
- Independent reviewer approved after fixing search navigation/focus, CRUD report invalidation, exact year labels and migration documentation.
- Browser local synthetic fixtures: Today and Yesterday correct, seven-day global ranking, source drilldown into preserved detail, search, zero clicks, creation updates totals14→15 and quietlinks2→3. Desktop and visible390px mobile rendering inspected.

- Live additive migration applied; direct owner-scoped production SQL matches Today, Yesterday, 7d and30d totals. Authenticated-only grants verified; 141links and6groups preserved. CSV browser downloads verified:15rows all-ranked including nextpage and3 zero-traffic rows. Failure state hides data and disables export.
