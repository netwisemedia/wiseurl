# WiseURL redirect performance implementation plan

> Execution: subagent-driven-development for cache/mutation work, parent owns redirect delivery and release; independent review before merge.

**Goal:** Deliver the silent WiseURL handoff without blocking on analytics, retain 30-day destination configuration safely, and preserve outgoing WiseURL-origin referrer.

**Architecture:** Dedicated Netlify Edge Function for single-segment short links, sharing pure attribution/HTML/tracking modules with a Next.js fallback. Strongly consistent persistent configuration cache, no independently stale L1 serving on the redirect path. Database mutations must fence old cache content before changing the database; conditional blob writes prevent an in-flight lookup from resurrecting a replaced/deactivated/deleted link. Analytics run through context.waitUntil at edge and after in Next.js.

**Tech Stack:** Existing Next16, Netlify Edge Functions/Blobs10.5, Supabase; no database migration.

## Global constraints
- Cache destination configuration for 30 days (2592000000 ms), never visitor-specific HTML, click IDs or attribution.
- No visible interstitial UI, no fixed navigation delay, outgoing Referrer-Policy origin and refresh0 fallback.
- No click logging on HEAD; preserve internal original referrer/source, tracking parameter filtering, active checks and owner authorization.
- No new paid service, no CouponSwift changes in this release. Existing dashboard analytics scope remains separate.
- Safe failure: cache misses/errors fall back to current database; cache-sync failure must not silently serve stale long-lived entries. Document network propagation/request-in-flight limits honestly.

## Task 1 — cache and mutation safety (Sol)
- [x] Add regression tests for 30-day expiration, edit/deactivate/delete fencing, failed fencing before DB mutation, and in-flight cache fill racing a mutation.
- [x] Replace 5-minute cache with versioned, strongly consistent 30-day entries; implement conditional writes with SDK onlyIfNew/onlyIfMatch. Do not serve L1 in the public redirect resolver.
- [x] Export resolveRedirectLink(code, fetchActiveLink): Promise<{id:string,destination_url:string}|null> from src/lib/blob-cache.ts or dedicated shared module. Own all cache publication inside resolver; request response must not wait for cache writes (return pending work if needed through a supplied schedule callback).
- [x] Move EditLinkModal updates to authenticated server API so cache fencing happens before DB modification. Delete uses same pattern. Preserve RLS/ownership, group ownership, URL validation and explicit failure state.
- [x] Update warm/create cache synchronization to avoid unconditional stale overwrite. Remove obsolete five-minute messages.
- [x] Run npm test and tsc; write /private/tmp/wiseurl-cache-report.md. No commits while parent edits shared working tree; parent stages explicit files after review.

## Task 2 — response delivery (parent)
- [x] Add meaningful tests proving a pending analytics insert cannot delay response, separate click IDs, HEAD behavior, parameter/referrer safety and script-context escaping.
- [x] Shared minimal redirect orchestration uses injected lookup/persistence and schedule callbacks. Immediate inline location.replace with safely serialized URL plus existing refresh0 fallback, body empty.
- [x] Netlify native edge wrapper handles only public single-segment codes; reserved app/static paths pass through; uses Netlify.env and context.waitUntil, public anon Supabase REST reads/inserts, bounded network calls, no cookies/session authentication on redirect.
- [x] Next route fallback uses supported after for background work and same orchestration.
- [x] Add Server-Timing for resolution and response work; no personal data in diagnostics.

## Task 3 — validation and publication
- [x] Unit tests, typecheck, focused lint, production build; independently review resulting diff.
- [ ] Push branch and create PR, inspect Netlify preview deployment/build including actual native edge bundling.
- [ ] Live preview probes demonstrate nonblocking analytics and preserved response HTML, verify successful analytics persists and cache policy from code/tests; controlled browser flow where possible.
- [ ] Merge only after required checks pass, verify deployed production referrer on supplied coupon flows and record repeat HEAD/GET response timings without repeated merchant clicks.
- [ ] Record actual results and any remaining latency outside WiseURL. Never claim all users reach merchant in <1 second or guaranteed referrer against privacy controls.
