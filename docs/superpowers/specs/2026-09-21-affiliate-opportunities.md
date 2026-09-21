# Affiliate opportunities and company finder

The owner wants to prioritize companies whose CouponSwift visitors request a WiseURL code that has no configured affiliate destination, and to find/edit existing companies such as ScalaHosting without scrolling. This extends the approved commercial dashboard design.

## Decisions

- Use existing `error_404_logs` for requests that reached WiseURL. This preserves historical demand. Do not call these pageviews, copied/redeemed coupon codes, unique people, lost sales or commissions. CouponSwift has separate reveal/copy events; integration of those events is outside this release.
- Add Affiliate opportunities navigation. Default to currently unconfigured/inactive codes; allow viewing previously failing codes now configured. Rank by request volume or change, filter/search, Today/Yesterday/7d/30d/month/custom, CSV, latest request, leading source. Keep current-period and previous-only rows. Comparisons use existing Bucharest elapsed-period rules.
- Existing unowned 404 logs must not become globally readable. Provision verified source domains through administrator SQL only, uniquely mapped to an owner. Authenticated RPC aggregates logs only for that owner's sources; no anonymous RPC, raw logs, or client self-claim of domains. For this deployment provision couponswift.com to the owner of the explicitly confirmed Hostinger link. Unknown referrer requests cannot be safely assigned and remain excluded.
- Add affiliate link opens existing creation form with the exact supported requested code prefilled. Unsupported/reserved/uppercase legacy codes are labelled as requiring source-URL correction, never silently changed. Inactive/resolved owned links open existing edit form. After create/edit refresh the report using metadata revision; historical logs remain intact and new normal clicks continue in Overview.
- Company finder is available in every dashboard section. It searches all owned active/inactive link metadata locally, matching title/code/destination (including Scala Hosting/scalahosting spacing), displays destination as text, and opens existing edit modal. Searching must never trigger a shortlink/affiliate visit. Dialog supports mobile and keyboard focus.

## Preservation and failure behavior

No changes to redirect timing, destination resolution, caching, existing clicks, link CRUD semantics, CouponSwift production, or tracking insertion. No deletion/backfill of 404 logs. API errors show an error rather than stale/zero metrics. Non-bot means bots detected from user agent were excluded, not verified humans. Source classification is based on recorded referrer, with existing data-quality limitations.

## Verification

SQL two-owner isolation, grants, denied domain claims, source lookalikes, unknown sources, >1000 rows, prior-only records, bot filters, status changes and DST comparisons. Unit tests for finder/ranking/CSV and code eligibility. Typecheck, focused lint, tests and build. Browser test finder/edit handoff plus opportunity filters, create-prefill and error state using synthetic local data; preserve real links. Independent review before push/merge. Additive migration precedes release, live owner-scoped count parity and public unauthenticated rejection afterward.
