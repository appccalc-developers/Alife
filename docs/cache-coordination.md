# Cross-layer cache coordination

## Authority

This is the architecture review matrix, not a claim that all invalidation paths have been exercised. Exact route behavior belongs to [edge architecture](speed-layer_architecture.md), backend read/invalidation services and the owning domain contract. [System architecture](architecture.md) owns layer boundaries. Current implementation must be inspected for the affected row before edits.

## Data and layer matrix

| Data class | Backend | Edge | App | Changes requiring review |
| --- | --- | --- | --- | --- |
| Published public pages | Immutable published snapshot, eligible read cache | Public L1 and KV L2; private working copies excluded | Query/collections and conditional IndexedDB reads where used | Approval, withdrawal, deletion, visibility or approved-copy changes: backend invalidation, global public tag purge, KV deletion/warming and client list/detail invalidation |
| Group-shared lists | Current server membership/role checks and eligible read cache | Only equal representations for authorized viewers; approved authorization mirror before shared read | Viewer/group-aware query identity and applicable collections | Membership, role, group and content mutations: affected reads, mirrors and client state; inspect all visibility dimensions |
| Identity and user-specific work | Current identity and authorized projection; internal read cache does not grant HTTP cacheability | `/api/me`, identity and personal-task families bypass response cache | Identity/provider state; clear or isolate prior-viewer state | Login, logout, viewer change, membership/role change and recovery; credential revocation does not imply existing JWT revocation |
| Page working/review copies | Server-authorized private projection | Working/review copies bypass shared caches | Viewer-scoped Query memory only; no IndexedDB or offline fallback | Viewer change/logout cancels reads and clears private state; deletion removes all viewer variants, persistent legacy records and public detail; late fills are rejected |
| Event restricted/team/approval data | Owning Event authorization and private projection | Private/no-store under Event contract | No shared viewer validators; follow owning API rules | Plan, role, evidence, approval and lifecycle changes; public allowlisted projection is separately classified |
| Sermons | Read cache and synchronization | Pagination-aware key, five-minute L1 TTL, global sermon tag purge | Query and sermon collection/conditional cache | Synchronization invalidates backend, edge variants and applicable client reads |
| Shell and eligible images/fonts | Not a business-data cache | Static delivery and permitted image caching | PWA static/runtime resources only | Build activation and resource-version changes; missing assets must not become SPA HTML |

## Fill, validation and failure principles

- Reads fill only eligible caches after successful authorized responses. Cache keys include representation dimensions; TTL is not a substitute for authorization.
- Public page L1 can refill from KV L2. Page invalidation deletes global KV records, purges the public tag and warms approved public projections. Edge Cache API deletion alone affects only the processing data center.
- Conditional reads use ETag/If-None-Match and 304. Browser-facing headers and edge internal storage semantics are distinct; inspect Cache-Control and Vary rather than assuming that edge eligibility means public browser caching.
- A missing group authorization mirror bypasses shared reads to the origin as documented; an extracted token subject is not authentication proof.
- A successful mutation must review backend invalidation, edge invalidation/mirrors, Query invalidation and IndexedDB removal separately. Invalidating Query alone does not delete an IndexedDB record.
- Service Worker never replays API responses. Private/no-store is not permission to persist protected payloads in an application cache; inspect the owning client policy.
- Service Worker matches `/api/` and `/images/api/` as NetworkOnly before every document/image/video runtime rule, including external origins. Runtime v2 caches isolate the repaired policy from pre-v2 entries; activation removes only the five named legacy Alife runtime caches. See [PWA policy](pwa.md).
- Failure analysis must cover stale permission, failed purge/warm, delayed concurrent fills and retries. Do not invent a recovery guarantee absent from implementation; record any uncovered path as a gap.

## Evidence required for cache changes

### Bible reading progress (current-member only)

`GET`/`PUT /api/me/bible-reading-progress` bind ownership to the server-resolved JWT member, never a caller-supplied member ID. `ApiHttpPipeline` applies `private, no-store`, `Pragma: no-cache` and `Vary: Cookie, Authorization` before authentication/authorization and MVC binding; the controller retains `no-store` for successful and handler-returned responses. The exact route match is case-insensitive and accepts trailing slashes; unrelated paths do not acquire this policy. This adds no shared cache, validator, TTL or invalidation mechanism, and changes no DTO, language/version fields or persistence schema. Existing edge/PWA API exclusions still apply independently.

2026-10-07 local evidence: the actual request pipeline, MVC, JWT middleware, current-member accessor and progress handlers were exercised with test-owned signatures and EF InMemory, without starting the Functions host or connecting SQL. Initially 18 of 35 checks failed solely on missing `no-store` for early 401/400 responses. After the route-specific fix, 28 pipeline cases, 13 existing progress cases and one existing conditional-header case passed (42/42), covering denied credentials, input rejection, cookie/Bearer ownership, alternating members and route boundaries. This is not production configuration/session issuance, real SQL constraints, browser cookie security or deployed-edge verification; those remain separate gates. Raw TRX results and source hashes are retained in the existing virtual-church evidence directory under `C:\Data\Alife\Temp\vc-public-hero-pair-20261006`.

Client progress requests now accept an optional cancellation signal. Bible-study restore/save effects abort on cleanup and ignore disposed responses, so a late save cannot replace a newer local chapter after navigation; existing per-member storage keys and offline local saves remain unchanged. Personal Center forwards TanStack Query's signal while retaining its member-keyed query. Six controlled effect/service tests plus 17 related guest-reading/provider tests passed (23/23), followed by TypeScript and a current production build. A browser verified guest Chinese chapter navigation and English reading, not real member switching. Aborting a request does not undo an already-committed server write or establish multi-client/concurrent-save ordering; real authenticated persistence remains unverified.

2026-10-26 PR review correction: restoration tracks the URL it last applied itself, so its optimistic local navigation does not suppress a newer server position. An actual user navigation while the GET is pending prevents both applying the remote position and uploading the prior local position; the regular save effect then owns the current selection. Explicit entry references and language/version preferences remain authoritative. Four additional executable restore regressions passed with the existing cancellation/service cases (10/10); the full church/reading/recovery suite passed (558/558). These controlled effects do not establish live multi-client write ordering or authenticated production persistence.

Record affected routes and viewer classes, key dimensions, TTL/header/validator behavior, fill trigger, invalidation trigger, scope across data centers, client handling and failure behavior. Verify an allowed viewer, denied viewer, viewer switch and mutation freshness where applicable. Distinguish local fixtures from live database, multi-account and deployed-edge results.

This matrix was assembled from current architecture sources on 2026-10-01. It has not established end-to-end runtime coverage; future domain status entries must name the actual source and environment verified.

# Album photo privacy (2026-10-18)

The current album-specific contract is [ALBUM-02 through ALBUM-06](file-asset-design.md#adopted-album-photo-contract--2026-10-18).
Album original bytes (including covers) use `/api/album-photos/{assetId}` with
`private, no-store` and a fresh owning-album membership/visibility check. Historical
standard storage paths delegate to `/api/album-photo-objects` and carry the same
policy. This intentionally forgoes shared caching for mutable album visibility,
including currently public album originals. Other public media caching is unchanged.
Speed Layer bypasses existing cache entries and origin cache reads for album paths.
PWA activation removes historical album originals from v2 runtime caches and uses
NetworkOnly for future reads. Neither revokes already downloaded copies or existing
browser HTTP cache entries. Validate independent R2 endpoints before deployment.
