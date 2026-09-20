# Source analytics operations

## Deployment order

Existing installations must apply `supabase/migrations/0001_source_analytics.sql` before deploying this application version. The migration adds nullable click-attribution columns, indexes, owner-scoped analytics functions, and the required grants and policies. It is idempotent and can be run more than once.

Fresh installations run both files in this order:

1. `supabase/schema.sql`
2. `supabase/migrations/0001_source_analytics.sql`
3. application deployment

The redirect route has a bounded legacy insert fallback when the new click columns are unavailable, so clicks can still be recorded during a short rollout mismatch. The Analytics screen remains in its visible **setup needed** state until the migration and RPC functions are present. The fallback is a rollout safeguard, not a replacement for applying the migration.

Before deployment, run:

```bash
npm test
sh scripts/test-sql.sh
npx tsc --noEmit
npm run build -- --webpack
```

`scripts/test-sql.sh` destroys and recreates only the configured test database. It defaults to `wiseurl_test` on loopback and refuses a non-loopback host unless the explicit remote-test override is set. Never point it at a live database.

## Redirect and attribution behavior

A successful `GET /[code]` returns a small `200 text/html` handoff document with a zero-delay meta refresh and an empty body. No message, button, or fallback link is displayed. It sends the `Referrer-Policy: origin` header and matching HTML policy. In ordinary browser navigation, the destination therefore receives the WiseURL origin rather than the original publisher origin. Browser privacy settings, extensions, embedded browsers, destination policy, or non-browser clients may omit the referrer, so this is not a universal guarantee.

WiseURL determines a source in this order:

1. a non-empty incoming `utm_source`, stored with `explicit` provenance;
2. the normalized hostname of a valid incoming HTTP(S) referrer, stored with `referrer` provenance;
3. `Unknown source`, stored with `unknown` provenance.

Use the dashboard's **Source-tagged URL** control when a stable publisher label matters. The label stays on that short URL if somebody copies it to another site. This is deliberate and is shown in the UI.

Incoming `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, and `utm_term` are recorded inside WiseURL but are not appended to the outgoing merchant URL. Any UTM values already authored in the configured destination remain unchanged and may independently control the merchant's analytics attribution. Other incoming parameters, including affiliate sub-IDs, are forwarded only when the configured destination does not already contain the same key. `{click_id}` and `{code}` destination macros continue to work.

Each new click snapshots the configured destination used at click time. Historical clicks created before this migration do not have that snapshot; reports explicitly fall back to the link's current configured destination for those rows.

## Reporting semantics

The Analytics screen and link detail use the same PostgreSQL report functions and the same inclusive Europe/Bucharest calendar range. A range containing the current day is marked partial and compared with an immediately preceding interval of equal elapsed duration. Completed ranges compare complete intervals.

The first report freezes an `as_of` timestamp. Raw-page navigation, link-detail drilldown, and CSV export reuse the exact timestamp, including PostgreSQL microseconds, so new arrivals cannot shift offsets, totals, or exported rows. Refresh starts a new snapshot. A filter change clears the old report while the new scope loads; failed requests do not leave old totals or CSV actions under new filters.

Counts describe recorded requests. Bots are shown separately, and non-bot requests are labelled **Recorded non-bot clicks**. WiseURL does not claim that these rows are unique people, conversions, sales, or revenue.

Both RPCs execute with invoker privileges, a pinned search path, explicit owner filtering, and row-level security. They are granted to the `authenticated` role only:

- `wiseurl_analytics_report(date, date, text, uuid, uuid, timestamptz)`
- `wiseurl_analytics_clicks(date, date, text, uuid, uuid, timestamptz, integer, integer)`

The CSV endpoint pages through the complete owner-scoped result rather than relying on Supabase's default 1,000-row REST limit. It escapes CSV syntax and neutralizes spreadsheet-formula prefixes in public source, referrer, and campaign values.

## Cache consistency

The database is authoritative. Link create, edit, and delete operations verify ownership and wait for cache synchronization. A cache synchronization failure is reported as a warning after the database mutation succeeds; the UI does not invite the user to repeat an already committed operation.

Redirect data has two bounded cache layers:

- in-process L1: 30 seconds;
- persistent L2: five minutes.

After successful persistent invalidation, another already-running edge instance can retain an L1 entry for at most 30 seconds. If persistent synchronization fails, a stale redirect can remain for at most five minutes. Lowering these values reduces the stale window but increases database and persistent-cache traffic.

Cache mutation endpoints require an authenticated owner and derive the destination from the database. They do not accept a caller-supplied destination as authority. Deletion verifies ownership, deletes the database row, and only then invalidates both cache layers, preventing a public request from repopulating persistent cache from a row that is about to be deleted.

## Rollback

Application rollback is safe because the new click fields are nullable and the database changes are additive. Restore the previous application version first. Leave the new columns in place to preserve collected attribution data.

If the analytics functions must also be removed later, drop the two `wiseurl_analytics_*` functions and their dedicated indexes only after all application instances use the old version. Do not drop the attribution columns unless their stored data is intentionally being discarded. Restoring the former broad authenticated `error_404_logs` read policy is neither required nor recommended; global 404 history has no owner boundary and is intentionally absent from the admin analytics view.
