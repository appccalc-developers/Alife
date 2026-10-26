# File Asset Registration Design

> Retained design reference, pending reconciliation with current implementation. The “Current State” section below is an early snapshot: `FileAsset`, `FileAssetsController`, private signed access and backfill now have source implementations. Use current handlers/DTOs and [private-file backfill](member-private-file-backfill.md) for actual behavior; this proposal must not reintroduce its old public-only assumptions. See DOCS-RECONCILE in the [work register](governance/work-register.json) before treating unverified target sections as implementation requirements.

## Adopted album photo contract — 2026-10-18

This section is the current owning contract for the user-approved Google Drive
photo import and album original access work. It supersedes the public-only upload
assumptions below **for album photos only**. Other file purposes retain their
existing contracts. Local implementation is not provider/deployment certification.

| ID | Requirement and acceptance |
| --- | --- |
| ALBUM-01 | Only approved leaders/co-leaders of the owning group, or the existing platform-management exception in `GroupAuthorizationService`, can import. Ordinary, unrelated, pending and removed members are denied by the server. A dissolved group grants no management access. |
| ALBUM-02 | `public` permits anonymous viewing; `groupVisible` requires current approved group membership or the existing platform exception. The owning album is authoritative on every original read, including covers and historical standard URLs. Drive source sharing does not determine Alife visibility. |
| ALBUM-03 | Import requires an explicit confirmation displaying the target album and visibility. A public album has an explicit anyone-can-view notice. `expectedVisibility` is required on each upload and checked before and after storage transfer. Scope/permission conflicts stop the batch and require reloading/reconfirmation. Existing parent/child and public-photo visibility constraints remain. |
| ALBUM-04 | Store new album originals under `private/groups/{groupId}/albums/{albumId}/{attemptId}.{extension}` with no persisted public URL. `GET /api/album-photos/{fileAssetId}` returns bytes after checking the current album and member. Do not issue transferable signed URLs for album originals. Responses and denials are `private, no-store`, varying by Cookie/Authorization. |
| ALBUM-05 | Historical `groups/{groupId}/albums/{albumId}/{filename}` originals are streamed without the new-upload size restriction and remain viewable through the Worker only after a live backend check (`GET /api/album-photo-objects?key=...`). Anonymous storage listing, generic writes, ancestor-folder deletion and generic file registration cannot bypass this control. Nonstandard historical attachments must be inventoried/reconciled before rollout; they are not automatically moved or made public. |
| ALBUM-06 | Album originals bypass Speed Layer shared caches and origin subrequest caches. PWA routes use NetworkOnly for canonical APIs and historical album paths; activation removes historical album entries from v2 runtime caches while preserving unrelated public assets. Previously downloaded copies and browser HTTP caches cannot be remotely recalled. |
| ALBUM-07 | `POST /api/albums/{albumId}/photo-upload` accepts multipart `file`, UUID `uploadId` and enum `expectedVisibility`. The server derives group, owner, purpose and storage key. Finalization rechecks scope inside the existing serializable transaction facility; one EF SaveChanges registers the asset and album association. Visibility updates use the same transaction boundary. A retry with the same actor/album/content/upload ID returns the existing asset; reuse for another payload or context is rejected. Each storage attempt has its own key. Failed attempts are cleaned up; ambiguous database commits retain objects and log reconciliation needs rather than deleting potentially committed data. |
| ALBUM-08 | Google Picker uses GIS token authorization with `drive.file`, on an explicit user click. While authorization is pending, the import panel remains visible with instructions and an enabled Close action; closing aborts the browser operation and suppresses a late token callback. The panel hides only when Picker opens. This Google scope includes write capability; Alife only issues read requests. Tokens remain in page memory and are cleared after preparation. No refresh tokens, backend Google tokens or persistent Drive account link. Resolve bytes from Drive file IDs; never fetch arbitrary picker URLs. Source originals are unchanged. |
| ALBUM-09 | First release: static JPEG/PNG/WebP, up to 50 photos, 20 MiB per file, 100 MiB per batch, 40 million pixels per decoded image. Browser decoding plus server structural validation reject unsupported/disguised/truncated images. PNG also validates CRCs and bounded zlib output. JPEG/WebP server checks are structural, not a full codec decode. Local selection and Drive selection use the same controlled upload. No folder recursion, Google Photos integration, synchronization, or closed-page background execution. |
| ALBUM-10 | Preview thumbnails and filenames before upload; stable per-item states; content deduplication within the open batch; successful items retained on failures; explicit retries preserve upload IDs. Preparation failures are reported per file, and users can reselect failed files without discarding ready items. Cancel stops subsequent uploads; a current request can finish. Unmount/logout/actor changes abort outstanding browser work and revoke preview URLs. Bilingual switching preserves work. |

