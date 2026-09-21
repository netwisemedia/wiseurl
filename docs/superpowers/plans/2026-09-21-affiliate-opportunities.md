# Affiliate opportunities implementation plan

**Goal:** Identify demand for unconfigured affiliate links and make company destination editing immediate.

**Architecture:** Reuse existing error logs via owner-scoped SQL aggregate RPC with admin-provisioned source ownership. Existing authenticated dashboard owns both UI additions and reuses current create/edit forms. No redirect-path changes.

- [ ] Sol: implement global CompanyFinder, matching helper/tests and topbar integration.
- [ ] Sol: additive source-ownership migration, missing-link RPC, validated API and SQL security/report tests.
- [ ] Primary: implement opportunities UI, presets/search/ranking/CSV, creation prefill and navigation.
- [ ] Verify synthetic flows and all relevant unit/SQL/type/lint/build checks. Independent code review and fixes.
- [ ] Provision only couponswift.com for confirmed owned link's owner; verify actual report totals and isolation.
- [ ] Commit/push reviewed feature, verify preview, merge authorized release, verify live markers/API and save evidence.

## Verification progress

- Company finder, backend and UI implemented; three focused helper suites and full 61 Node tests pass.
- Browser verified on synthetic local database: Scala Hosting/scalahosting lookup; destination text and Edit handoff; focus in destination then return to finder; 375px layout; Today/Yesterday; exact missing-code prefill and successful creation moves code to configured without losing logs; query error removes metrics/disables export and retry recovers.
- Live source-scoped RPC matches direct owner-source counts; owned link IDs unchanged. No anonymous RPC/raw log read/domain self-claim permissions.
- Reviewer found mobile button name and editor focus issues; both corrected and verified through browser.
