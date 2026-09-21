# Affiliate opportunity reporting operations

Apply migrations 0001, 0002, then 0003 before deploying the new dashboard. 0003 adds a source ownership table, an index and an authenticated aggregate RPC. It never deletes or rewrites links, clicks or historical error logs. Existing redirect tracking remains unchanged.

## Source ownership provisioning

A trusted database administrator must first verify the publisher domain and the WiseURL account owner. Provision the canonical hostname returned by `wiseurl_normalize_referrer('https://publisher.example/')` in `wiseurl_reporting_sources(hostname, user_id)`. The hostname is globally unique. Do not infer ownership from an incoming referrer, arbitrary link destination, source label or a client's claim. Do not reassign an existing domain without separate ownership verification. CouponSwift is explicitly confirmed as the requesting owner's site in this deployment; bind it to their confirmed account.

Clients cannot insert, update or delete mappings. Authenticated users can read only their mapping rows. `wiseurl_missing_links_report` has SECURITY DEFINER solely to aggregate otherwise-unowned legacy logs through that trusted mapping and auth.uid. It returns no raw referrer, device, location or other owner's link metadata. Anonymous execution remains denied and global error-log SELECT stays revoked. Sources absent from the mapping and unknown referrers are excluded; no guessed assignment of historical data.

## Report semantics

Requests were logged when WiseURL could not find an active destination. They are not successful redirects, pageviews, copies or redemptions, unique humans, lost revenue or commissions. Source identity and bot detection reflect the existing request metadata, not authenticated visitor identities. Today/Yesterday and other presets use Europe/Bucharest and previous equal elapsed periods, matching Overview conventions.

Default view includes codes currently missing or inactive for the owner. Historical codes now active move to Now configured; history is preserved. Current status can change when destinations are added/edited. A globally occupied code belonging to another owner exposes no metadata and cannot be claimed; the existing create form reports the conflict. Unsupported historical codes require correcting the publisher URL; the app never silently creates a differently spelled/lowercased code. Source sites that bypass WiseURL altogether are outside this report.

## Validation and rollback

Run `npm test`, `sh scripts/test-sql.sh`, typecheck and production build, plus browser checks for exact-code prefill/create/refetch and finder/edit/focus. Provision source ownership before release and verify authenticated report totals against read-only source-scoped error-log counts. Check unauthenticated API is 401 and private/no-store. Rollback UI to the prior release if needed; leave additive migration/data intact. Revoke the authenticated RPC execution grant if the report must be disabled, without granting access to raw logs.
