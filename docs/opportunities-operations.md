# Affiliate opportunity reporting operations

Apply migrations 0001 to 0006 in order before deploying the new dashboard. 0003 adds a source ownership table, an index and an authenticated aggregate RPC. It never deletes or rewrites links, clicks or historical error logs. Existing redirect tracking remains unchanged.

## Source ownership provisioning

A trusted database administrator must first verify the publisher domain and the WiseURL account owner. Provision the canonical hostname returned by `wiseurl_normalize_referrer('https://publisher.example/')` in `wiseurl_reporting_sources(hostname, user_id)`. The hostname is globally unique. Do not infer ownership from an incoming referrer, arbitrary link destination, source label or a client's claim. Do not reassign an existing domain without separate ownership verification. CouponSwift is explicitly confirmed as the requesting owner's site in this deployment; bind it to their confirmed account.

Clients cannot insert, update or delete mappings. Authenticated users can read only their mapping rows. `wiseurl_missing_links_report` has SECURITY DEFINER solely to aggregate otherwise-unowned legacy logs through that trusted mapping and auth.uid. It returns no raw referrer, device, location or other owner's link metadata. Anonymous execution remains denied and global error-log SELECT stays revoked. Sources absent from the mapping and unknown referrers are excluded; no guessed assignment of historical data.

## Report semantics

Requests were logged when WiseURL could not find an active destination. They are not successful redirects, pageviews, copies or redemptions, unique humans, lost revenue or commissions. Source identity and bot detection reflect the existing request metadata, not authenticated visitor identities. Today/Yesterday and other presets use Europe/Bucharest and previous equal elapsed periods, matching Overview conventions.

Default view includes codes currently missing or inactive for the owner. Historical codes now active move to Now configured; history is preserved. Current status can change when destinations are added/edited. A globally occupied code belonging to another owner exposes no metadata and cannot be claimed; the existing create form reports the conflict. Unsupported historical codes require correcting the publisher URL; the app never silently creates a differently spelled/lowercased code. Source sites that bypass WiseURL altogether are outside this report.

## Explicit source tags and period columns (migrations 0004, 0005)

Requests carrying no Referer (the coupon site's buttons use `rel="noreferrer"`) cannot be attributed from the referrer, and counting every request without one pulled in scanner noise. The publisher therefore links to `https://wiseurl.net/<code>?utm_source=<its hostname>`. `utm_*` parameters are never forwarded to the destination.

`0005_missing_links_explicit_source.sql` adds nullable `source_label` / `source_kind` to `error_404_logs`. The missing-code branch stores the same resolution a click uses (`resolveSource(utm_source, referrer)`: the trimmed explicit tag, else the referrer host, else `Unknown source`). It also replaces `wiseurl_missing_links_report` (same signature and grants): a request counts for a source owner when its referrer host is one of the owner's approved sources, or its explicit tag equals one (compared lower-case, without `www.` and a trailing dot). If both match different sources the tag wins, so a row is counted once. Requests with neither, and tags naming unapproved hosts, are excluded; a tag cannot claim another owner's source. This supersedes 0004's no-referrer inclusion and single-owner rule; `summary.includes_no_referrer` is kept for compatibility and is always false.

`0006_reporting_source_tag.sql` adds an optional `source_tag` alias to `wiseurl_reporting_sources` (lower-case, unique across all sources) and sets it to `cs` for couponswift.com, so `?utm_source=CS` counts for that source (case-insensitive, trimmed). The leading source stays the approved hostname. Provision aliases like hostnames: by a trusted administrator only.

Every row carries `today_requests`, `yesterday_requests`, `last_7d_requests` and `last_30d_requests` (Europe/Bucharest calendar days, last 7/30 days include today), honoring the traffic filter and independent of the selected range; they are live, not frozen to `asOf`. The view hides codes that cannot be store short codes (`canConfigureCode` plus the `NON_STORE_CODES` list) unless "Show unsupported requests" is on, and opens on the last 30 days when the URL has no range.

Deploy order does not matter: until 0005 runs, the app retries the 404 insert without the two columns, and the previous report function ignores them. Tags are only counted for requests logged after both the app deploy and the migration.

## Validation and rollback

Run `npm test`, `sh scripts/test-sql.sh`, typecheck and production build, plus browser checks for exact-code prefill/create/refetch and finder/edit/focus. Provision source ownership before release and verify authenticated report totals against read-only source-scoped error-log counts. Check unauthenticated API is 401 and private/no-store. Rollback UI to the prior release if needed; leave additive migration/data intact. Revoke the authenticated RPC execution grant if the report must be disabled, without granting access to raw logs.
