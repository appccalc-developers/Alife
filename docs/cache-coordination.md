# Cross-layer cache coordination

## Authority

This is the architecture review matrix, not a claim that all invalidation paths have been exercised. Exact route behavior belongs to [edge architecture](speed-layer_architecture.md), backend read/invalidation services and the owning domain contract. [System architecture](architecture.md) owns layer boundaries. Current implementation must be inspected for the affected row before edits.

## Data and layer matrix

| Data class | Backend | Edge | App | Changes requiring review |
| --- | --- | --- | --- | --- |
| Published public pages | Immutable published snapshot, eligible read cache | Public L1 and KV L2; private working copies excluded | Query/collections and conditional IndexedDB reads where used | Approval, withdrawal, deletion, visibility or approved-copy changes: backend invalidation, global public tag purge, KV deletion/warming and client list/detail invalidation |
| Group-shared lists | Current server membership/role checks and eligible read cache | Only equal representations for authorized viewers; approved authorization mirror before shared read | Viewer/group-aware query identity and applicable collections | Membership, role, group and content mutations: affected reads, mirrors and client state; inspect all visibility dimensions |
| Identity and user-specific work | Current identity and authorized projection; internal read cache does not grant HTTP cacheability | `/api/me`, identity and personal-task families bypass response cache | Identity/provider state; clear or isolate prior-viewer state | Login, logout, viewer change, membership/role change and recovery; credential revocation does not imply existing JWT revocation |
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
- Failure analysis must cover stale permission, failed purge/warm, delayed concurrent fills and retries. Do not invent a recovery guarantee absent from implementation; record any uncovered path as a gap.

## Evidence required for cache changes

Record affected routes and viewer classes, key dimensions, TTL/header/validator behavior, fill trigger, invalidation trigger, scope across data centers, client handling and failure behavior. Verify an allowed viewer, denied viewer, viewer switch and mutation freshness where applicable. Distinguish local fixtures from live database, multi-account and deployed-edge results.

This matrix was assembled from current architecture sources on 2026-10-01. It has not established end-to-end runtime coverage; future domain status entries must name the actual source and environment verified.
