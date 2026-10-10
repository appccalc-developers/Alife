# Cloudflare-only profile

This is a proposed new-system implementation, not a migration of Alife. Preserve logical boundaries even when all runtimes are on Cloudflare. Existing .NET/EF Core/SQL Server code and migrations cannot be assumed to work on Workers/D1 by changing deployment settings.

| Responsibility | Candidate implementation | Required proof |
| --- | --- | --- |
| Presentation | Existing React/TypeScript/Vite PWA with Worker static delivery | Routing, bilingual state, mobile/desktop, saved builder payloads |
| Acceleration | Worker delivery/cache module or separate entry Worker | Private/group/public classification, authorization before cached reads, ETags/invalidation |
| Application/domain | TypeScript Worker API with separate handlers/domain/persistence modules | Same DTOs, status/error semantics, lifecycle and current actor/role/ownership checks |
| Persistent relational records | D1, through explicit repositories and migrations | Keys/constraints, timestamps/JSON/enums, atomic commands, conflict handling, retry/idempotency |
| Media | R2 + authorized image/media routes | Upload/delete authority, public vs restricted access, signed access and invalidation |
| Temporary AI sessions | Durable Objects | Temporary state, minimal prompt data, explicit human acceptance through application API |
| Scheduled work | Cron Triggers; Queues/Workflows only when needed and approved | Idempotent scheduling, failures/retries, recurrence/timezone and provider parity |

The deployment choice establishes Workers/D1 as the candidate runtime/store; do not introduce a framework, ORM, authentication library or paid provider without authorization. Check installed APIs/types and current official documentation before coding. Existing source is the contract reference; reconstruct application rules, not just routes. Port SQL types, queries, indexes, concurrency and migrations deliberately; preserve legacy JSON/enums, unique constraints, version snapshots and audit history semantics. A new empty system does not require importing Alife data.

Prove identity and group access first. Review Passkey cryptography and library/runtime support, JWT/cookies, RP/origin/challenge verification, hashed single-use ceremonies/invitations, rate limits, expiry and recovery. If suitable authentication dependencies require approval, prepare the concrete choice and pause that dependency rather than implementing insecure substitutes.

For D1, `batch()` supports transactional rollback on statement failure; that alone does not prove an existing read-check-write business command is atomic. Use conditional mutations, unique constraints and observed results to preserve concurrency, single-use token consumption and idempotency. Prove behavior with competing/retried requests. If read replication is used, review Sessions/primary-read consistency for current authority and revocation; a session bookmark by itself is not a guarantee of the latest authorization state.

Keep permission authority in the application, not KV/cache mirrors. Avoid public/shared caching until a representation and invalidation path meet the source contract. Provider adapters for mail, LINE, YouTube and AI need explicit parity and authorized configuration. “Cloudflare-only” infrastructure does not eliminate external content/identity/AI providers automatically.

Use the same acceptance scenarios as Azure, including prohibited actors, revoked membership, per-viewer data, publication snapshots, Event gates, reload, errors, concurrency, bilingual and rendered flows. Prove one full persistent journey before expansion. This package has no completed Cloudflare backend; GEN-03 tracks that implementation. Do not present this design or generated D1 schema as a complete equivalent app.

Official references checked 2026-10-10; recheck relevant APIs when implementing:

- [Workers languages](https://developers.cloudflare.com/workers/languages/)
- [D1 database API and transactional batch](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 read replication and Sessions](https://developers.cloudflare.com/d1/best-practices/read-replication/)
