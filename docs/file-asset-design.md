# File Asset Registration Design

## Purpose

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