### Configuration and release prerequisites

- Verify authority separately: Alife album management follows current approved
  group roles or the existing platform-management exception; being the original
  Alife creator is not required. Google project configuration requires the
  corresponding IAM permissions. Repository write access alone does not establish
  Google, domain, deployment, or production-brand authority. Use a personal project
  only for local testing until the production project owner and deployment scope
  are established.
- Use one Google Cloud project with Drive API and Picker API enabled, OAuth web
  client, consent-screen configuration/test users as applicable, authorized JS
  origins, API key restricted to Picker/Drive and approved referrers (including
  `docs.google.com` per Google's Picker guidance), and the numeric project ID.
  Set `VITE_GOOGLE_DRIVE_CLIENT_ID`, `VITE_GOOGLE_DRIVE_API_KEY`, and
  `VITE_GOOGLE_DRIVE_APP_ID`. These browser identifiers are not client secrets.
  For personal-account local acceptance, keep the consent app External/Testing,
  allow only the current test account, use `http://localhost:5173` as the OAuth
  JavaScript origin, and restrict the key to `http://localhost:5173/*` plus
  `https://docs.google.com/*`. Keep identifiers in ignored `.env.local`; no OAuth
  client secret is used by this browser token flow.
- The existing `FileAssets:ImageApiAdminSecret` must match the Images Worker's
  `FILE_ADMIN_BACKFILL_SECRET`. Provider `UploadApiBaseUrl` must target that Worker.
  The Worker delegates legacy reads to `ALBUM_API_BASE_URL`, defaulting to
  `https://api.ccalc.live`; local integration must override this to the local API.
  A database-selected provider's saved upload URL takes precedence over the
  configuration fallback. Inspect the active/default provider before starting
  tests; do not change a shared provider just to redirect a local test. Reuse the
  verified Azure test SQL target when configured; Docker is not required. Do not
  apply shared migrations without separate approval. Disable all non-HTTP
  Functions triggers during this local acceptance run. An isolated local R2
  binding exercises Worker persistence but does not certify deployed R2 access.
- Verify R2 has **no separately public bucket endpoint/domain** bypassing the
  Worker. Inventory nonstandard album keys before rollout. No database migration,
  production data rewrite, bucket movement, or deployment is performed by local
  implementation. Coordinate API, Images Worker, Speed Worker and PWA updates;
  the protected upload must not be enabled against an older Images Worker.
- A real personal Google account completed selected-file download, preview and
  confirmed import on 2026-10-18 against the Australia test SQL database and an
  isolated local R2 emulator. SHA-256 and protected reads were verified; see
  `ALIFE-ALBUM-DRIVE` in the work register. Workspace account policy, popup denial,
  iOS Safari/installed PWA, Android and deployed cache/R2 isolation remain
  target-environment acceptance.
  The production origin must permit GIS/Picker script/frame/connect requirements.

### Reproducible local verification

Use Node 24+ (the desktop bundled runtime is available if the shell selects an old Node).

```powershell
dotnet test backend/tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj --filter 'FullyQualifiedName~Albums|FullyQualifiedName~FileAssets' --no-restore
node --test cloudflare/alife-app/tests/albumImport.test.cjs cloudflare/alife-app/tests/albumEdgeCache.test.cjs cloudflare/alife-app/tests/pwaCache.test.cjs cloudflare/images-api/worker/album-photos.test.mjs cloudflare/images-api/worker/index.test.mjs
npm --prefix cloudflare/alife-app run typecheck
npm --prefix cloudflare/alife-app run test:locale
```

`tests/albumImport.browser.cjs` runs against Vite with fictional Google identifiers
in its environment and intercepted Google SDK/Drive/backend requests. It checks
local/Drive confirmation, failed upload retry, cancellation, permission conflict,
keyboard focus, 320px/1280px layouts and language switching. It does not prove real
Google OAuth or production storage. `ALIFE_QA_OUTPUT` points below
`C:/Data/Alife/Temp`; optional Playwright/browser paths follow existing browser tests.

## Earlier general-file design reference

Alife currently uploads images directly from the React app to the Cloudflare R2-backed image Worker. The Worker stores objects and returns object metadata, while business records store returned URLs inside page, event, enrollment, or review JSON.

This design adds an application-owned file metadata layer without rewriting the R2 Worker first. The goal is to make every meaningful upload traceable, searchable, and permission-aware while preserving the current upload flow during alpha.

## Current State

Current upload responsibilities:

- Frontend image utilities validate, crop, compress, and upload images.
- `cloudflare/images-api` accepts multipart image uploads and stores objects in R2.
- The image Worker returns `key`, `size`, `uploaded`, `contentType`, and `url`.
- The frontend stores the returned URL or file object summary inside feature-specific payloads.

Current persistence locations:

- Event poster: `GroupEvent.EventDataJson.posterImageUrl`
- Event gallery: `GroupEvent.EventDataJson.galleryUrls`
- Enrollment payment proof: `EventEnrollment.EnrollmentJson.paymentFiles[]`
- Event review photos: `EventReview.ReviewJson.photoFiles[]`
- Page media: `Section.ContentJson` fields such as `imageUrl`, `backgroundImage`, and `backgroundImageUrl`
- Link media: `Link.ImageUrl`

Current limitations:

- There is no authoritative file catalog.
- Uploads can succeed without any backend record.
- Delete and orphan cleanup cannot be reasoned about safely.
- File visibility is implied by where a URL is used, not recorded with the file.
- The image Worker currently serves public immutable objects, which is not appropriate for private or member-specific files.

## Proposed Concept

Use `FileAsset` as the backend-owned metadata entity name.

`UploadedFile` should remain a DTO or frontend type for upload results. `FileAsset` should represent the durable catalog record in SQL.

```text
R2 object
  physical storage, object key, bytes, content type

FileAsset
  application metadata, ownership, visibility, references, audit fields

Business record
  event/page/enrollment/review JSON that references either fileAssetId, URL, or both during migration
```

## Visibility Model

File visibility should be explicit and conservative.

### public

Use for files safe for anonymous/shared public access.

Examples:

- Public page hero images
- Public group landing images
- Sermon or event promotional images intended for public viewing

Serving:

- Can continue to use public `/images/...` URLs.
- Can be cached publicly when object content is immutable.

Registration rules:

- `GroupId` may be null for global/public assets.
- `OwnerMemberId` should still be recorded when known.
- Public visibility should be allowed only when the caller can publish or manage the related content.

### group-visible

Use for files visible to approved members of a specific group.

Examples:

- Group-only page images
- Group event posters for non-public events
- Event review photos intended for group members

Serving:

- Should not rely on the current public immutable object path long term.
- Phase 1 may still record existing public URLs for compatibility, but the metadata should mark the file as `groupVisible` so future serving can move behind authorized APIs or signed URLs.

Registration rules:

- `GroupId` is required.
- Caller must be an approved member to upload general group-visible files.
- Leader/co-leader should be required for files attached to managed content such as group pages and event posters.

### member-private

Use for files specific to one member or a private workflow.

Examples:

- Payment proof images
- Private enrollment attachments
- User-specific identity or contact documents if added later

Serving:

- Must not be made publicly cacheable in shared caches.
- Should eventually be served through an authenticated backend endpoint, a short-lived signed URL, or a private Worker path that validates authorization.
- Browser response should use private/no-store or tightly controlled private caching depending on the workflow.

Registration rules:

- `OwnerMemberId` is required.
- `GroupId` should be set when the file belongs to a group workflow.
- `RelatedEntityType` and `RelatedEntityId` should be set for enrollment/review/event context.
- Only the owner, relevant group leaders/co-leaders, or explicit admins should be able to list or view metadata.

## FileAsset Entity

Suggested domain entity:

```csharp
public class FileAsset
{
    public Guid Id { get; set; }

    public string StorageProvider { get; set; } = "cloudflare-r2";
    public string BucketName { get; set; } = string.Empty;
    public string ObjectKey { get; set; } = string.Empty;
    public string PublicUrl { get; set; } = string.Empty;

    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? ETag { get; set; }

    public FileAssetVisibility Visibility { get; set; }
    public FileAssetPurpose Purpose { get; set; }

    public Guid? GroupId { get; set; }
    public Guid? OwnerMemberId { get; set; }
    public string? RelatedEntityType { get; set; }
    public Guid? RelatedEntityId { get; set; }

    public DateTime UploadedUtc { get; set; }
    public DateTime CreatedUtc { get; set; }
    public DateTime UpdatedUtc { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedUtc { get; set; }
}
```

Recommended enums:

```csharp
public enum FileAssetVisibility
{
    Public = 1,
    GroupVisible = 2,
    MemberPrivate = 3
}

public enum FileAssetPurpose
{
    General = 1,
    PageMedia = 2,
    EventPoster = 3,
    EventGallery = 4,
    EnrollmentPaymentProof = 5,
    ReviewPhoto = 6,
    GroupCover = 7,
    MemberAvatar = 8
}
```

Database notes:

- Add unique index on `ObjectKey` while `IsDeleted = 0`.
- Add indexes on `(GroupId, Visibility, UploadedUtc)`, `(OwnerMemberId, UploadedUtc)`, and `(RelatedEntityType, RelatedEntityId)`.
- Keep `PublicUrl` nullable or optional if private serving later moves to generated URLs.
- Do not store file bytes in SQL.

## Registration Boundary

The first implementation should register metadata after the current R2 upload succeeds.

```text
Frontend selects file
  -> current uploadImage(file, folderPath)
  -> image Worker writes to R2 and returns image metadata
  -> frontend POSTs metadata to backend /api/file-assets
  -> backend validates visibility, ownership, group access, and related entity access
  -> backend stores FileAsset
  -> frontend stores fileAssetId plus legacy url where possible
```

This avoids rewriting the Worker immediately while moving authorization and business meaning into the backend.

## Backend API Draft

### Register uploaded file

`POST /api/file-assets`

Request:

```json
{
  "storageProvider": "cloudflare-r2",
  "objectKey": "groups/{groupId}/events/{eventId}/calendar/upload.webp",
  "publicUrl": "https://ccalc.live/images/groups/{groupId}/events/{eventId}/calendar/upload.webp",
  "originalFileName": "poster.png",
  "storedFileName": "upload.webp",
  "contentType": "image/webp",
  "sizeBytes": 123456,
  "etag": "abc",
  "uploadedUtc": "2026-06-30T00:00:00Z",
  "visibility": "groupVisible",
  "purpose": "eventPoster",
  "groupId": "00000000-0000-0000-0000-000000000000",
  "relatedEntityType": "event",
  "relatedEntityId": "00000000-0000-0000-0000-000000000000"
}
```

Response:

```json
{
  "id": "00000000-0000-0000-0000-000000000000",
  "objectKey": "groups/{groupId}/events/{eventId}/calendar/upload.webp",
  "url": "https://ccalc.live/images/groups/{groupId}/events/{eventId}/calendar/upload.webp",
  "visibility": "groupVisible",
  "purpose": "eventPoster"
}
```

Validation:

- Authenticated member is required for all registrations.
- `public` requires permission to manage or publish the related content.
- `groupVisible` requires `groupId` and current approved group access.
- `memberPrivate` requires an owner member, defaulting to the current member.
- `enrollmentPaymentProof` should only be created by the enrolling member or a leader/co-leader managing that enrollment.
- `reviewPhoto` should be created by the reviewer or a leader/co-leader if moderation features are added.
- Object keys should be normalized and should not contain traversal-like segments.

### List files

`GET /api/file-assets?groupId=&visibility=&purpose=&relatedEntityType=&relatedEntityId=`

Rules:

- Public assets can be listed only where the surrounding feature already exposes public metadata.
- Group-visible assets require approved group membership.
- Member-private assets require owner, leader/co-leader in the related group, or admin.
- Default list should exclude `IsDeleted = true`.

### Get file metadata

`GET /api/file-assets/{id}`

Rules:

- Same visibility checks as list.
- Returns metadata, not bytes.

### Mark file deleted

`DELETE /api/file-assets/{id}`

Phase 1 should soft-delete metadata only or soft-delete plus best-effort Worker delete for safe public assets.

Do not physically delete private/group files automatically until references are understood. A file may be used by multiple page sections or historical records.

## Frontend Registration Helper

Add a helper such as `fileAssetService.registerUploadedImage`.

Then wrap existing upload sites:

```text
uploadImage(file, folderPath)
  -> registerUploadedImage(image, context)
  -> return { image, fileAsset }
```

Initial integration points:

- Event poster: purpose `eventPoster`, visibility usually `groupVisible`
- Enrollment payment proof: purpose `enrollmentPaymentProof`, visibility `memberPrivate`
- Event review photo: purpose `reviewPhoto`, visibility default `groupVisible` unless UX says private draft
- Page editor images: purpose `pageMedia`, visibility derived from page visibility and scope

During migration, business JSON can keep the old `url` fields and optionally add `fileAssetId`:

```json
{
  "fileName": "receipt.jpg",
  "contentType": "image/jpeg",
  "size": 123456,
  "key": "groups/.../receipt.jpg",
  "url": "https://ccalc.live/images/groups/.../receipt.jpg",
  "fileAssetId": "00000000-0000-0000-0000-000000000000"
}
```

## Cache And Serving Guidance

Public files:

- Existing public immutable object serving can remain.
- Metadata list APIs should use the same public/group/member cache discipline as other API reads.

Group-visible files:

- Metadata can be group-shared cached only if all approved group members receive the same response.
- File bytes should eventually move away from public object URLs if the content is not intended for anonymous access.

Member-private files:

- Metadata and file bytes must not be shared-cacheable.
- Use `Cache-Control: private, no-store` or a tightly justified private browser cache.
- Do not expose private object keys through public listing APIs unless the caller is authorized.

## Historical Backfill

Historical files can be registered in a later migration or admin job by scanning:

- `GroupEvent.EventDataJson`
- `EventEnrollment.EnrollmentJson`
- `EventReview.ReviewJson`
- `Section.ContentJson`
- `Link.ImageUrl`

Backfill should infer visibility conservatively:

- Payment proof -> `memberPrivate`
- Review photos -> `groupVisible`
- Event posters -> `groupVisible` unless event/page is clearly public
- Page media -> derive from page scope and visibility
- Unknown external URLs -> record only if they belong to Alife image domains; otherwise keep as external references

## Phased Implementation

### Phase 1: Metadata catalog

- Add `FileAsset` entity, enums, migration, DTOs, commands, queries, and controller.
- Add registration API.
- Add frontend registration helper.
- Register new uploads after successful R2 upload.
- Keep existing URL behavior.

### Phase 2: File manager UI

- Add group leader file listing and filtering.
- Show purpose, owner, related entity, visibility, size, uploaded date, and preview URL where safe.
- Add orphan detection based on missing related entity or missing JSON references.

### Phase 3: Private serving

- Add authenticated file serving or signed URL flow for `groupVisible` and `memberPrivate`.
- Update sensitive upload entries to stop depending on public immutable URLs.
- Tighten Worker routes or add a private Worker path if needed.

### Phase 4: Backfill and cleanup

- Scan existing business JSON and register historical R2 assets.
- Add reference-count or reference-scan based deletion.
- Add admin cleanup for orphaned objects.

## Open Questions

- Should event posters be public when the event is displayed on the public home page?
- Should event review photos be visible to all approved group members, event participants only, or leaders only?
- Should payment proof files be visible to group leaders/co-leaders only, or also to event-specific coordinators if that role is added?
- Should page media visibility be locked at upload time or recalculated when page visibility changes?
- Should the image Worker eventually accept backend-signed upload tokens to prevent unregistered uploads?

