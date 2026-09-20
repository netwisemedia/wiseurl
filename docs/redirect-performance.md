# Fast redirect delivery

The public short-link response is deliberately not cached. Each request receives a unique click ID and its own attribution. Only link configuration is cached, for 30 days.

On Netlify, `netlify/edge-functions/redirect.ts` handles single-segment short codes directly. Application and asset routes pass through. The Next.js route remains a fallback for development and hosts without the native edge function. `X-WiseURL-Handler: edge-v1` identifies actual edge execution; a runtime declaration alone is not evidence of edge delivery.

The response is tiny HTML with an empty body, immediate inline navigation and refresh0 fallback. HTTP and HTML origin referrer policies establish WiseURL as the navigation source in normal browser behavior. This cannot override a visitor's privacy controls or a later affiliate redirect that changes its own policy.

Click data captures the inbound source before responding. Netlify `context.waitUntil` and Next.js `after` keep background work alive without holding the redirect response. Inserts retain the existing bounded timeout and report failures. This is best-effort analytics, not a durable queue or exactly-once delivery guarantee. HEAD performs no click insert.

`Server-Timing` reports server lookup and handoff work in milliseconds. These exclude browser DNS/TLS, the CouponSwift /out hop, affiliate-network redirects and merchant loading. Compare multiple cold/warm requests and browser runs; do not describe local or best-case timing as a global latency guarantee.

Cache reads use strong consistency and no uncoordinated process-memory shortcut. This trades some latency for read-after-write correctness: a rare link edit must not remain stale for the 30-day TTL. Cache publication is conditional, and mutations fence the previous entry before changing the database. Existing requests that already resolved a destination can still complete; no invalidation can retroactively cancel such navigation.

Release validation includes slow/pending analytics, absence of tracking on HEAD, unique click IDs, script/HTML URL escaping, source filtering, missing and inactive links, edit/delete cache races, and cache mutation failures. A failed mutation must be visible in admin; never claim it succeeded if its initial safety fence failed.

This release changes WiseURL only. CouponSwift's artificial 100 ms delay and /out redirect remain independent opportunities. No database migration is required.

Primary hosting references:
- https://docs.netlify.com/build/edge-functions/api/
- https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/

## Rollout and recovery

Reload dashboard tabs after deploying this version before editing links. Older dashboard JavaScript wrote directly to Supabase and cannot use the new fence-before-write protocol. Direct database changes likewise require explicit synchronization and are outside this API contract. The new cache uses `redirect-config-v1`; the old `links` namespace is retained for rollback, where entries may persist for their old five-minute lifetime.

An ambiguous database write failure retains a busy fence. Its five-minute lease allows a later explicit edit retry, but does not automatically restore caching: redirects continue to use authoritative database reads until a successful retry repairs the entry. This avoids caching an old value while a write whose HTTP response was lost might still commit. Production role statement timeouts were verified as three seconds for anon and eight seconds for authenticated; the existing links updated_at trigger and query predicates also protect against delayed competing writes.
